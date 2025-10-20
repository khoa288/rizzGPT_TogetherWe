/**
 * @fileoverview Shared utilities for the TogetherWe game.
 * Includes DOM helpers, storage functions, sanitizers, and constants.
 */

// --- Constants ---
export const LAUGH_SCORE_KEY = 'scores_laugh';
export const SHAKE_SCORE_KEY = 'scores_shake';
export const PLAYER_NAME_KEY = 'playerName';

// MediaPipe Model & CDN URLs
export const MP_JSDELIVR_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.20";
export const MP_UNPKG_URL = "https://unpkg.com/@mediapipe/tasks-audio@0.10.20";
export const MP_WASM_DIR = "/wasm";
export const YAMNET_MODEL_PRIMARY_URL = "https://tfhub.dev/google/lite-model/yamnet/classification/tflite/1?lite-format=tflite";
export const YAMNET_MODEL_FALLBACK_URL = "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite";

// --- DOM Utilities ---

/**
 * A simple querySelector alias.
 * @param {string} selector The CSS selector.
 * @returns {HTMLElement | null}
 */
export const $ = (selector) => document.querySelector(selector);

/**
 * Checks for a secure context (HTTPS or localhost).
 * @returns {boolean} True if the context is secure.
 */
export const isSecureContext = () => window.isSecureContext || location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";

// --- Math & String Utilities ---

/**
 * Clamps a number between a min and max value.
 * @param {number} value The number to clamp.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {number} The clamped number.
 */
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Escapes HTML to prevent XSS.
 * @param {string} str The string to escape.
 * @returns {string} The escaped string.
 */
export const escapeHtml = (str) => {
    return (str || "").replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
};

/**
 * Converts a timestamp to a "time ago" string.
 * @param {number} ts The timestamp in milliseconds.
 * @returns {string} The relative time string (e.g., "5m ago").
 */
export const timeAgo = (ts) => {
    const seconds = Math.floor((Date.now() - (ts || 0)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

/**
 * Sanitizes a player name to ensure it's safe.
 * @param {string} name The proposed name.
 * @returns {string} The sanitized name, or an empty string if invalid.
 */
export const sanitizeName = (name) => {
    const s = (name || "").trim();
    return /^[A-Za-z0-9_ ]{1,16}$/.test(s) ? s : "";
};

// --- Local Storage Management ---

/**
 * Loads scores for a given mode from localStorage.
 * @param {'laugh' | 'shake'} mode The game mode.
 * @returns {Array<{name: string, score: number, ts: number}>} The array of scores.
 */
export const loadScores = (mode) => {
    try {
        const key = mode === 'laugh' ? LAUGH_SCORE_KEY : SHAKE_SCORE_KEY;
        return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
        console.error("Failed to load scores:", e);
        return [];
    }
};

/**
 * Saves a score for a given mode, keeping only the top 10.
 * @param {'laugh' | 'shake'} mode The game mode.
 * @param {string} name The player's name.
 * @param {number} score The player's score.
 * @returns {boolean} True if this score is a new personal best.
 */
export const saveScore = (mode, name, score) => {
    const scores = loadScores(mode);
    const personalBest = scores.length > 0 ? scores[0].score : 0;
    
    scores.push({ name, score, ts: Date.now() });
    scores.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    const top10 = scores.slice(0, 10);
    const key = mode === 'laugh' ? LAUGH_SCORE_KEY : SHAKE_SCORE_KEY;
    localStorage.setItem(key, JSON.stringify(top10));

    return score > personalBest;
};