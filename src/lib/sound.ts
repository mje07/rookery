// Synthesised move sounds (WebAudio) so the app ships no audio assets.
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0) {
  ctx ??= new AudioContext();
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export type SoundKind = 'move' | 'capture' | 'check' | 'success' | 'fail' | 'end';

export function playMoveSound(kind: SoundKind) {
  if (!enabled) return;
  try {
    switch (kind) {
      case 'move':
        tone(320, 0.07, 'triangle', 0.25);
        break;
      case 'capture':
        tone(220, 0.1, 'square', 0.12);
        tone(160, 0.08, 'triangle', 0.2, 0.02);
        break;
      case 'check':
        tone(520, 0.12, 'triangle', 0.2);
        break;
      case 'success':
        tone(660, 0.1, 'sine', 0.2);
        tone(880, 0.16, 'sine', 0.2, 0.09);
        break;
      case 'fail':
        tone(200, 0.2, 'sawtooth', 0.08);
        break;
      case 'end':
        tone(440, 0.15, 'sine', 0.2);
        tone(330, 0.25, 'sine', 0.2, 0.12);
        break;
    }
  } catch {
    // audio unavailable
  }
}
