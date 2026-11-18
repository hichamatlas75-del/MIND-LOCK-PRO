import { getSettings } from '../core/settings.js';
export const hapticsSupported = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;
export function vibrate(pattern = 10) {
  if (hapticsSupported() && getSettings().vibration) { try { navigator.vibrate(pattern); } catch {} }
}
