const Game = (() => {
  const SAVE_KEY = 'sbuffogotchi.save';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  const DECAY_PER_HOUR = { food: 4, energy: 3, joy: 3 };
  const CARE_COOLDOWN = 60000;
  const BOSS_EVERY = 3;
  const ANIMS = {
    idle: [500, 450, 500, 140],
    happy: [110, 70, 90, 110, 70, 60, 110, 140],
    sad: [700, 600, 180, 600],
    battle: [600, 400, 300, 400],
  };
  const BOSSES = [
    { name: 'The Sock Goblin', body: '#7fb069', dark: '#4c7a43', eye: '#ffe066' },
    { name: 'Lord Dustbunny', body: '#a9a4b8', dark: '#6f6a80', eye: '#e8604c' },
    { name: 'Count Mildew', body: '#6a8d92', dark: '#3e5c63', eye: '#f6eedd' },
    { name: 'The Remote Thief', body: '#c0597a', dark: '#7e3350', eye: '#ffe066' },
  ];

  const fresh = () => ({
    level: 1, xp: 0, str: 1, bossWins: 0,
    food: 80, energy: 80, joy: 80,
    streak: 0, lastDay: null, shields: 0,
    care: {}, tickAt: Date.now(), updatedAt: 0,
  });

  let S = fresh();
  let syncTimer = null;

  // ----- save and sync -----
  function loadLocal() {
    try { return { ...fresh(), ...JSON.parse(localStorage.getItem(SAVE_KEY)) }; } catch { return fresh(); }
  }
  function save() {
    S.updatedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 2500);
  }
  async function sync() {
    clearTimeout(syncTimer);
    try { await Cloud.push(S); } catch { /* stays on the device; retried on the next save or reconnect */ }
  }
  const progress = (s) => s.level * 1e6 + s.xp + s.str * 100 + s.bossWins * 1000;
  // Never let a stale device overwrite further progress.
  function merge(local, remote) {
    if (!remote) return local;
    const winner = progress(remote) === progress(local)
      ? (remote.updatedAt > local.updatedAt ? remote : local)
      : (progress(remote) > progress(local) ? remote : local);
    const better = remote.lastDay > local.lastDay || !local.lastDay ? remote : local;
    return { ...fresh(), ...winner, streak: better.streak, lastDay: better.lastDay, shields: better.shields };
  }

  // ----- time, needs, streak -----
  const dayNumber = (ms) => {
    const d = new Date(ms);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  };
  function tick() {
    const now = Date.now();
    const hours = Math.max(0, now - S.tickAt) / 3600000;
    for (const k in DECAY_PER_HOUR) S[k] = clamp(S[k] - DECAY_PER_HOUR[k] * hours);
    S.tickAt = now;
  }
  function checkIn() {
    const today = dayNumber(Cloud.now());
    if (S.lastDay === today) return null;
    let msg;
    if (S.lastDay === null || S.lastDay > today) { S.streak = 1; msg = 'Day 1 of your streak!'; }
    else if (today - S.lastDay === 1) { S.streak += 1; msg = `${S.streak} day streak!`; }
    else if (S.shields >= today - S.lastDay - 1) {
      S.shields -= today - S.lastDay - 1; S.streak += 1; msg = `Shield saved your streak! ${S.streak} days!`;
    } else { S.streak = Math.max(1, Math.floor(S.streak / 2)); msg = `You were away. Streak is now ${S.streak}.`; }
    if (S.streak % 7 === 0) { S.shields += 1; msg += ' +1 shield!'; }
    S.lastDay = today;
    return msg;
  }
  const xpNeeded = (lvl = S.level) => 40 + lvl * 25;
  const streakBonus = () => 1 + Math.min(S.streak, 30) * 0.02;
  function addXp(base) {
    const gain = Math.round(base * streakBonus());
    S.xp += gain;
    let up = false;
    while (S.xp >= xpNeeded()) { S.xp -= xpNeeded(); S.level += 1; up = true; }
    if (up) toast(`Level up! Now level ${S.level}`);
    return gain;
  }
  const nextBossLevel = () => (S.bossWins + 1) * BOSS_EVERY;
  const wellness = () => 0.6 + 0.4 * ((S.food + S.energy + S.joy) / 300);

  // ----- sprite animation -----
  const players = new Map();
  function play(el, name, thenIdle) {
    clearTimeout(players.get(el));
    const times = ANIMS[name];
    el.style.backgroundImage = `url(sprites/${name}_sheet.png)`;
    let i = 0;
    const step = () => {
      if (i >= times.length) {
        if (thenIdle) return play(el, thenIdle);
        i = 0;
      }
      el.style.backgroundPosition = `${-44 * i}px 0`;
      players.set(el, setTimeout(step, times[i++]));
    };
    step();
  }
  const restingAnim = () => (Math.min(S.food, S.energy, S.joy) < 25 ? 'sad' : 'idle');

  // ----- screens -----
  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === `s-${name}`));
    if (name === 'home') { render(); play($('pet'), restingAnim()); }
  }
  let toastTimer;
  function toast(msg) {
    $('toast').textContent = msg; $('toast').classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('on'), 2400);
  }
  function render() {
    tick();
    $('lvl').textContent = S.level;
    $('streak').textContent = `Streak ${S.streak}`;
    $('xpFill').style.width = `${(S.xp / xpNeeded()) * 100}%`;
    for (const k of ['food', 'energy', 'joy']) $(`b-${k}`).style.width = `${S[k]}%`;
    $('str').textContent = S.str; $('wins').textContent = S.bossWins; $('shields').textContent = S.shields;
    const u = Cloud.user();
    $('btnAccount').textContent = u ? u.name : 'Sign in';
    const lowest = Math.min(S.food, S.energy, S.joy);
    $('say').textContent = lowest >= 25 ? '' : S.food === lowest ? "I'm hungry..." : S.energy === lowest ? "I'm so tired..." : 'I feel lonely...';
    const need = nextBossLevel();
    $('btnBoss').textContent = S.level >= need ? 'BOSS FIGHT!' : `Boss at Lv ${need}`;
    $('btnBoss').disabled = S.level < need;
    $('btnTrain').disabled = S.energy < 10;
    const now = Date.now();
    for (const [id, k] of [['btnFeed', 'food'], ['btnRest', 'energy'], ['btnCheer', 'joy']]) {
      $(id).disabled = now - (S.care[k] || 0) < CARE_COOLDOWN;
    }
  }
  function care(k, amount) {
    S[k] = clamp(S[k] + amount); S.care[k] = Date.now();
    const gain = addXp(3);
    save(); render(); toast(`+${gain} XP`);
    play($('pet'), 'happy', restingAnim());
  }

  // ----- the shared timing bar -----
  function meter(root, { speed, zone }) {
    const mark = root.querySelector('.mark');
    const z = root.querySelector('.zone');
    const start = 5 + Math.random() * (90 - zone);
    z.style.left = `${start}%`; z.style.width = `${zone}%`;
    let pos = 0, dir = 1, last = performance.now(), raf;
    const loop = (t) => {
      pos += dir * speed * (t - last) / 1000; last = t;
      if (pos >= 100) { pos = 100; dir = -1; } else if (pos <= 0) { pos = 0; dir = 1; }
      mark.style.left = `calc(${pos}% - 3px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return {
      stop() {
        cancelAnimationFrame(raf);
        return pos >= start - 1 && pos <= start + zone + 1;
      },
    };
  }

  // ----- mini-game -----
  const TRAIN_ROUNDS = 8;
  let train = null;
  function startTrain() {
    tick();
    S.energy = clamp(S.energy - 10); save();
    train = { round: 0, hits: 0, m: null };
    show('train'); play($('trainPet'), 'idle');
    nextTrainRound();
  }
  function nextTrainRound() {
    $('trainInfo').textContent = `Round ${train.round + 1}/${TRAIN_ROUNDS} · Hits ${train.hits}`;
    train.m = meter($('trainMeter'), { speed: 70 + train.round * 14, zone: Math.max(10, 24 - train.round * 1.6) });
    $('btnTrainTap').disabled = false;
  }
  function trainTap() {
    if (!train?.m) return;
    const hit = train.m.stop();
    train.m = null; $('btnTrainTap').disabled = true;
    if (hit) { train.hits += 1; play($('trainPet'), 'happy', 'idle'); } else $('trainMeter').classList.add('hit');
    train.round += 1;
    setTimeout(() => {
      $('trainMeter').classList.remove('hit');
      if (train.round < TRAIN_ROUNDS) return nextTrainRound();
      const strGain = train.hits >= 7 ? 3 : train.hits >= 4 ? 2 : train.hits >= 1 ? 1 : 0;
      S.str += strGain;
      S.joy = clamp(S.joy + train.hits);
      const xp = addXp(6 + train.hits * 3);
      save(); show('home'); play($('pet'), 'happy', restingAnim());
      toast(`${train.hits}/${TRAIN_ROUNDS} hits · +${strGain} Strength · +${xp} XP`);
    }, 450);
  }

  // ----- boss -----
  let fight = null;
  function drawBoss(b) {
    const c = $('bossArt').getContext('2d');
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    c.clearRect(0, 0, 24, 24);
    px(4, 6, 16, 16, '#1b1525'); px(2, 10, 20, 11, '#1b1525'); px(7, 3, 3, 4, '#1b1525'); px(14, 3, 3, 4, '#1b1525');
    px(5, 7, 14, 14, b.body); px(3, 11, 18, 9, b.body); px(8, 4, 1, 3, b.dark); px(15, 4, 1, 3, b.dark);
    px(3, 18, 18, 2, b.dark); px(6, 20, 12, 1, b.dark);
    px(7, 10, 3, 3, b.eye); px(14, 10, 3, 3, b.eye); px(8, 11, 1, 2, '#1b1525'); px(15, 11, 1, 2, '#1b1525');
    px(6, 9, 4, 1, '#1b1525'); px(14, 9, 4, 1, '#1b1525');
    px(8, 15, 8, 2, '#1b1525'); px(9, 15, 1, 1, '#f6eedd'); px(14, 15, 1, 1, '#f6eedd');
  }
  function startBoss() {
    tick();
    const n = S.bossWins;
    const b = BOSSES[n % BOSSES.length];
    const hp = 60 + n * 45;
    const you = Math.round((50 + S.level * 5) * wellness());
    fight = { b, hp, hpMax: hp, you, youMax: you, dmg: 10 + n * 4, turn: 0, m: null };
    $('bossName').textContent = b.name;
    drawBoss(b); show('boss'); play($('fightPet'), 'battle');
    renderFight(); nextBossTurn();
  }
  function renderFight() {
    $('b-boss').style.width = `${(fight.hp / fight.hpMax) * 100}%`;
    $('b-you').style.width = `${(fight.you / fight.youMax) * 100}%`;
  }
  function nextBossTurn() {
    fight.m = meter($('bossMeter'), { speed: 85 + fight.turn * 4, zone: 20 });
    $('btnBossTap').disabled = false;
  }
  function bossTap() {
    if (!fight?.m) return;
    const hit = fight.m.stop();
    fight.m = null; $('btnBossTap').disabled = true; fight.turn += 1;
    if (hit) {
      const d = Math.round((8 + S.str * 2) * wellness());
      fight.hp = Math.max(0, fight.hp - d);
      $('bossInfo').textContent = `You hit for ${d}!`;
      $('bossArt').classList.add('hit');
    } else {
      fight.you = Math.max(0, fight.you - fight.dmg);
      $('bossInfo').textContent = `Missed! The boss hits you for ${fight.dmg}!`;
      $('fightPet').parentElement.classList.add('hit');
    }
    renderFight();
    setTimeout(() => {
      $('bossArt').classList.remove('hit'); $('fightPet').parentElement.classList.remove('hit');
      if (fight.hp <= 0) return endBoss(true);
      if (fight.you <= 0) return endBoss(false);
      nextBossTurn();
    }, 650);
  }
  function endBoss(won) {
    $('bossInfo').textContent = '';
    if (won) {
      S.bossWins += 1; S.str += 3; S.joy = clamp(S.joy + 25);
      const xp = addXp(60);
      save(); show('home'); play($('pet'), 'happy', restingAnim());
      toast(`${fight.b.name} defeated! +3 Strength · +${xp} XP`);
    } else {
      S.joy = clamp(S.joy - 10);
      const xp = addXp(8);
      save(); show('home'); play($('pet'), 'sad', restingAnim());
      toast(`She lost this time. Train and try again! +${xp} XP`);
    }
  }

  // ----- accounts -----
  async function enterGame() {
    S = loadLocal();
    if (Cloud.user()) {
      try { S = merge(S, await Cloud.pull()); } catch { toast('Offline: will sync later'); }
    }
    tick();
    const msg = checkIn();
    save(); show('home');
    if (msg) { toast(msg); play($('pet'), 'happy', restingAnim()); }
  }
  async function authAction(kind) {
    if (!$('user').value.trim() || !$('pass').value) {
      $('loginMsg').textContent = 'Type a username and password first.';
      return;
    }
    $('loginMsg').textContent = 'Connecting...';
    try {
      await Cloud[kind]($('user').value, $('pass').value);
      $('loginMsg').textContent = '';
      $('pass').value = '';
      await enterGame();
      await sync();
    } catch (e) { $('loginMsg').textContent = e.message; }
  }

  // ----- wiring -----
  $('btnFeed').onclick = () => care('food', 30);
  $('btnRest').onclick = () => care('energy', 30);
  $('btnCheer').onclick = () => care('joy', 30);
  $('btnTrain').onclick = startTrain;
  $('btnBoss').onclick = startBoss;
  $('btnTrainTap').onclick = trainTap;
  $('btnBossTap').onclick = bossTap;
  $('btnLogin').onclick = () => authAction('login');
  $('btnSignup').onclick = () => authAction('signup');
  $('btnOffline').onclick = () => { localStorage.setItem('sbuffogotchi.guest', '1'); enterGame(); };
  $('btnAccount').onclick = async () => {
    if (Cloud.user()) {
      if (!confirm('Log out of this device?')) return;
      await sync();
      Cloud.logout();
      localStorage.removeItem(SAVE_KEY);
    }
    localStorage.removeItem('sbuffogotchi.guest');
    show('login');
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); sync(); } });
  window.addEventListener('online', sync);
  setInterval(() => { if ($('s-home').classList.contains('on')) { render(); } }, 5000);

  if (Cloud.user() || localStorage.getItem('sbuffogotchi.guest')) enterGame(); else show('login');

  return { state: () => S, set: (patch) => { Object.assign(S, patch); save(); render(); }, checkIn, merge, xpNeeded, show };
})();
