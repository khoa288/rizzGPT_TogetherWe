/**
 * @fileoverview Renders the leaderboards on the scoreboard page.
 */
import { loadScores, timeAgo, escapeHtml } from './core.js';

/**
 * Renders a scoreboard table for a given mode.
 * @param {'laugh' | 'shake'} mode The game mode to render.
 */
function renderScoreboard(mode) {
    const scores = loadScores(mode);
    const tbody = document.getElementById(`${mode}-scores-body`);
    if (!tbody) return;

    if (scores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500">Play a round to see your scores!</td></tr>`;
        return;
    }

    const rowsHtml = scores.map((entry, index) => {
        return `
            <tr class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                <td class="p-2 font-medium text-slate-500 text-center">${index + 1}</td>
                <td class="p-2 font-semibold text-slate-800">${escapeHtml(entry.name)}</td>
                <td class="p-2 font-mono text-right text-indigo-600">${entry.score}</td>
                <td class="p-2 font-mono text-right text-slate-500">${timeAgo(entry.ts)}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    renderScoreboard('laugh');
    renderScoreboard('shake');
});