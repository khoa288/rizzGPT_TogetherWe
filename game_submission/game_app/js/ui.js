/**
 * @fileoverview UI management for TogetherWe game pages.
 * Handles DOM updates, animations, and user feedback.
 */
import { $ } from './core.js';

/**
 * Sets the main status message on the page.
 * @param {string} text The message to display.
 * @param {'ok' | 'warn' | 'bad' | 'muted'} level The message level for styling.
 */
export function setStatus(text, level = 'muted') {
    const statusEl = $('#status-text');
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'text-center min-h-[1.5rem] ';
    switch (level) {
        case 'ok': statusEl.classList.add('text-emerald-600'); break;
        case 'warn': statusEl.classList.add('text-yellow-600'); break;
        case 'bad': statusEl.classList.add('text-red-600'); break;
        default: statusEl.classList.add('text-slate-500'); break;
    }
}

/**
 * Updates a meter bar and its text value.
 * @param {string} name The base name of the meter (e.g., 'rms', 'joy').
 * @param {number} percentage The value for the bar width (0-100).
 * @param {string} text The text to display next to the bar.
 */
export function updateMeter(name, percentage, text) {
    const bar = $(`#${name}-bar`);
    const txt = $(`#${name}-txt`);
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    if (txt) txt.textContent = text;
}

/**
 * Manages the enabled/disabled state of game control buttons.
 * @param {{start?: boolean, stop?: boolean, again?: boolean}} states 
 */
export function setButtonStates({ start, stop, again }) {
    if ($('#start-btn')) $('#start-btn').disabled = !start;
    if ($('#stop-btn')) $('#stop-btn').disabled = !stop;
    if ($('#again-btn')) $('#again-btn').disabled = !again;
}

/**
 * Displays the origin/security status line.
 * @param {boolean} isSecure Whether the context is secure.
 * @param {string | undefined} permStatus An optional permission status to show.
 */
export function displayOriginStatus(isSecure, permStatus) {
    const statusEl = $('#origin-status');
    if (!statusEl) return;
    const secureText = isSecure ? '✅ Secure' : '❌ Insecure';
    const originText = `Origin: ${location.origin}`;
    const permText = permStatus ? `· Perm: ${permStatus}` : '';
    statusEl.textContent = `${secureText} · ${originText} ${permText}`;
    statusEl.classList.toggle('text-red-500', !isSecure);
}

/**
 * Appends a message to the debug log area.
 * @param {string} message The message to log.
 */
export function logDebug(message) {
    const logEl = $('#log-output');
    if (logEl) {
        logEl.textContent += `${message}\n`;
        logEl.scrollTop = logEl.scrollHeight;
    }
}

/**
 * Creates a confetti burst effect for high scores.
 * Respects prefers-reduced-motion.
 */
export function triggerConfetti() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const container = $('#confetti-container');
    if (!container) return;

    const confettiCount = 50;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < confettiCount; i++) {
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute;
            width: 10px;
            height: 10px;
            background-image: url('./assets/confetti.svg');
            background-repeat: no-repeat;
            background-size: contain;
            top: 50%;
            left: 50%;
            opacity: 0;
            transform: translate(-50%, -50%) rotate(${Math.random() * 360}deg);
            animation: fly 4s ease-out forwards;
        `;
        const delay = Math.random() * 0.2;
        const x = (Math.random() - 0.5) * window.innerWidth;
        const y = (Math.random() - 0.7) * window.innerHeight;

        el.style.setProperty('--x-final', `${x}px`);
        el.style.setProperty('--y-final', `${y}px`);
        el.style.animationDelay = `${delay}s`;
        fragment.appendChild(el);
    }
    container.appendChild(fragment);

    // Clean up after animation
    setTimeout(() => {
        container.innerHTML = '';
    }, 4000);

    // Add keyframes to the document if not already present
    if (!document.getElementById('confetti-styles')) {
        const style = document.createElement('style');
        style.id = 'confetti-styles';
        style.innerHTML = `
            @keyframes fly {
                0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(0.5); }
                100% { opacity: 0; transform: translate(var(--x-final), var(--y-final)) rotate(720deg) scale(1.2); }
            }
        `;
        document.head.appendChild(style);
    }
}