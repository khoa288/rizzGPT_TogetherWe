/**
 * @fileoverview Main logic for the Laugh Mode.
 * Handles microphone access, YAMNet classification, and scoring.
 */
import * as core from './core.js';
import * as ui from './ui.js';

// --- State Variables ---
let audioClassifier = null;
let audioContext = null;
let analyserNode = null;
let scriptProcessorNode = null;
let rafId = 0;
let isRoundRunning = false;
let baselineRMS = 0.0;
const EMA_ALPHA = 0.2;
let emaLaughProb = 0;

/**
 * Dynamically imports MediaPipe Tasks Audio, with a CDN fallback.
 */
async function importTasksAudio() {
    try {
        ui.logDebug("Loading @mediapipe/tasks-audio from jsDelivr…");
        return await import(core.MP_JSDELIVR_URL);
    } catch (e) {
        ui.logDebug("jsDelivr failed, falling back to unpkg…");
        return await import(core.MP_UNPKG_URL);
    }
}

/**
 * Initializes the MediaPipe AudioClassifier if it doesn't exist.
 */
async function ensureClassifier() {
    if (audioClassifier) return;
    ui.setStatus("Loading audio model...", "warn");
    try {
        const { FilesetResolver, AudioClassifier } = await importTasksAudio();
        let fileset;
        try {
            fileset = await FilesetResolver.forAudioTasks(core.MP_JSDELIVR_URL + core.MP_WASM_DIR);
        } catch {
            fileset = await FilesetResolver.forAudioTasks(core.MP_UNPKG_URL + core.MP_WASM_DIR);
        }
        
        try {
            audioClassifier = await AudioClassifier.createFromOptions(fileset, { baseOptions: { modelAssetPath: core.YAMNET_MODEL_PRIMARY_URL }, runningMode: "AUDIO_CLIPS" });
            ui.logDebug("YAMNet model loaded from TF Hub.");
        } catch (e) {
            ui.logDebug(`TF Hub failed (${e.message}), falling back to GCS...`);
            audioClassifier = await AudioClassifier.createFromOptions(fileset, { baseOptions: { modelAssetPath: core.YAMNET_MODEL_FALLBACK_URL }, runningMode: "AUDIO_CLIPS" });
            ui.logDebug("YAMNet model loaded from GCS fallback.");
        }
        ui.setStatus("Model loaded. Ready.", "ok");
    } catch (error) {
        console.error("Failed to initialize AudioClassifier:", error);
        ui.setStatus("Error loading audio model.", "bad");
        throw error;
    }
}

/**
 * Checks if a YAMNet category name is related to laughter.
 * @param {string} name The category name.
 * @returns {boolean}
 */
function isLaughterCategory(name) {
    const n = name.toLowerCase();
    return n.includes("laugh") || n.includes("giggle") || n.includes("chuckle") || n.includes("chortle") || n.includes("snicker");
}

/**
 * Starts the RMS meter visualization.
 * @param {MediaStreamAudioSourceNode} sourceNode
 */
function startRmsMeter(sourceNode) {
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 1024;
    const dataArray = new Float32Array(analyserNode.fftSize);
    sourceNode.connect(analyserNode);

    const updateMeter = () => {
        analyserNode.getFloatTimeDomainData(dataArray);
        let sumSquares = 0.0;
        for (const amplitude of dataArray) {
            sumSquares += amplitude * amplitude;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        ui.updateMeter('rms', rms * 300, rms.toFixed(3)); // Scaling factor for better visualization
        rafId = requestAnimationFrame(updateMeter);
    };
    updateMeter();
}

/**
 * Cleans up all audio resources.
 */
function cleanupAudio() {
    isRoundRunning = false;
    cancelAnimationFrame(rafId);
    if (scriptProcessorNode) {
        scriptProcessorNode.onaudioprocess = null;
        scriptProcessorNode.disconnect();
    }
    if (analyserNode) analyserNode.disconnect();
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(console.error);
    }
    scriptProcessorNode = null;
    analyserNode = null;
    audioContext = null;
}

/**
 * Main function to start and run a 10-second laugh round.
 * @param {string} playerName The current player's name.
 */
async function startLaughRound(playerName) {
    cleanupAudio();
    await ensureClassifier();
    
    ui.setStatus("Requesting microphone...", "warn");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext({ sampleRate: 16000 });
    if (audioContext.state === 'suspended') await audioContext.resume();
    
    const sourceNode = audioContext.createMediaStreamSource(stream);
    
    // --- Calibration Phase ---
    ui.setStatus("Calibrating background noise... (2s)", "warn");
    const calibrationAnalyser = audioContext.createAnalyser();
    calibrationAnalyser.fftSize = 1024;
    const calibData = new Float32Array(calibrationAnalyser.fftSize);
    sourceNode.connect(calibrationAnalyser);
    let rmsSum = 0, rmsCount = 0;
    const calibEndTime = performance.now() + 2000;
    while(performance.now() < calibEndTime) {
        calibrationAnalyser.getFloatTimeDomainData(calibData);
        let sumSquares = 0.0;
        for (const amp of calibData) sumSquares += amp * amp;
        rmsSum += Math.sqrt(sumSquares / calibData.length);
        rmsCount++;
        await new Promise(r => setTimeout(r, 50));
    }
    baselineRMS = rmsCount > 0 ? (rmsSum / rmsCount) : 0.01;
    sourceNode.disconnect(calibrationAnalyser);
    ui.logDebug(`Calibration complete. Baseline RMS: ${baselineRMS.toFixed(4)}`);

    // --- Game Phase ---
    startRmsMeter(sourceNode);
    const ringBuffer = new Float32Array(16000); // 1 second of audio at 16kHz
    let ringBufferIndex = 0;

    scriptProcessorNode = audioContext.createScriptProcessor(16384, 1, 1);
    scriptProcessorNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        for (let i = 0; i < inputData.length; i++) {
            ringBuffer[ringBufferIndex++] = inputData[i];
            if (ringBufferIndex >= ringBuffer.length) ringBufferIndex = 0;
        }
    };
    sourceNode.connect(scriptProcessorNode);
    scriptProcessorNode.connect(audioContext.destination);

    isRoundRunning = true;
    ui.setStatus("Go! Laugh for 10 seconds!", "ok");
    
    let laughProbSum = 0, frameCount = 0;
    let loudPenalty = 0, streak = 0, streakBonus = 0;
    emaLaughProb = 0;

    const ROUND_DURATION = 10000;
    const TICK_INTERVAL = 250; // 4 Hz
    let elapsedTime = 0;

    const gameLoop = setInterval(() => {
        if (!isRoundRunning) return;

        // Get current RMS for loudness penalty
        const rmsData = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(rmsData);
        let sumSquares = 0; for (const amp of rmsData) sumSquares += amp * amp;
        const currentRMS = Math.sqrt(sumSquares / rmsData.length);
        const loudThreshold = baselineRMS + 0.10;
        if (currentRMS > loudThreshold) {
            loudPenalty += Math.min(0.03, currentRMS - loudThreshold);
        }

        // Get 1s audio data from ring buffer
        const audioSlice = new Float32Array(ringBuffer.length);
        const tailLength = ringBuffer.length - ringBufferIndex;
        audioSlice.set(ringBuffer.subarray(ringBufferIndex), 0);
        audioSlice.set(ringBuffer.subarray(0, ringBufferIndex), tailLength);

        // Classify audio
        let classifications = [];
        try {
            classifications = audioClassifier.classify(audioSlice, audioContext.sampleRate)?.[0]?.classifications?.[0]?.categories || [];
        } catch (err) {
            ui.logDebug(`Classification error: ${err.message || err}`);
        }
        
        // Calculate laughter probability for this tick
        let p = classifications.reduce((sum, cat) => sum + (isLaughterCategory(cat.categoryName) ? cat.score : 0), 0);
        p = core.clamp(p, 0, 1);

        // Update streak bonus
        if (p >= 0.6) {
            streak++;
            if (streak > 0 && streak % 4 === 0) streakBonus++; // Bonus per ~1s
        } else {
            streak = 0;
        }

        laughProbSum += p;
        frameCount++;

        // Update UI
        emaLaughProb = EMA_ALPHA * (p * 100) + (1 - EMA_ALPHA) * emaLaughProb;
        ui.updateMeter('laugh', emaLaughProb, `${emaLaughProb.toFixed(1)}%`);

        const baseScore = 100 * (laughProbSum / frameCount);
        const finalPenalty = 15 * loudPenalty;
        const finalBonus = 2 * streakBonus;
        const joyRank = Math.round(Math.max(0, baseScore - finalPenalty + finalBonus));

        ui.updateMeter('joy', joyRank, joyRank.toString());

        elapsedTime += TICK_INTERVAL;
        // End of round
        if (elapsedTime >= ROUND_DURATION) {
            stopRound(playerName, joyRank);
        }
    }, TICK_INTERVAL);

    // Ensure the loop is cleared when stopping
    const stopRound = (name, finalScore) => {
        if (!isRoundRunning) return;
        isRoundRunning = false;
        clearInterval(gameLoop);
        cleanupAudio();
        
        ui.setStatus("Round finished!", "ok");
        ui.setButtonStates({ start: false, stop: false, again: true });
        
        const isNewBest = core.saveScore('laugh', name, finalScore);
        if (isNewBest) {
            ui.setStatus("New personal best!", "ok");
            ui.triggerConfetti();
        }
    };
    
    core.$('#stop-btn').onclick = () => stopRound(playerName, 0);
}

/**
 * Initializes the entire Laugh Mode page, setting up event listeners.
 */
export function initLaughPage() {
    const nameInput = core.$('#name-input');
    const saveNameBtn = core.$('#save-name-btn');
    const nameStatus = core.$('#name-status');
    const startBtn = core.$('#start-btn');

    // Name handling
    nameInput.value = localStorage.getItem(core.PLAYER_NAME_KEY) || '';
    saveNameBtn.onclick = () => {
        const name = core.sanitizeName(nameInput.value);
        if (name) {
            localStorage.setItem(core.PLAYER_NAME_KEY, name);
            nameStatus.textContent = "Saved!";
            nameStatus.className = "text-sm text-emerald-600";
        } else {
            nameStatus.textContent = "Invalid name";
            nameStatus.className = "text-sm text-red-600";
        }
    };

    // Game controls
    startBtn.onclick = async () => {
        if (!core.isSecureContext()) {
            alert("This feature requires a secure connection (HTTPS) or localhost.");
            return;
        }
        const playerName = core.sanitizeName(nameInput.value);
        if (!playerName) {
            nameStatus.textContent = "Please save a valid name first.";
            nameStatus.className = "text-sm text-red-600";
            return;
        }
        
        ui.setButtonStates({ start: false, stop: true, again: false });
        try {
            await startLaughRound(playerName);
        } catch (error) {
            console.error(error);
            ui.setStatus(error.message || "Could not start microphone.", "bad");
            ui.setButtonStates({ start: true, stop: false, again: false });
            cleanupAudio();
        }
    };
    
    core.$('#again-btn').onclick = () => {
        ui.setStatus("Ready.");
        ui.setButtonStates({ start: true, stop: false, again: false });
        ui.updateMeter('rms', 0, '0.000');
        ui.updateMeter('laugh', 0, '0.0%');
        ui.updateMeter('joy', 0, '0');
    };

    ui.displayOriginStatus(core.isSecureContext());
}