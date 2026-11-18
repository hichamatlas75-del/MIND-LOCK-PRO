let ctx;
export function beep(freq = 440, ms = 120, type = 'sine', vol = 0.08) {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch {}
}
