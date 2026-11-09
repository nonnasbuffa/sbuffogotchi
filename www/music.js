// Original chiptune background music, synthesised live so the game ships no audio files.
const Music = (() => {
  const KEY = 'sbuffogotchi.music';
  const _ = null; // A rest.
  const TRACKS = {
    home: {
      bpm: 100,
      lead: [72, _, 76, 79, 77, _, 76, 74, 72, _, 74, 76, 74, _, _, _, 69, _, 72, 76, 74, _, 72, 71, 72, _, 67, _, 72, _, _, _],
      bass: [48, 45, 41, 43],
    },
    action: {
      bpm: 138,
      lead: [67, 71, 74, 71, 79, 74, 71, 74, 72, 76, 79, 76, 74, _, 71, _, 69, 72, 76, 72, 74, 78, 81, 78, 79, _, 74, 71, 67, _, 71, 74],
      bass: [43, 48, 45, 50],
    },
    boss: {
      bpm: 156,
      lead: [69, 69, 72, 69, 76, 75, 74, 72, 65, 65, 69, 65, 74, 72, 71, 69, 64, 64, 68, 71, 76, 74, 71, 68, 69, _, 76, _, 69, 72, 71, 68],
      bass: [45, 41, 40, 45],
    },
  };

  let ctx = null, master = null, timer = null;
  let track = null, step = 0, nextAt = 0;
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* stays on */ }

  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
  function tone(midi, at, length, type, volume) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = hz(midi);
    env.gain.setValueAtTime(volume, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(env).connect(master);
    osc.start(at);
    osc.stop(at + length);
  }
  // Schedules slightly ahead of time, so timers running late can't make the beat stumble.
  function schedule() {
    if (!ctx || !track || !enabled || ctx.state !== 'running') return;
    const song = TRACKS[track];
    const eighth = 30 / song.bpm;
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
    while (nextAt < ctx.currentTime + 0.25) {
      const lead = song.lead[step % song.lead.length];
      if (lead !== _) tone(lead, nextAt, eighth * 0.95, 'square', 0.1);
      if (step % 8 === 0) tone(song.bass[(step / 8) % song.bass.length], nextAt, eighth * 3.5, 'triangle', 0.3);
      if (step % 4 === 2) tone(song.bass[Math.floor(step / 8) % song.bass.length] + 12, nextAt, eighth * 0.9, 'triangle', 0.15);
      step += 1;
      nextAt += eighth;
    }
  }
  // Browsers only allow sound after the player's first tap or key press.
  function unlock() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.5 : 0;
      master.connect(ctx.destination);
      timer = setInterval(schedule, 60);
    }
    if (ctx.state !== 'running' && !document.hidden) ctx.resume();
  }
  function play(name) {
    if (name === track) return;
    track = name;
    step = 0;
    nextAt = 0;
  }
  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* lasts until the app closes */ }
    if (master) master.gain.value = on ? 0.5 : 0;
    if (on) unlock();
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return { play, setEnabled, enabled: () => enabled, status: () => ({ track, step, state: ctx?.state ?? 'locked', timer: !!timer }) };
})();
