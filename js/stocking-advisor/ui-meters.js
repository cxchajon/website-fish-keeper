import { state } from './state.js';

export function updateMeters() {
    updateBioloadMeter();
    updateCompatibilityMeter();
}

function updateBioloadMeter() {
    const meter = document.querySelector('.bioload-meter-fill');
    const label = document.querySelector('.bioload-meter-label');
    if (!meter || !label) return;

    const percentage = Math.min((state.currentBioload / state.maxBioload) * 100, 100);
    meter.style.width = `${percentage}%`;
    label.textContent = `${state.currentBioload.toFixed(1)} / ${state.maxBioload.toFixed(1)} Bioload Units`;
}

function updateCompatibilityMeter() {
    const meter = document.querySelector('.compatibility-meter-fill');
    const label = document.querySelector('.compatibility-meter-label');
    if (!meter || !label) return;

    const score = state.compatibilityScore;
    meter.style.width = `${score}%`;
    label.textContent = `Compatibility: ${score}%`;
}
