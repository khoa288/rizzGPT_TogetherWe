/**
 * @fileoverview Main logic for the Shake Mode.
 * Handles device motion events, permission requests, and scoring.
 */
import * as core from './core.js';
import * as ui from './ui.js';

// --- State Variables ---
let isRoundRunning = false;
let motionDataAvailable = false;
let lastTimestamp = 0;
let integratedAccEnergy = 0;
let integratedRotEnergy = 0;
let liveAcceleration = 0;
let liveRotation = 0;
let gameLoopId = 0;

/**
 * The event handler for `devicemotion` events.
 * @param {DeviceMotionEvent} event
 */
function onDeviceMotion(event) {
    if (!motionDataAvailable) motionDataAvailable = true;

    const now = event.timeStamp || performance.now();
    let dt = lastTimestamp ? (now - lastTimestamp) / 1000 : 0.016;
    if (dt <= 0 || dt > 0.25) dt = 0.016; // Clamp dt to a reasonable range
    lastTimestamp = now;

    // --- Linear Acceleration Magnitude ---
    const acc = event.acceleration;
    const accG = event.accelerationIncludingGravity;
    let ax = 0, ay = 0, az = 0;
    if (acc && acc.x !== null) {
        ax = acc.x; ay = acc.y; az = acc.z;
    } else if (accG && accG.x !== null) {
        // Fallback for browsers that don't provide linear acceleration
        // This is a rough approximation and not very accurate.
        ax = accG.x; ay = accG.y; az = accG.z - 9.81;
    }
    liveAcceleration = Math.hypot(ax, ay, az);

    // --- Rotation Rate Magnitude ---
    const rot = event.rotationRate || { alpha: 0, beta: 0, gamma: 0 };
    liveRotation = Math.hypot(rot.alpha || 0, rot.beta || 0, rot.gamma || 0);
    const rotRad = liveRotation * (Math.PI / 180);

    // --- Integrate Energies ---
    integratedAccEnergy += (liveAcceleration * liveAcceleration) * dt;
    integratedRotEnergy += (rotRad * rotRad) * dt;
}

/**
 * Cleans up motion event listeners and game loops.
 */
function cleanupMotion() {
    isRoundRunning = false;
    window.removeEventListener('devicemotion', onDeviceMotion);
    if (gameLoopId) clearTimeout(gameLoopId);
}

/**
 * Main function to start and run a 10-second shake round.
 * @param {string} playerName The current player's name.
 */
async function startShakeRound(playerName) {
    cleanupMotion();

    // --- iOS Permission Request ---
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        ui.setStatus("Requesting motion access...", "warn");
        try {
            const permissionState = await DeviceMotionEvent.requestPermission();
            ui.displayOriginStatus(core.isSecureContext(), permissionState);
            if (permissionState !== 'granted') {
                throw new Error("Motion access was not granted.");
            }
        } catch (error) {
            console.error(error);
            throw new Error("Could not get motion permission.");
        }
    } else {
        ui.displayOriginStatus(core.isSecureContext(), 'not required');
    }

    // --- Reset State & Start ---
    isRoundRunning = true;
    motionDataAvailable = false;
    lastTimestamp = 0;
    integratedAccEnergy = 0;
    integratedRotEnergy = 0;
    liveAcceleration = 0;
    liveRotation = 0;
    
    window.addEventListener('devicemotion', onDeviceMotion, { passive: true });

    // Check for sensor data after a short delay
    setTimeout(() => {
        if (!motionDataAvailable && isRoundRunning) {
            ui.setStatus("No motion data detected. (Try on a mobile device).", "warn");
        }
    }, 2000);

    ui.setStatus("Go! Shake your device for 10 seconds!", "ok");

    const ROUND_DURATION = 10000;
    const FRAME_INTERVAL = 1000 / 60; // ~60 FPS
    let elapsedTime = 0;
    
    const gameLoop = () => {
        if (!isRoundRunning) return;

        // Update live meters
        ui.updateMeter('acc', core.clamp(liveAcceleration * 6, 0, 100), `${liveAcceleration.toFixed(2)} m/s²`);
        ui.updateMeter('rot', core.clamp(liveRotation * 0.4, 0, 100), `${liveRotation.toFixed(1)} °/s`);

        // Calculate and update ShakeRank
        const shakeRank = Math.round(6 * integratedAccEnergy + 2 * integratedRotEnergy);
        ui.updateMeter('shake', core.clamp(shakeRank / 5, 0, 100), shakeRank.toString());

        elapsedTime += FRAME_INTERVAL;
        if (elapsedTime >= ROUND_DURATION) {
            stopRound(playerName, shakeRank);
        } else {
            gameLoopId = setTimeout(gameLoop, FRAME_INTERVAL);
        }
    };
    gameLoop();
    
    const stopRound = (name, finalScore) => {
        if (!isRoundRunning) return;
        cleanupMotion();
        
        ui.setStatus("Round finished!", "ok");
        ui.setButtonStates({ start: false, stop: false, again: true });
        
        const isNewBest = core.saveScore('shake', name, finalScore);
        if (isNewBest) {
            ui.setStatus("New personal best!", "ok");
            ui.triggerConfetti();
        }
    };

    core.$('#stop-btn').onclick = () => stopRound(playerName, 0);
}

/**
 * Initializes the entire Shake Mode page, setting up event listeners.
 */
export function initShakePage() {
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
        const playerName = core.sanitizeName(nameInput.value);
        if (!playerName) {
            nameStatus.textContent = "Please save a valid name first.";
            nameStatus.className = "text-sm text-red-600";
            return;
        }
        
        ui.setButtonStates({ start: false, stop: true, again: false });
        try {
            await startShakeRound(playerName);
        } catch (error) {
            console.error(error);
            ui.setStatus(error.message || "Could not start motion sensors.", "bad");
            ui.setButtonStates({ start: true, stop: false, again: false });
            cleanupMotion();
        }
    };

    core.$('#again-btn').onclick = () => {
        ui.setStatus("Ready.");
        ui.setButtonStates({ start: true, stop: false, again: false });
        ui.updateMeter('acc', 0, '0.00 m/s²');
        ui.updateMeter('rot', 0, '0.0 °/s');
        ui.updateMeter('shake', 0, '0');
    };

    ui.displayOriginStatus(core.isSecureContext());
}