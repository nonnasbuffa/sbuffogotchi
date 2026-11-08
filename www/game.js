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
    { name: 'Baron Broccoli', art: 'broccoli' },
    { name: 'Sir Brussels Sprout', art: 'sprout' },
    { name: 'Count Eggplant', art: 'eggplant' },
    { name: 'General Carrot', art: 'carrot' },
  ];

  const DAILY_REWARDS = [
    { icon: 'star', label: '30 XP', xp: 30 },
    { icon: 'bolt', label: '+50 Energy', energy: 50 },
    { icon: 'dumbbell', label: '+1 Strength', str: 1 },
    { icon: 'star', label: '60 XP', xp: 60 },
    { icon: 'apple', label: 'Full refill', food: 100, energy: 100, joy: 100 },
    { icon: 'dumbbell', label: '+2 Strength', str: 2 },
    { icon: 'shield', label: '+1 Shield, 100 XP', shields: 1, xp: 100 },
  ];
  const GOLDEN_EVERY_MS = 10 * 60000;
  const GOLDEN_FADE_IN_MS = 2500;
  const GOLDEN_FADE_OUT_AT_MS = 10000;
  const GOLDEN_FADE_OUT_MS = 1500;
  const REMATCH_ENERGY = 10;
  const ATTACK_GAP_MS = 4000;
  const FIRST_HIT_MS = 700;
  const NEXT_HIT_MS = 800;
  const bossHp = (n) => (300 + n * 300 + n * n * 20) * 3;
  // Fight n is the (n+1)th boss in order; after the last one they return, tougher and numbered.
  const bossFor = (n) => {
    const b = BOSSES[n % BOSSES.length];
    const loop = Math.floor(n / BOSSES.length);
    return { ...b, name: loop ? `${b.name} ${loop + 1}` : b.name };
  };

  const fresh = () => ({
    level: 1, xp: 0, str: 1, bossWins: 0,
    food: 80, energy: 80, joy: 80,
    streak: 0, lastDay: null, shields: 0,
    care: {}, tickAt: Date.now(), updatedAt: 0,
    rewardDay: 0, lastReward: -1, nextGolden: 0,
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
    return { ...fresh(), ...winner, streak: better.streak, lastDay: better.lastDay, shields: better.shields,
      // A reward claimed on any device stays claimed everywhere.
      rewardDay: Math.max(local.rewardDay ?? 0, remote.rewardDay ?? 0),
      lastReward: Math.max(local.lastReward ?? -1, remote.lastReward ?? -1) };
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
    if (name === 'bosses') renderBossList();
    if (name === 'trainMenu') renderGameMenu('trainList', TRAINING_GAMES, TRAIN_COST);
    if (name === 'minis') renderGameMenu('miniList', MINI_GAMES, MINI_COST);
    if (name !== 'home') removeGolden();
  }
  let toastTimer;
  function toast(msg) {
    $('toast').textContent = msg; $('toast').classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('on'), 2400);
  }
  function render() {
    tick();
    $('lvl').textContent = S.level;
    $('streak').textContent = S.streak;
    $('xpFill').style.width = `${(S.xp / xpNeeded()) * 100}%`;
    for (const k of ['food', 'energy', 'joy']) $(`b-${k}`).style.width = `${S[k]}%`;
    $('str').textContent = S.str; $('wins').textContent = S.bossWins; $('shields').textContent = S.shields;
    const u = Cloud.user();
    $('btnAccount').textContent = u ? u.name : 'Sign in';
    const lowest = Math.min(S.food, S.energy, S.joy);
    $('say').textContent = lowest >= 25 ? '' : S.food === lowest ? "I'm hungry..." : S.energy === lowest ? "I'm so tired..." : 'I feel lonely...';
    const need = nextBossLevel();
    $('btnBossLabel').textContent = S.level >= need ? 'BOSS READY!' : 'Bosses';
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

  // ----- daily reward -----
  const dailyReady = () => dayNumber(Cloud.now()) > S.lastReward;
  function openDaily() {
    const today = S.rewardDay % DAILY_REWARDS.length;
    const days = $('dailyDays');
    days.textContent = '';
    DAILY_REWARDS.forEach((r, i) => {
      const tile = document.createElement('div');
      tile.className = `day${i < today ? ' done' : ''}${i === today ? ' today' : ''}`;
      const img = document.createElement('img');
      img.className = 'ic'; img.src = `sprites/icons/${r.icon}.png`; img.alt = '';
      const day = document.createElement('b');
      day.textContent = `Day ${i + 1}`;
      const label = document.createElement('span');
      label.textContent = r.label;
      tile.append(img, day, label);
      days.append(tile);
    });
    $('daily').classList.add('on');
  }
  function claimDaily() {
    if (!dailyReady()) { $('daily').classList.remove('on'); return; }
    const r = DAILY_REWARDS[S.rewardDay % DAILY_REWARDS.length];
    if (r.food) S.food = clamp(S.food + r.food);
    if (r.energy) S.energy = clamp(S.energy + r.energy);
    if (r.joy) S.joy = clamp(S.joy + r.joy);
    if (r.str) S.str += r.str;
    if (r.shields) S.shields += r.shields;
    if (r.xp) addXp(r.xp);
    S.rewardDay += 1;
    S.lastReward = dayNumber(Cloud.now());
    save();
    $('daily').classList.remove('on');
    render(); play($('pet'), 'happy', restingAnim());
    toast(`Daily reward: ${r.label}!`);
  }

  // ----- golden poke bowl -----
  let golden = null;
  function removeGolden() {
    if (golden) golden.remove();
    golden = null;
  }
  function spawnGolden() {
    removeGolden();
    S.nextGolden = Date.now() + GOLDEN_EVERY_MS;
    save();
    const el = document.createElement('img');
    el.className = 'golden'; el.src = 'sprites/golden_bowl.png'; el.alt = 'Golden poke bowl';
    el.style.left = `${8 + Math.random() * Math.max(0, innerWidth - 96)}px`;
    el.style.top = `${60 + Math.random() * Math.max(0, innerHeight - 136)}px`;
    const total = GOLDEN_FADE_OUT_AT_MS + GOLDEN_FADE_OUT_MS;
    const fade = el.animate([
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: GOLDEN_FADE_IN_MS / total },
      { opacity: 1, offset: GOLDEN_FADE_OUT_AT_MS / total },
      { opacity: 0, offset: 1 },
    ], { duration: total });
    fade.onfinish = () => { if (golden === el) removeGolden(); };
    el.onpointerdown = (e) => { e.preventDefault(); collectGolden(); };
    document.body.append(el);
    golden = el;
  }
  function collectGolden() {
    removeGolden();
    const xp = addXp(25);
    S.joy = clamp(S.joy + 10); S.food = clamp(S.food + 10);
    save(); render(); play($('pet'), 'happy', restingAnim());
    toast(`Golden poke bowl! +${xp} XP · +10 Joy · +10 Food`);
  }
  function homeTimers() {
    if (!$('s-home').classList.contains('on') || $('daily').classList.contains('on')) return;
    if (dailyReady()) return openDaily();
    if (!S.nextGolden) { S.nextGolden = Date.now() + GOLDEN_EVERY_MS; save(); return; }
    if (!golden && Date.now() >= S.nextGolden) spawnGolden();
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
    payEnergy(TRAIN_COST);
    train = { round: 0, hits: 0, m: null };
    show('train'); play($('trainPet'), 'idle');
    nextTrainRound();
  }
  function nextTrainRound() {
    $('trainInfo').textContent = `Round ${train.round + 1}/${TRAIN_ROUNDS} · Wrapped ${train.hits}`;
    train.m = meter($('trainMeter'), { speed: 70 + train.round * 14, zone: Math.max(10, 24 - train.round * 1.6) });
    $('btnTrainTap').disabled = false;
  }
  function trainTap() {
    if (!train?.m) return;
    const hit = train.m.stop();
    train.m = null; $('btnTrainTap').disabled = true;
    const leaves = $('trainMeter').querySelector('.zone');
    if (hit) {
      train.hits += 1; play($('trainPet'), 'happy', 'idle');
      leaves.style.setProperty('--shut', `${leaves.offsetWidth / 2}px`);
      leaves.classList.add('shut');
    } else $('trainMeter').classList.add('hit');
    train.round += 1;
    setTimeout(() => {
      $('trainMeter').classList.remove('hit'); leaves.classList.remove('shut');
      if (train.round < TRAIN_ROUNDS) return nextTrainRound();
      finishTraining(train.hits, TRAIN_ROUNDS, 'wrapped');
    }, 450);
  }

  // ----- training menu and shared results -----
  const TRAIN_COST = 10;
  const MINI_COST = 5;
  function payEnergy(cost) {
    tick();
    S.energy = clamp(S.energy - cost);
    save();
  }
  function finishTraining(hits, total, word) {
    const part = total ? hits / total : 0;
    const strGain = part >= 0.85 ? 3 : part >= 0.5 ? 2 : part > 0 ? 1 : 0;
    S.str += strGain;
    S.joy = clamp(S.joy + Math.round(part * 8));
    const xp = addXp(6 + Math.round(part * 8) * 3);
    save(); show('home'); play($('pet'), 'happy', restingAnim());
    toast(`${hits}/${total} ${word} · +${strGain} Strength · +${xp} XP`);
  }
  function menuRow(list, game, cost) {
    const row = document.createElement('div');
    row.className = 'bossRow';
    const img = document.createElement('img');
    img.src = game.art; img.alt = '';
    const text = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = game.name;
    const about = document.createElement('span');
    about.className = 'dim'; about.textContent = game.about;
    text.append(title, about);
    const go = document.createElement('button');
    go.textContent = 'Play'; go.className = 'main';
    go.disabled = S.energy < cost;
    go.onclick = game.start;
    row.append(img, text, go);
    list.append(row);
  }
  function renderGameMenu(listId, games, cost) {
    tick();
    const list = $(listId);
    list.textContent = '';
    games.forEach((game) => menuRow(list, game, cost));
  }

  // ----- Veggie Whack -----
  const WHACK_POPS = 18;
  let whack = null;
  function startWhack() {
    payEnergy(TRAIN_COST);
    const grid = $('whackGrid');
    grid.textContent = '';
    for (let i = 0; i < 9; i++) {
      const hole = document.createElement('button');
      hole.className = 'hole';
      hole.onpointerdown = (e) => { e.preventDefault(); whackTap(i); };
      grid.append(hole);
    }
    whack = { pops: 0, veggies: 0, hits: 0, cell: -1, bowl: false, timer: null };
    show('whack'); whackInfo();
    whack.timer = setTimeout(whackPop, 500);
  }
  function whackInfo(note) {
    $('whackInfo').textContent = note || `Whacked ${whack.hits}`;
  }
  function whackClear() {
    if (whack.cell >= 0) $('whackGrid').children[whack.cell].textContent = '';
    whack.cell = -1;
  }
  function whackPop() {
    if (whack.pops >= WHACK_POPS) return finishTraining(whack.hits, whack.veggies, 'whacked');
    let cell;
    do { cell = Math.floor(Math.random() * 9); } while (cell === whack.last);
    whack.last = cell; whack.cell = cell; whack.pops += 1;
    whack.bowl = Math.random() < 0.2;
    if (!whack.bowl) whack.veggies += 1;
    const img = document.createElement('img');
    img.alt = '';
    img.src = whack.bowl ? 'sprites/icons/bowl.png' : `sprites/boss_${BOSSES[Math.floor(Math.random() * BOSSES.length)].art}.png`;
    $('whackGrid').children[cell].append(img);
    whack.timer = setTimeout(() => {
      whackClear();
      whack.timer = setTimeout(whackPop, 180);
    }, Math.max(520, 1100 - whack.pops * 34));
  }
  function whackTap(i) {
    if (!whack || i !== whack.cell) return;
    clearTimeout(whack.timer);
    if (whack.bowl) {
      whack.hits = Math.max(0, whack.hits - 1);
      whackInfo('Not the poke bowl! -1');
    } else {
      whack.hits += 1;
      whackInfo();
    }
    whackClear();
    whack.timer = setTimeout(whackPop, 180);
  }

  // ----- Order Up -----
  const ORDER_ROUNDS = 6;
  const ORDER_ITEMS = ['salmon', 'avocado', 'shrimp', 'edamame'];
  let order = null;
  const randomItem = () => Math.floor(Math.random() * ORDER_ITEMS.length);
  function startOrder() {
    payEnergy(TRAIN_COST);
    const pads = $('orderPads');
    pads.textContent = '';
    ORDER_ITEMS.forEach((item, i) => {
      const pad = document.createElement('button');
      pad.className = 'pad';
      const img = document.createElement('img');
      img.src = `sprites/icons/${item}.png`; img.alt = item;
      pad.append(img);
      pad.onpointerdown = (e) => { e.preventDefault(); orderTap(i); };
      pads.append(pad);
    });
    order = { round: 0, seq: [randomItem()], at: 0, taking: false };
    show('order');
    nextOrderRound();
  }
  function flashPad(i, ms) {
    const pad = $('orderPads').children[i];
    pad.classList.add('lit');
    setTimeout(() => pad.classList.remove('lit'), ms);
  }
  function nextOrderRound() {
    order.seq.push(randomItem());
    order.at = 0; order.taking = false;
    $('orderInfo').textContent = `Order ${order.round + 1}/${ORDER_ROUNDS}: watch!`;
    const lit = Math.max(280, 460 - order.round * 30);
    order.seq.forEach((item, i) => setTimeout(() => flashPad(item, lit), 500 + i * (lit + 180)));
    setTimeout(() => {
      order.taking = true;
      $('orderInfo').textContent = `Order ${order.round + 1}/${ORDER_ROUNDS}: your turn!`;
    }, 500 + order.seq.length * (lit + 180));
  }
  function orderTap(i) {
    if (!order?.taking) return;
    flashPad(i, 130);
    if (i !== order.seq[order.at]) {
      order.taking = false;
      $('orderInfo').textContent = 'Wrong ingredient!';
      setTimeout(() => finishTraining(order.round, ORDER_ROUNDS, 'orders'), 800);
      return;
    }
    order.at += 1;
    if (order.at < order.seq.length) return;
    order.taking = false;
    order.round += 1;
    $('orderInfo').textContent = 'Order complete!';
    if (order.round >= ORDER_ROUNDS) setTimeout(() => finishTraining(order.round, ORDER_ROUNDS, 'orders'), 600);
    else setTimeout(nextOrderRound, 700);
  }

  // ----- canvas minigames -----
  const MINI_W = 320;
  const MINI_H = 440;
  const art = (src) => { const i = new Image(); i.src = src; return i; };
  const ART = {
    pizza: art('sprites/pizza.png'), rice: art('sprites/rice.png'),
    bowl: art('sprites/poke_bowl.png'), broccoli: art('sprites/boss_broccoli.png'),
  };
  let mini = null;
  function startMini(title, game) {
    payEnergy(MINI_COST);
    $('miniTitle').textContent = title;
    mini = { ...game, pointerX: MINI_W / 2, raf: 0, last: performance.now() };
    mini.begin(mini);
    show('mini');
    mini.raf = requestAnimationFrame(miniLoop);
  }
  function miniLoop(t) {
    if (!mini) return;
    const dt = Math.min(0.05, (t - mini.last) / 1000);
    mini.last = t;
    mini.update(mini, dt);
    if (!mini) return;
    const c = $('miniCanvas').getContext('2d');
    c.imageSmoothingEnabled = false;
    mini.draw(mini, c);
    mini.raf = requestAnimationFrame(miniLoop);
  }
  function stopMini() {
    if (mini) cancelAnimationFrame(mini.raf);
    mini = null;
  }
  function finishMini(joy, baseXp, message) {
    stopMini();
    S.joy = clamp(S.joy + joy);
    const xp = addXp(baseXp);
    save(); show('home'); play($('pet'), 'happy', restingAnim());
    toast(`${message} +${joy} Joy · +${xp} XP`);
  }
  function miniPointer(e) {
    if (!mini) return;
    e.preventDefault();
    const r = $('miniCanvas').getBoundingClientRect();
    mini.pointerX = ((e.clientX - r.left) / r.width) * MINI_W;
  }

  // ----- Pizza Pong -----
  const PONG_WIN = 5;
  const PIZZA_R = 34;
  const RICE_R = 6;
  function pongServe(g, towardPlayer) {
    const speed = 200;
    const angle = (Math.random() - 0.5) * 1.1;
    g.ball = { x: MINI_W / 2, y: MINI_H / 2, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed * (towardPlayer ? 1 : -1) };
    g.wait = 0.8;
  }
  function pongBounce(ball, px, py) {
    const dx = ball.x - px, dy = ball.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist >= PIZZA_R + RICE_R || dist === 0) return false;
    const nx = dx / dist, ny = dy / dist;
    if (ball.vx * nx + ball.vy * ny >= 0) return false;
    const speed = Math.min(460, Math.hypot(ball.vx, ball.vy) * 1.06);
    // Hitting nearer the pizza's edge sends the rice out at a sharper angle.
    const up = Math.sign(ny) || 1;
    const vx = nx * speed;
    const vy = up * Math.max(speed * 0.45, Math.abs(ny) * speed);
    const scale = speed / Math.hypot(vx, vy);
    ball.vx = vx * scale; ball.vy = vy * scale;
    ball.x = px + nx * (PIZZA_R + RICE_R); ball.y = py + ny * (PIZZA_R + RICE_R);
    return true;
  }
  const PIZZA_PONG = {
    begin(g) {
      g.you = 0; g.cpu = 0; g.px = MINI_W / 2; g.cx = MINI_W / 2;
      g.py = MINI_H - 30; g.cy = 30;
      pongServe(g, true);
      $('miniInfo').textContent = 'You 0 - 0 CPU';
    },
    update(g, dt) {
      g.px = Math.max(PIZZA_R, Math.min(MINI_W - PIZZA_R, g.pointerX));
      if (g.wait > 0) { g.wait -= dt; return; }
      const b = g.ball;
      const aim = b.vy < 0 ? b.x : MINI_W / 2;
      const reach = (120 + g.you * 18) * dt;
      g.cx += Math.max(-reach, Math.min(reach, aim - g.cx));
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < RICE_R) { b.x = RICE_R; b.vx = Math.abs(b.vx); }
      if (b.x > MINI_W - RICE_R) { b.x = MINI_W - RICE_R; b.vx = -Math.abs(b.vx); }
      pongBounce(b, g.px, g.py);
      pongBounce(b, g.cx, g.cy);
      if (b.y < -12 || b.y > MINI_H + 12) {
        const youScored = b.y < 0;
        if (youScored) g.you += 1; else g.cpu += 1;
        $('miniInfo').textContent = `You ${g.you} - ${g.cpu} CPU`;
        if (g.you >= PONG_WIN) return finishMini(15, 20, 'You won Pizza Pong!');
        if (g.cpu >= PONG_WIN) return finishMini(5, 5, 'The CPU won Pizza Pong.');
        pongServe(g, !youScored);
      }
    },
    draw(g, c) {
      c.fillStyle = '#2f6b58'; c.fillRect(0, 0, MINI_W, MINI_H);
      c.fillStyle = '#f6eedd';
      for (let x = 4; x < MINI_W; x += 24) c.fillRect(x, MINI_H / 2 - 2, 14, 4);
      const size = PIZZA_R * 2;
      c.drawImage(ART.pizza, g.cx - PIZZA_R, g.cy - PIZZA_R, size, size);
      c.drawImage(ART.pizza, g.px - PIZZA_R, g.py - PIZZA_R, size, size);
      c.save();
      c.translate(g.ball.x, g.ball.y);
      c.rotate(Math.atan2(g.ball.vy, g.ball.vx));
      c.drawImage(ART.rice, -12, -7.5, 24, 15);
      c.restore();
    },
  };

  // ----- Rice Catch -----
  const CATCH_SECONDS = 30;
  const CATCH_LIVES = 3;
  const RICE_CATCH = {
    begin(g) {
      g.score = 0; g.lives = CATCH_LIVES; g.time = CATCH_SECONDS; g.items = []; g.spawn = 0.3; g.bx = MINI_W / 2;
      this.info(g);
    },
    info(g) {
      $('miniInfo').textContent = `Rice ${g.score} · Lives ${g.lives} · ${Math.ceil(g.time)}s`;
    },
    end(g) {
      const joy = Math.min(15, Math.floor(g.score / 2));
      const xp = Math.min(25, g.score);
      finishMini(joy, xp, `You caught ${g.score} rice!`);
    },
    update(g, dt) {
      g.time -= dt;
      g.bx = Math.max(40, Math.min(MINI_W - 40, g.pointerX));
      g.spawn -= dt;
      const pace = 1 - g.time / CATCH_SECONDS;
      if (g.spawn <= 0) {
        g.spawn = 0.62 - pace * 0.32;
        g.items.push({ x: 20 + Math.random() * (MINI_W - 40), y: -20, bad: Math.random() < 0.15 + pace * 0.15, speed: 130 + pace * 130 });
      }
      for (const item of g.items) item.y += item.speed * dt;
      const caught = g.items.filter((i) => i.y > MINI_H - 66 && i.y < MINI_H - 20 && Math.abs(i.x - g.bx) < 44);
      for (const item of caught) { if (item.bad) g.lives -= 1; else g.score += 1; }
      g.items = g.items.filter((i) => !caught.includes(i) && i.y < MINI_H + 30);
      this.info(g);
      if (g.time <= 0 || g.lives <= 0) this.end(g);
    },
    draw(g, c) {
      c.fillStyle = '#efe6d4'; c.fillRect(0, 0, MINI_W, MINI_H);
      c.fillStyle = '#c9a77f'; c.fillRect(0, MINI_H - 30, MINI_W, 30);
      for (const item of g.items) {
        if (item.bad) c.drawImage(ART.broccoli, item.x - 20, item.y - 20, 40, 40);
        else c.drawImage(ART.rice, item.x - 12, item.y - 7.5, 24, 15);
      }
      c.drawImage(ART.bowl, 0, 0, 20, 14, g.bx - 40, MINI_H - 66, 80, 56);
    },
  };

  const TRAINING_GAMES = [
    { name: 'Rice Wrap', about: 'Tap when the rice is between the leaves.', art: 'sprites/icons/rice.png', start: () => startTrain() },
    { name: 'Veggie Whack', about: 'Tap the vegetables, not the bowls.', art: 'sprites/boss_broccoli.png', start: () => startWhack() },
    { name: 'Order Up', about: 'Remember the order of the ingredients.', art: 'sprites/icons/salmon.png', start: () => startOrder() },
  ];
  const MINI_GAMES = [
    { name: 'Pizza Pong', about: 'Rally the rice with your pizza. First to 5.', art: 'sprites/pizza.png', start: () => startMini('Pizza Pong', PIZZA_PONG) },
    { name: 'Rice Catch', about: 'Catch the rice, dodge the broccoli.', art: 'sprites/icons/bowl.png', start: () => startMini('Rice Catch', RICE_CATCH) },
  ];

  // ----- boss -----
  let fight = null;
  function renderBossList() {
    tick();
    const list = $('bossList');
    list.textContent = '';
    const rows = Math.max(BOSSES.length, S.bossWins + 1);
    for (let n = 0; n < rows; n++) {
      const beaten = n < S.bossWins;
      const unlocked = n === S.bossWins && S.level >= (n + 1) * BOSS_EVERY;
      const known = beaten || n === S.bossWins;
      const b = bossFor(n);
      const row = document.createElement('div');
      row.className = `bossRow${known ? '' : ' locked'}`;
      const img = document.createElement('img');
      img.src = `sprites/boss_${b.art}.png`; img.alt = '';
      const text = document.createElement('div');
      const title = document.createElement('b');
      title.textContent = known ? b.name : '???';
      const status = document.createElement('span');
      status.className = 'dim';
      status.textContent = beaten ? 'Beaten' : `Level ${(n + 1) * BOSS_EVERY}`;
      text.append(title, status);
      const go = document.createElement('button');
      if (beaten) {
        go.textContent = 'Rematch';
        go.disabled = S.energy < REMATCH_ENERGY;
      } else {
        go.textContent = unlocked ? 'FIGHT!' : 'Locked';
        go.disabled = !unlocked;
        if (unlocked) go.className = 'boss';
      }
      go.onclick = () => startBoss(n);
      row.append(img, text, go);
      list.append(row);
    }
  }
  function startBoss(n) {
    tick();
    const rematch = n < S.bossWins;
    if (rematch) { S.energy = clamp(S.energy - REMATCH_ENERGY); save(); }
    const b = bossFor(n);
    const hp = bossHp(n);
    const you = Math.round((80 + S.level * 10) * wellness());
    fight = {
      b, hp, hpMax: hp, you, youMax: you, rematch, phase: 'fight', timer: null,
      tapDamage: Math.max(1, Math.round((2 + S.str * 0.5) * wellness())),
      hits: Math.min(2 + n, 5), hitDamage: 4 + n * 2, bowlNeed: 6 + Math.min(n, 4) * 2,
      hitsLeft: 0, bites: 0,
    };
    $('bossName').textContent = b.name;
    $('bossArt').src = `sprites/boss_${b.art}.png`;
    $('bowl').classList.remove('on');
    setFightButton();
    $('bossInfo').textContent = 'Spam to attack!';
    show('boss'); play($('fightPet'), 'battle');
    renderFight(); queueBossAttack();
  }
  function renderFight() {
    $('b-boss').style.width = `${(fight.hp / fight.hpMax) * 100}%`;
    $('b-you').style.width = `${(fight.you / fight.youMax) * 100}%`;
  }
  function setFightButton() {
    const eating = fight.phase === 'bowl';
    $('btnBossTap').textContent = eating ? 'EAT!' : 'ATTACK!';
    $('btnBossTap').className = eating ? 'main' : 'boss';
  }
  function queueBossAttack() {
    clearTimeout(fight.timer);
    fight.timer = setTimeout(startBossAttack, ATTACK_GAP_MS + Math.random() * 2000);
  }
  function startBossAttack() {
    fight.phase = 'bowl'; fight.hitsLeft = fight.hits; fight.bites = 0;
    $('bowl').style.backgroundPositionX = '0';
    $('bowl').classList.add('on');
    setFightButton();
    $('bossInfo').textContent = `${fight.b.name} is attacking! Spam to eat the poke bowl!`;
    fight.timer = setTimeout(bossStrike, FIRST_HIT_MS);
  }
  function bossStrike() {
    fight.hitsLeft -= 1;
    fight.you = Math.max(0, fight.you - fight.hitDamage);
    $('bossArt').animate([{ translate: '0' }, { translate: '-46px' }, { translate: '0' }], { duration: 220 });
    $('fightPet').parentElement.animate([{ translate: '0' }, { translate: '-8px' }, { translate: '8px' }, { translate: '0' }], { duration: 220 });
    renderFight();
    if (fight.you <= 0) return endBoss(false);
    if (fight.hitsLeft > 0) { fight.timer = setTimeout(bossStrike, NEXT_HIT_MS); return; }
    finishBossAttack(false);
  }
  function finishBossAttack(ate) {
    clearTimeout(fight.timer);
    fight.phase = 'fight';
    setFightButton();
    if (ate) {
      $('bowl').style.backgroundPositionX = '100%';
      setTimeout(() => $('bowl').classList.remove('on'), 300);
      play($('fightPet'), 'happy', 'battle');
      $('bossInfo').textContent = fight.hitsLeft ? `Yum! That blocked ${fight.hitsLeft} more hit${fight.hitsLeft > 1 ? 's' : ''}!` : 'Yum! She finished the bowl.';
    } else {
      $('bowl').classList.remove('on');
      $('bossInfo').textContent = 'Spam to attack!';
    }
    queueBossAttack();
  }
  function bossTap(e) {
    e.preventDefault();
    if (!fight || fight.phase === 'over' || !$('s-boss').classList.contains('on')) return;
    if (fight.phase === 'bowl') {
      fight.bites += 1;
      const frame = Math.min(2, Math.floor((fight.bites / fight.bowlNeed) * 3));
      $('bowl').style.backgroundPositionX = `${(frame / 3) * 100}%`;
      if (fight.bites >= fight.bowlNeed) finishBossAttack(true);
      return;
    }
    fight.hp = Math.max(0, fight.hp - fight.tapDamage);
    const num = document.createElement('span');
    num.className = 'hitNum'; num.textContent = fight.tapDamage;
    num.onanimationend = () => num.remove();
    $('bossArt').parentElement.append(num);
    $('bossArt').animate([{ translate: '0' }, { translate: '5px' }, { translate: '0' }], { duration: 90 });
    renderFight();
    if (fight.hp <= 0) endBoss(true);
  }
  function endBoss(won) {
    clearTimeout(fight.timer);
    fight.phase = 'over';
    $('bowl').classList.remove('on');
    $('bossInfo').textContent = '';
    if (fight.rematch) {
      if (won) { S.str += 1; S.joy = clamp(S.joy + 5); }
      const xp = addXp(won ? 20 : 4);
      save(); show('home'); play($('pet'), won ? 'happy' : 'sad', restingAnim());
      toast(won ? `${fight.b.name} beaten again! +1 Strength · +${xp} XP` : `${fight.b.name} won the rematch. +${xp} XP`);
    } else if (won) {
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
    homeTimers();
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
  $('btnTrain').onclick = () => show('trainMenu');
  $('btnMinis').onclick = () => show('minis');
  document.querySelectorAll('[data-home]').forEach((b) => { b.onclick = () => show('home'); });
  $('btnMiniQuit').onclick = () => { stopMini(); show('minis'); };
  $('miniCanvas').onpointerdown = miniPointer;
  $('miniCanvas').onpointermove = miniPointer;
  $('btnBoss').onclick = () => show('bosses');
  $('btnBossBack').onclick = () => show('home');
  $('btnTrainTap').onclick = trainTap;
  $('trainMeter').onclick = trainTap;
  $('btnBossTap').onpointerdown = bossTap;
  document.querySelector('.fight').onpointerdown = bossTap;
  $('btnClaim').onclick = claimDaily;
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
  setInterval(homeTimers, 1000);
  setInterval(() => { if ($('s-home').classList.contains('on')) { render(); } }, 5000);

  if (Cloud.user() || localStorage.getItem('sbuffogotchi.guest')) enterGame(); else show('login');

  return { state: () => S, set: (patch) => { Object.assign(S, patch); save(); render(); }, checkIn, merge, xpNeeded, show, spawnGolden, mini: () => mini };
})();
