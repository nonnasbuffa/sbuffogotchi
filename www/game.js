const Game = (() => {
  const t = I18n.t;
  const SAVE_KEY = 'sbuffogotchi.save';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  // She dies at 0 Food or 0 Energy, so a full bar lasts about two days of Food and four of Energy.
  const DECAY_PER_HOUR = { food: 2, energy: 1, joy: 3 };
  const PET_JOY = 3;
  const PET_GAP_MS = 300;
  const FEED_JOY = 10;
  const BOSS_EVERY = 3;
  const ANIMS = {
    idle: [500, 450, 500, 140],
    happy: [110, 70, 90, 110, 70, 60, 110, 140],
    sad: [700, 600, 180, 600],
    battle: [600, 400, 300, 400],
  };
  const BOSSES = [
    { key: 'bossBroccoli', art: 'broccoli' },
    { key: 'bossSprout', art: 'sprout' },
    { key: 'bossEggplant', art: 'eggplant' },
    { key: 'bossCarrot', art: 'carrot' },
  ];

  // Food and energy now only come from items, so the daily rewards hand some out.
  const ITEMS = {
    pokebowl: { key: 'itemPokebowl', icon: 'sprites/icons/bowl.png', stat: 'food', amount: 30, weight: 2 },
    pizza: { key: 'itemPizza', icon: 'sprites/pizza.png', stat: 'food', amount: 20, weight: 3 },
    popsicle: { key: 'itemPopsicle', icon: 'sprites/icons/popsicle.png', stat: 'food', amount: 10, weight: 4 },
    phone: { key: 'itemPhone', icon: 'sprites/icons/phone.png', stat: 'energy', amount: 15, weight: 3 },
    monster: { key: 'itemMonster', icon: 'sprites/icons/monster.png', stat: 'energy', amount: 30, weight: 1.5 },
    // Only ever found by beating bosses; see rollDiamond.
    diamond: { key: 'itemDiamond', icon: 'sprites/icons/diamond.png', weight: 0 },
  };
  const DAILY_REWARDS = [
    { icon: 'star', xp: 30 },
    { icon: 'phone', items: { phone: 2 } },
    { icon: 'dumbbell', str: 1 },
    { icon: 'star', xp: 60 },
    { icon: 'bowl', items: { pokebowl: 1, monster: 1 } },
    { icon: 'dumbbell', str: 2 },
    { icon: 'bowl', items: { pokebowl: 2 }, xp: 100 },
  ];
  const dailyLabel = (r) => {
    const parts = [];
    if (r.xp) parts.push(t('plusXp', { n: r.xp }));
    if (r.str) parts.push(t('plusStr', { n: r.str }));
    if (r.items) parts.push(itemsText(r.items));
    return parts.join(', ');
  };
  // What the shop pays in Poken for each item. CD prices live in cds.js.
  const SELL_PRICES = { popsicle: 150, pizza: 400, pokebowl: 750, phone: 100, monster: 300, diamond: 5000 };
  // Looks for her, bought in the shop. Each skin folder has the same four sheets as the normal pet.
  const SKINS = [
    { id: 'default', key: 'skinDefault', icon: 'sprites/skins/default_icon.png', dir: 'sprites', back: 'sprites/wipeuff/back_default.png', price: 0 },
    { id: 'boxer', key: 'skinBoxer', icon: 'sprites/skins/boxer/icon.png', dir: 'sprites/skins/boxer', back: 'sprites/wipeuff/back_boxer.png', price: 10000 },
    { id: 'ziapuzza', key: 'skinZiaPuzza', icon: 'sprites/skins/ziapuzza/icon.png', dir: 'sprites/skins/ziapuzza', back: 'sprites/wipeuff/back_ziapuzza.png', price: 10000 },
  ];
  // A friend's skin arrives as its folder; this finds its kart picture.
  const skinBack = (dir) => (SKINS.find((s) => s.dir === dir) || SKINS[0]).back;
  const skinNow = () => SKINS.find((s) => s.id === S.skin && ownsSkin(s.id)) || SKINS[0];
  const ownsSkin = (id) => id === 'default' || (S.skins || []).includes(id);
  const GOLDEN_EVERY_MS = 10 * 60000;
  const GOLDEN_FADE_IN_MS = 2500;
  const GOLDEN_FADE_OUT_AT_MS = 10000;
  const GOLDEN_FADE_OUT_MS = 1500;
  const REMATCH_ENERGY = 10;
  const DIAMOND_CHANCE_NEW_BOSS = 0.1;
  const DIAMOND_CHANCE_REMATCH = 0.02;
  const BOSS_ENERGY_SHARE = 1 / 3;
  const REVIVE_BARS = 50;
  const ATTACK_GAP_MS = 4000;
  const FIRST_HIT_MS = 700;
  const NEXT_HIT_MS = 800;
  const bossHp = (n) => (300 + n * 300 + n * n * 20) * 3;
  // Fight n is the (n+1)th boss in order; after the last one they return, tougher and numbered.
  const bossFor = (n) => {
    const b = BOSSES[n % BOSSES.length];
    const loop = Math.floor(n / BOSSES.length);
    const name = t(b.key);
    return { ...b, name: loop ? `${name} ${loop + 1}` : name };
  };

  const fresh = () => ({
    level: 1, xp: 0, str: 1, bossWins: 0,
    food: 80, energy: 80, joy: 80,
    streak: 0, lastDay: null,
    care: {}, tickAt: Date.now(), updatedAt: 0,
    rewardDay: 0, lastReward: -1, nextGolden: 0,
    items: { pokebowl: 1, pizza: 1, popsicle: 1, phone: 1, monster: 1, diamond: 0 },
    life: 0, poken: 0, cds: [],
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
    if (typeof planReminders === 'function') planReminders();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 2500);
  }
  async function sync() {
    clearTimeout(syncTimer);
    try {
      if (await Cloud.push(S)) await Cloud.pushProfile(publicStats());
    } catch { /* stays on the device; retried on the next save or reconnect */ }
  }
  const progress = (s) => s.level * 1e6 + s.xp + s.str * 100 + s.bossWins * 1000;
  // Never let a stale device overwrite further progress.
  function merge(local, remote) {
    if (!remote) return local;
    // After a death the new life always wins, so an old save can never bring back the last one.
    const lifeLocal = local.life ?? 0, lifeRemote = remote.life ?? 0;
    if (lifeLocal !== lifeRemote) return { ...fresh(), ...(lifeLocal > lifeRemote ? local : remote) };
    // A change made in the terminal is the truth: the save that has it wins whole, even over more progress.
    const edited = (remote.editedAt || 0) > (local.updatedAt || 0) ? remote : (local.editedAt || 0) > (remote.updatedAt || 0) ? local : null;
    const winner = edited || (progress(remote) === progress(local)
      ? (remote.updatedAt > local.updatedAt ? remote : local)
      : (progress(remote) > progress(local) ? remote : local));
    // The streak comes from the save that checked in most recently (on the same day, the newer save).
    const better = edited || (remote.lastDay > local.lastDay || !local.lastDay ? remote
      : remote.lastDay === local.lastDay && remote.updatedAt > local.updatedAt ? remote : local);
    return { ...fresh(), ...winner, streak: better.streak, lastDay: better.lastDay,
      // A reward claimed on any device stays claimed everywhere.
      rewardDay: Math.max(local.rewardDay ?? 0, remote.rewardDay ?? 0),
      lastReward: Math.max(local.lastReward ?? -1, remote.lastReward ?? -1),
      mortal: local.mortal || remote.mortal,
      // A CD bought on any device stays owned everywhere.
      cds: edited ? (edited.cds || []) : [...new Set([...(local.cds || []), ...(remote.cds || [])])],
      skins: edited ? (edited.skins || []) : [...new Set([...(local.skins || []), ...(remote.skins || [])])],
      createdAt: Math.min(local.createdAt || Infinity, remote.createdAt || Infinity) === Infinity ? undefined : Math.min(local.createdAt || Infinity, remote.createdAt || Infinity) };
  }

  // ----- time, needs, streak -----
  const dayNumber = (ms) => {
    const d = new Date(ms);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  };
  function tick() {
    const now = Date.now();
    const hours = Math.max(0, now - S.tickAt) / 3600000;
    // While a CD plays she is happy listening, so her joy doesn't drop.
    for (const k in DECAY_PER_HOUR) if (!(k === 'joy' && cdNow)) S[k] = clamp(S[k] - DECAY_PER_HOUR[k] * hours);
    if (cheat('god')) S.food = S.energy = S.joy = 100;
    S.tickAt = now;
  }
  function checkIn() {
    const today = dayNumber(Cloud.now());
    if (S.lastDay === today) return null;
    let msg;
    if (S.lastDay === null || S.lastDay > today) { S.streak = 1; msg = t('day1'); }
    else if (today - S.lastDay === 1) { S.streak += 1; msg = t('streakN', { n: S.streak }); }
    else { S.streak = Math.max(1, Math.floor(S.streak / 2)); msg = t('streakLost', { n: S.streak }); }
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
    if (up) toast(t('levelUp', { n: S.level }));
    return gain;
  }
  const nextBossLevel = () => (S.bossWins + 1) * BOSS_EVERY;
  const wellness = () => 0.6 + 0.4 * ((S.food + S.energy + S.joy) / 300);

  // ----- sprite animation -----
  const players = new Map();
  function play(el, name, thenIdle) {
    clearTimeout(players.get(el));
    const times = ANIMS[name];
    // Modern look: she's a 3D model instead of the pixel sprite.
    if (window.Pet3D && use3d()) {
      Pet3D.play(el, name, thenIdle, skinNow().id, thenIdle ? times.reduce((a, b) => a + b, 0) : 0);
      if (el.id === 'pet') Pet3D.room(el.parentElement, el); // her real room behind her
      return;
    }
    window.Pet3D?.remove(el);
    if (el.id === 'pet') window.Pet3D?.removeRoom(el.parentElement);
    el.style.backgroundImage = `url(${skinNow().dir}/${name}_sheet.png)`;
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
  // After the look changes: the pets on screen switch between the pixel sprite and the 3D model.
  function redrawPets() {
    for (const id of ['pet', 'trainPet', 'fightPet', 'deadPet']) if ($(id)?.offsetParent) play($(id), id === 'pet' ? restingAnim() : id === 'fightPet' ? 'battle' : id === 'deadPet' ? 'sad' : 'idle');
  }
  const restingAnim = () => (Math.min(S.food, S.energy, S.joy) < 25 ? 'sad' : 'idle');

  // ----- screens -----
  function show(name) {
    if (name !== 'whack') window.Games3D?.whack.stop();
    if (name !== 'boss') window.Games3D?.boss.stop();
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === `s-${name}`));
    Music.play({ train: 'action', whack: 'action', order: 'action', mini: 'action', boss: 'boss' }[name] || 'home');
    if (name === 'home') { render(); play($('pet'), restingAnim()); setTimeout(showNextGift, 300); }
    if (name === 'bosses') renderBossList();
    if (name === 'trainMenu') renderGameMenu();
    if (name === 'bag') renderBag();
    if (name === 'shop') renderShop();
    if (name === 'ach') renderAchievements();
    if (name === 'settings') renderSettings();
    if (name === 'friends') loadFriends();
    if (name !== 'home') removeGolden();
  }
  let toastTimer;
  function toast(msg) {
    $('toast').textContent = msg; $('toast').classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('on'), 3400);
  }
  function render() {
    tick();
    $('lvl').textContent = S.level;
    $('petNameText').textContent = petName();
    $('streak').textContent = (S.streak || 0).toLocaleString(I18n.current());
    $('xpFill').style.width = `${(S.xp / xpNeeded()) * 100}%`;
    for (const k of ['food', 'energy', 'joy']) $(`b-${k}`).style.width = `${S[k]}%`;
    $('str').textContent = S.str; $('wins').textContent = S.bossWins; $('pokenStat').textContent = (S.poken || 0).toLocaleString(I18n.current());
    const u = Cloud.user();
    $('btnAccount').textContent = u ? u.name : t('guestName');
    const lowest = Math.min(S.food, S.energy, S.joy);
    $('say').textContent = lowest >= 25 ? (Date.now() < sighUntil ? sighText : '') : S.food === lowest ? t(hasItemFor('food') ? 'hungry' : 'noFood') : S.energy === lowest ? t(hasItemFor('energy') ? 'tired' : 'noEnergy') : t('lonely');
    const need = nextBossLevel();
    $('btnBossLabel').textContent = t(S.level >= need ? 'bossReady' : 'bosses');
    renderInfo(need);
    checkAchievements();
  }
  // The computer layout's info panel: progress, what's next and what's in the bag.
  function renderInfo(need) {
    $('infoLevel').textContent = t('levelN', { n: S.level });
    $('infoXp').textContent = t('xpOf', { a: S.xp, b: xpNeeded() });
    $('infoStreak').textContent = t('infoStreak', { n: S.streak });
    const boss = bossFor(S.bossWins);
    $('infoBossIcon').src = `sprites/boss_${boss.art}.png`;
    $('infoBoss').textContent = S.level >= need ? t('infoBossReady', { name: boss.name }) : t('infoBossAt', { name: boss.name, n: need });
    if (dailyReady()) $('infoDaily').textContent = t('infoDailyReady');
    else {
      const now = new Date(Cloud.now());
      const left = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
      const hours = Math.floor(left / 3600000), minutes = Math.floor((left % 3600000) / 60000);
      $('infoDaily').textContent = t('infoDailyIn', { t: hours ? `${hours}h ${minutes}m` : `${minutes}m` });
    }
    const items = $('infoItems');
    items.replaceChildren();
    for (const id of Object.keys(ITEMS)) {
      if (!(S.items[id] > 0)) continue;
      const span = document.createElement('span');
      const img = document.createElement('img');
      img.src = ITEMS[id].icon; img.alt = t(ITEMS[id].key); img.title = img.alt;
      span.append(img, String(S.items[id]));
      items.append(span);
    }
    if (!items.children.length) items.textContent = t('infoNoItems');
  }
  // Tapping her makes her happier; the short gap stops one held-down tap from filling the bar.
  let lastPet = 0;
  function petHer(e) {
    e.preventDefault();
    const now = Date.now();
    if (now - lastPet < PET_GAP_MS) return;
    lastPet = now;
    tick();
    S.joy = clamp(S.joy + PET_JOY);
    save(); render();
    play($('pet'), 'happy', restingAnim());
    const heart = document.createElement('span');
    heart.className = 'heart'; heart.textContent = '♥';
    heart.onanimationend = () => heart.remove();
    $('pet').parentElement.append(heart);
  }

  // ----- items -----
  const hasItemFor = (stat) => Object.keys(ITEMS).some((id) => ITEMS[id].stat === stat && S.items[id] > 0);
  function rollDiamond(found, chance) {
    if (Math.random() < chance) { found.diamond = 1; addItems({ diamond: 1 }); }
    return found;
  }
  function itemsText(items) {
    return Object.entries(items).map(([id, n]) => `+${n} ${t(ITEMS[id].key)}`).join(', ');
  }
  function addItems(items) {
    for (const [id, n] of Object.entries(items)) S.items[id] = (S.items[id] || 0) + n;
  }
  const pickWeighted = (ids) => {
    let roll = Math.random() * ids.reduce((sum, id) => sum + ITEMS[id].weight, 0);
    return ids.find((key) => (roll -= ITEMS[key].weight) < 0) || ids[0];
  };
  // Rolls n random items, adds them to the inventory and returns them.
  // With energyShare, each item is an energy item with that chance and food otherwise.
  function dropItems(n, energyShare) {
    const ids = Object.keys(ITEMS).filter((id) => ITEMS[id].weight > 0);
    const found = {};
    for (let i = 0; i < n; i++) {
      const stat = energyShare === undefined ? null : Math.random() < energyShare ? 'energy' : 'food';
      const id = pickWeighted(stat ? ids.filter((key) => ITEMS[key].stat === stat) : ids);
      found[id] = (found[id] || 0) + 1;
    }
    addItems(found);
    return found;
  }
  let bagFilter = null;
  function openBag(filter) {
    bagFilter = filter;
    show('bag');
  }
  function renderBag() {
    tick();
    const foodLine = `${t('food')} ${Math.round(S.food)}%`, energyLine = `${t('energy')} ${Math.round(S.energy)}%`;
    $('bagStatus').textContent = bagFilter === 'food' ? foodLine : bagFilter === 'energy' ? energyLine : `${foodLine} · ${energyLine}`;
    const list = $('bagList');
    list.textContent = '';
    for (const [stat, heading] of [['food', 'foodSection'], ['energy', 'energySection']]) {
      if (bagFilter && bagFilter !== stat) continue;
      const head = document.createElement('div');
      head.className = 'bagHead'; head.textContent = t(heading);
      list.append(head);
      for (const id of Object.keys(ITEMS).filter((key) => ITEMS[key].stat === stat)) {
        const item = ITEMS[id];
        const count = S.items[id] || 0;
        const row = document.createElement('div');
        row.className = `bossRow${count ? '' : ' empty'}`;
        const img = document.createElement('img');
        img.src = item.icon; img.alt = '';
        const text = document.createElement('div');
        const title = document.createElement('b');
        title.textContent = `${t(item.key)} x${count}`;
        const about = document.createElement('span');
        about.className = 'dim';
        about.textContent = stat === 'food' ? `${t('plusFood', { n: item.amount })} · +${FEED_JOY} ♥` : t('plusEnergy', { n: item.amount });
        text.append(title, about);
        const use = document.createElement('button');
        use.textContent = t('use'); use.className = 'main';
        use.disabled = !count || S[stat] >= 99;
        use.onclick = () => useItem(id);
        row.append(img, text, use);
        list.append(row);
      }
    }
    if (bagFilter) return;
    const head = document.createElement('div');
    head.className = 'bagHead'; head.textContent = t('specialSection');
    const row = document.createElement('div');
    row.className = `bossRow rare${S.items.diamond ? '' : ' empty'}`;
    const img = document.createElement('img');
    img.src = ITEMS.diamond.icon; img.alt = '';
    const text = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = `${t('itemDiamond')} x${S.items.diamond || 0}`;
    const about = document.createElement('span');
    about.className = 'dim'; about.textContent = t('diamondAbout');
    text.append(title, about);
    row.append(img, text);
    list.append(head, row);
  }
  function useItem(id) {
    const item = ITEMS[id];
    if (!(S.items[id] > 0)) return;
    tick();
    S.items[id] -= 1;
    S[item.stat] = clamp(S[item.stat] + item.amount);
    const fed = item.stat === 'food';
    if (fed) S.joy = clamp(S.joy + FEED_JOY);
    const xp = addXp(3);
    save(); show('home');
    play($('pet'), 'happy', restingAnim());
    toast(`${t(fed ? 'plusFood' : 'plusEnergy', { n: item.amount })}${fed ? ` · ${t('plusJoy', { n: FEED_JOY })}` : ''} · ${t('plusXp', { n: xp })}`);
  }

  // ----- shop -----
  let shopTab = 'sell';
  const fmtPoken = (n) => `${(n || 0).toLocaleString(I18n.current())} Poken`;
  const ownsCd = (id) => (S.cds || []).includes(id);
  function shopRow(icon, title, about, buttons, cls = '') {
    const row = document.createElement('div');
    row.className = `bossRow ${cls}`;
    const img = document.createElement('img');
    img.src = icon; img.alt = '';
    const text = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = title;
    const span = document.createElement('span');
    span.className = 'dim'; span.textContent = about;
    text.append(b, span);
    const acts = document.createElement('div');
    acts.className = 'shopBtns';
    acts.append(...buttons);
    row.append(img, text, acts);
    return row;
  }
  function shopButton(label, onclick, disabled, cls = 'main') {
    const b = document.createElement('button');
    b.textContent = label; b.className = cls; b.disabled = disabled; b.onclick = onclick;
    return b;
  }
  function renderShop() {
    $('pokenBal').textContent = fmtPoken(S.poken);
    $('tabSell').classList.toggle('picked', shopTab === 'sell');
    $('tabCds').classList.toggle('picked', shopTab === 'cds');
    $('tabSkins').classList.toggle('picked', shopTab === 'skins');
    const list = $('shopList');
    list.replaceChildren();
    if (shopTab === 'sell') {
      for (const id of Object.keys(SELL_PRICES)) {
        const have = S.items[id] || 0;
        list.append(shopRow(ITEMS[id].icon, `${t(ITEMS[id].key)} x${have}`, t('sellFor', { p: fmtPoken(SELL_PRICES[id]) }), [
          shopButton(t('sell'), () => sellItem(id, 1), !have),
          shopButton('+', () => openSell(id), have < 2, ''),
        ], have ? '' : 'empty'));
      }
      return;
    }
    if (shopTab === 'skins') {
      for (const skin of SKINS) {
        const owned = ownsSkin(skin.id), worn = skinNow().id === skin.id;
        list.append(shopRow(skin.icon, t(skin.key), worn ? t('skinWorn') : owned ? t('cdOwned') : fmtPoken(skin.price), [
          owned ? shopButton(t(worn ? 'skinWorn' : 'skinWear'), () => wearSkin(skin.id), worn)
            : shopButton(t('buy'), () => buySkin(skin.id), (S.poken || 0) < skin.price),
        ], `cdRow skinRow${worn ? ' picked' : ''}`));
      }
      return;
    }
    if (!CDS.length) {
      const p = document.createElement('p');
      p.className = 'center dim'; p.textContent = t('cdsSoon');
      list.append(p);
    }
    for (const cd of CDS) {
      const owned = ownsCd(cd.id);
      list.append(shopRow('sprites/icons/cd.png', cd.title, owned ? t('cdOwned') : fmtPoken(cd.price), [
        owned ? shopButton(t('cdPlay'), () => { playCd(cd.id); show('home'); }, false)
          : shopButton(t('buy'), () => buyCd(cd.id), (S.poken || 0) < cd.price),
      ], `cdRow${owned ? ' picked' : ''}`));
      list.lastChild.querySelector('img').style.filter = `hue-rotate(${cd.hue || 0}deg)`;
    }
  }
  function sellItem(id, n) {
    if (!(n > 0) || n > (S.items[id] || 0)) return;
    // Selling the last diamond leaves nothing to bring her back with, so check first.
    if ((id === 'diamond' || n > 1) && !confirm(t('sellConfirm', { n, item: t(ITEMS[id].key), p: fmtPoken(SELL_PRICES[id] * n) }))) return;
    S.items[id] -= n;
    S.poken = (S.poken || 0) + SELL_PRICES[id] * n;
    save(); renderShop();
    toast(t('sold', { n, item: t(ITEMS[id].key), p: fmtPoken(SELL_PRICES[id] * n) }));
  }
  // "+" opens a slider to pick how many to sell at once.
  let sellId = null;
  function openSell(id) {
    const have = S.items[id] || 0;
    if (have < 1) return;
    sellId = id;
    $('sellPic').src = ITEMS[id].icon;
    $('sellName').textContent = t(ITEMS[id].key);
    $('sellRange').max = String(have);
    $('sellRange').value = String(Math.min(have, Math.max(1, Math.ceil(have / 2))));
    sellShow();
    $('sellWin').classList.add('on');
  }
  function sellShow() {
    const n = Number($('sellRange').value);
    $('sellCount').textContent = t('sellHow', { n, max: S.items[sellId] || 0, p: fmtPoken(SELL_PRICES[sellId] * n) });
  }
  $('sellRange').oninput = sellShow;
  $('btnSellMinus').onclick = () => { $('sellRange').value = String(Number($('sellRange').value) - 1); sellShow(); };
  $('btnSellPlus').onclick = () => { $('sellRange').value = String(Number($('sellRange').value) + 1); sellShow(); };
  $('btnSellCancel').onclick = () => $('sellWin').classList.remove('on');
  $('btnSellGo').onclick = () => {
    const id = sellId, n = Number($('sellRange').value);
    $('sellWin').classList.remove('on');
    if (!(n > 0) || n > (S.items[id] || 0)) return;
    S.items[id] -= n;
    S.poken = (S.poken || 0) + SELL_PRICES[id] * n;
    save(); renderShop();
    toast(t('sold', { n, item: t(ITEMS[id].key), p: fmtPoken(SELL_PRICES[id] * n) }));
  };
  function buyCd(id) {
    const cd = CDS.find((c) => c.id === id);
    if (!cd || ownsCd(id) || (S.poken || 0) < cd.price) return;
    S.poken -= cd.price;
    S.cds = [...(S.cds || []), id];
    save(); sync(); renderShop();
    toast(t('cdBought', { name: cd.title }));
  }
  function buySkin(id) {
    const skin = SKINS.find((s) => s.id === id);
    if (!skin || ownsSkin(id) || (S.poken || 0) < skin.price) return;
    S.poken -= skin.price;
    S.skins = [...(S.skins || []), id];
    S.skin = id;
    save(); sync(); renderShop();
    toast(t('skinBought', { name: t(skin.key) }));
  }
  function wearSkin(id) {
    if (!ownsSkin(id)) return;
    S.skin = id;
    save(); sync(); renderShop();
  }
  $('tabSkins').onclick = () => { shopTab = 'skins'; renderShop(); };
  $('tabSell').onclick = () => { shopTab = 'sell'; renderShop(); };
  $('tabCds').onclick = () => { shopTab = 'cds'; renderShop(); };

  // ----- CD player -----
  // One song at a time, on repeat, until stopped. The chiptune music waits while it plays.
  let cdNow = null;
  let cdPausedByHiding = false;
  const cdAudio = new Audio();
  cdAudio.loop = true;
  cdAudio.onerror = () => { if (cdNow) { stopCd(); toast(t('cdError')); } };
  function playCd(id) {
    const cd = CDS.find((c) => c.id === id);
    if (!cd || !ownsCd(id)) return;
    tick();
    cdNow = id;
    cdAudio.src = cd.file;
    cdAudio.play().catch(() => {});
    Music.hold?.(true);
    $('cdPlayer').classList.add('playing');
    renderCd();
    toast(t('cdNowPlaying', { name: cd.title }));
  }
  function stopCd() {
    tick();
    cdNow = null;
    cdAudio.pause();
    cdAudio.removeAttribute('src');
    Music.hold?.(false);
    $('cdPlayer').classList.remove('playing');
    renderCd();
  }
  function renderCd() {
    const cd = CDS.find((c) => c.id === cdNow);
    $('cdNow').textContent = cd ? t('cdNowPlaying', { name: cd.title }) : t('cdIdle');
    $('btnCdStop').hidden = !cd;
    const list = $('cdList');
    list.replaceChildren();
    const owned = CDS.filter((c) => ownsCd(c.id));
    $('btnCdShop').hidden = owned.length > 0;
    if (!owned.length) {
      const p = document.createElement('p');
      p.className = 'center dim'; p.textContent = t('cdNone');
      list.append(p);
    }
    for (const c of owned) {
      const b = document.createElement('button');
      const img = document.createElement('img');
      img.src = 'sprites/icons/cd.png'; img.alt = ''; img.className = 'ic';
      img.style.filter = `hue-rotate(${c.hue || 0}deg)`;
      b.append(img, c.title);
      if (c.id === cdNow) b.className = 'picked';
      b.onclick = () => (c.id === cdNow ? stopCd() : playCd(c.id));
      list.append(b);
    }
  }
  function openCd() { renderCd(); $('cdWin').classList.add('on'); }
  $('cdPlayer').onclick = openCd;
  $('btnCdStop').onclick = stopCd;
  $('btnCdClose').onclick = () => $('cdWin').classList.remove('on');
  $('btnCdShop').onclick = () => { $('cdWin').classList.remove('on'); shopTab = 'cds'; show('shop'); };

  // ----- her name -----
  const PET_NAME_MAX = 20;
  const petName = () => (S.petName || '').trim() || t('petDefault');
  function openPetName() {
    $('petNameInput').value = S.petName || '';
    $('petNameInput').placeholder = t('petDefault');
    $('nameWin').classList.add('on');
    setTimeout(() => $('petNameInput').focus(), 50);
  }
  function savePetName() {
    const name = $('petNameInput').value.replace(/\s+/g, ' ').trim().slice(0, PET_NAME_MAX);
    S.petName = name;
    $('nameWin').classList.remove('on');
    save(); sync(); render();
    toast(t('petNamed', { name: petName() }));
  }
  $('btnPetName').onclick = openPetName;
  $('btnNameSave').onclick = savePetName;
  $('btnNameCancel').onclick = () => $('nameWin').classList.remove('on');
  $('petNameInput').onkeydown = (e) => { if (e.key === 'Enter') savePetName(); };

  // ----- achievements -----
  // Each one checks the save for [how far, goal]; finished ones are claimed for Poken.
  // Beta players: anyone whose account (or Sbuffling) was made on 15 November 2026 or earlier.
  const BETA_END = new Date(2026, 10, 16).getTime(); // The first moment after 15 November 2026.
  const isBeta = () => (S.createdAt && S.createdAt < BETA_END) || (S.lastDay != null && S.lastDay < dayNumber(BETA_END)) ? 1 : 0;
  const ACHIEVEMENTS = [
    { id: 'beta', prize: 5000, special: true, check: () => [isBeta(), 1] },
    { id: 'hatch', prize: 100, check: () => [S.tutorialDone !== false && S.lastDay != null ? 1 : 0, 1] },
    { id: 'level5', prize: 250, check: () => [S.level, 5] },
    { id: 'level10', prize: 600, check: () => [S.level, 10] },
    { id: 'level25', prize: 2000, check: () => [S.level, 25] },
    { id: 'streak7', prize: 500, check: () => [S.streak, 7] },
    { id: 'streak30', prize: 2500, check: () => [S.streak, 30] },
    { id: 'boss1', prize: 300, check: () => [S.bossWins, 1] },
    { id: 'boss5', prize: 1000, check: () => [S.bossWins, 5] },
    { id: 'boss10', prize: 3000, check: () => [S.bossWins, 10] },
    { id: 'friend1', prize: 300, check: () => [S.friendCount || 0, 1] },
    { id: 'gift1', prize: 300, check: () => [S.giftsSent || 0, 1] },
    { id: 'duel1', prize: 400, check: () => [S.duelWins || 0, 1] },
    { id: 'duel10', prize: 2000, check: () => [S.duelWins || 0, 10] },
    { id: 'race1', prize: 500, check: () => [S.raceWins || 0, 1] },
    { id: 'rhythm50', prize: 800, check: () => [S.rhythmBest || 0, 50] },
    { id: 'cd1', prize: 300, check: () => [(S.cds || []).length, 1] },
    { id: 'cdAll', prize: 2000, check: () => [CDS.filter((c) => (S.cds || []).includes(c.id)).length, CDS.length] },
    { id: 'skin1', prize: 1000, check: () => [(S.skins || []).length, 1] },
  ];
  // Done for real, or unlocked through the terminal (S.achForced): either way it can be claimed for its Poken.
  const achDone = (a) => { if (S.achForced?.[a.id]) return true; const [n, goal] = a.check(); return n >= goal; };
  const achClaimed = (a) => !!(S.achieved || {})[a.id];
  const claimable = () => ACHIEVEMENTS.filter((a) => achDone(a) && !achClaimed(a));
  // Tells the player once when a new one is ready, and lights up the trophy button.
  function checkAchievements() {
    const ready = claimable();
    $('achDot').hidden = !ready.length;
    S.achSeen = S.achSeen || {};
    const fresh = ready.filter((a) => !S.achSeen[a.id]);
    if (!fresh.length) return;
    for (const a of fresh) S.achSeen[a.id] = true;
    save();
    toast(t('achUnlocked', { name: t(`ach_${a0(fresh)}`) }));
  }
  const a0 = (list) => list[0].id;
  function renderAchievements() {
    const list = $('achList');
    list.replaceChildren();
    const got = ACHIEVEMENTS.filter(achClaimed).length;
    $('achCount').textContent = t('achCount', { a: got, b: ACHIEVEMENTS.length });
    for (const a of ACHIEVEMENTS) {
      const [n, goal] = a.check();
      const done = achDone(a), claimed = achClaimed(a);
      const row = document.createElement('div');
      row.className = `bossRow achRow${claimed ? ' claimed' : done ? ' ready' : ' locked'}${a.special ? ' special' : ''}`;
      const img = document.createElement('img');
      img.src = 'sprites/icons/trophy.png'; img.alt = '';
      const text = document.createElement('div');
      const b = document.createElement('b'); b.textContent = t(`ach_${a.id}`);
      const about = document.createElement('span'); about.className = 'dim';
      about.textContent = `${t(`achAbout_${a.id}`)}${goal > 1 ? ` (${Math.min(n, goal)}/${goal})` : ''}`;
      const prize = document.createElement('span'); prize.className = 'achPrize'; prize.textContent = fmtPoken(a.prize);
      text.append(b, about, prize);
      const btn = document.createElement('button');
      btn.className = claimed ? '' : 'main';
      btn.textContent = claimed ? '✓' : t('achClaim');
      btn.disabled = claimed || !done;
      btn.onclick = () => claimAchievement(a);
      row.append(img, text, btn);
      list.append(row);
    }
  }
  function claimAchievement(a) {
    if (!achDone(a) || achClaimed(a)) return;
    S.achieved = { ...(S.achieved || {}), [a.id]: Date.now() };
    S.poken = (S.poken || 0) + a.prize;
    save(); sync(); renderAchievements(); checkAchievements();
    toast(t('achClaimed', { name: t(`ach_${a.id}`), p: fmtPoken(a.prize) }));
  }
  $('btnAch').onclick = () => show('ach');

  // ----- her sighs -----
  // Every one to three minutes on the home screen she lets out a sigh, in Italian whatever the language.
  // "Uff" and "uffa" come with her real sigh.
  const ufSound = new Audio('sounds/uf.mp4');
  let sighText = '', sighUntil = 0;
  function seasonWord() {
    const m = new Date().getMonth();
    if (m >= 2 && m <= 4) return 'Ufla!';
    if (m >= 5 && m <= 7) return 'Sto in un bagno di sudore..';
    return 'Brr!';
  }
  function sigh() {
    setTimeout(sigh, 60000 + Math.random() * 120000);
    if (document.hidden || !$('s-home').classList.contains('on') || document.querySelector('.modal.on') || tutorialOn() || isDead()) return;
    const words = ['uff..', 'uffa!', seasonWord()];
    sighText = words[Math.floor(Math.random() * words.length)];
    sighUntil = Date.now() + 4000;
    render();
    play($('pet'), 'sad', restingAnim());
    if (sighText.startsWith('uff') && Music.enabled()) { ufSound.currentTime = 0; ufSound.play().catch(() => {}); }
    setTimeout(() => { if (Date.now() >= sighUntil && $('s-home').classList.contains('on')) render(); }, 4100);
  }
  setTimeout(sigh, 60000 + Math.random() * 120000);

  // ----- death -----
  const isDead = () => S.food <= 0 || S.energy <= 0;
  function openDeath() {
    $('daily').classList.remove('on');
    removeGolden();
    const diamonds = S.items.diamond || 0;
    $('deadWhy').textContent = t(S.food <= 0 ? 'deadFood' : 'deadEnergy');
    $('deadLost').textContent = t('deadLost', { l: S.level, s: S.str, b: S.bossWins, k: S.streak });
    $('deadHint').textContent = t(diamonds ? 'deadSave' : 'deadNone');
    $('btnRevive').style.display = diamonds ? '' : 'none';
    $('btnRevive').textContent = t('useDiamond', { n: diamonds });
    play($('deadPet'), 'sad');
    Music.play(null);
    $('death').classList.add('on');
  }
  function reviveHer() {
    if (!(S.items.diamond > 0) || !isDead()) return;
    S.items.diamond -= 1;
    S.food = Math.max(S.food, REVIVE_BARS);
    S.energy = Math.max(S.energy, REVIVE_BARS);
    S.tickAt = Date.now();
    save(); sync();
    $('death').classList.remove('on');
    show('home'); play($('pet'), 'happy', restingAnim());
    toast(t('revived'));
  }
  function startOver() {
    if (S.items.diamond > 0 && !confirm(t('startOverConfirm'))) return;
    // Today's daily reward stays claimed, so dying can't be used to collect it again.
    S = { ...fresh(), life: (S.life || 0) + 1, lastReward: S.lastReward, mortal: true, nextGolden: Date.now() + GOLDEN_EVERY_MS, cheats: S.cheats, createdAt: S.createdAt };
    const msg = checkIn();
    save(); sync();
    $('death').classList.remove('on');
    show('home');
    toast(`${t('restarted')} ${msg || ''}`);
  }

  // ----- settings -----
  let settingsReturn = 'home';
  // ----- settings -----
  // Grouped like a phone's settings: cards with a heading, a label on the left and its control on the right.
  const CHAR_KEY = 'sbuffogotchi.char';
  const charStyle = () => { try { return localStorage.getItem(CHAR_KEY) === '2d' ? '2d' : '3d'; } catch { return '3d'; } };
  // She's 3D only in the Modern look, and only if the player hasn't picked 2D there.
  const use3d = () => document.documentElement.classList.contains('modern') && charStyle() === '3d';
  function setLook(modern) {
    document.documentElement.classList.toggle('modern', modern);
    window.applyLookColors?.(modern ? lookColors() : null);
    try { localStorage.setItem('sbuffogotchi.look', modern ? 'modern' : 'classic'); } catch { /* lasts until the app closes */ }
    redrawPets();
  }
  function setCharStyle(style) {
    try { localStorage.setItem(CHAR_KEY, style); } catch { /* lasts until the app closes */ }
    redrawPets();
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function card(title) {
    const c = el('div', 'setCard');
    c.append(el('h3', '', title));
    $('setList').append(c);
    return c;
  }
  function row(parent, label, control) {
    const r = el('div', 'setRow');
    r.append(el('span', 'setLabel', label));
    if (control) r.append(control);
    parent.append(r);
    return r;
  }
  // A segmented picker: one of a few choices.
  function seg(choices, current, pick) {
    const s = el('div', 'seg');
    for (const [value, label] of choices) {
      const btn = el('button', value === current ? 'on' : '', label);
      btn.onclick = () => { pick(value); renderSettings(); };
      s.append(btn);
    }
    return s;
  }
  // An on/off switch.
  function toggle(on, flip) {
    const s = el('button', on ? 'switch on' : 'switch');
    s.setAttribute('role', 'switch');
    s.setAttribute('aria-checked', on ? 'true' : 'false');
    s.append(el('i'));
    s.onclick = flip;
    return s;
  }
  // A row that opens something, with an arrow on the right.
  function goRow(parent, label, open) {
    const r = row(parent, label, el('span', 'setGo', '›'));
    r.classList.add('go');
    r.tabIndex = 0;
    r.setAttribute('role', 'button');
    r.onclick = open;
    r.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    return r;
  }
  function renderSettings() {
    $('setList').replaceChildren();
    // Language
    const lang = card(t('language'));
    const langSeg = seg(Object.entries(I18n.langs), I18n.current(), (code) => I18n.set(code));
    langSeg.classList.add('wide');
    lang.append(langSeg);
    // Sound and reminders
    const sound = card(t('setSound'));
    row(sound, `🎵 ${t('music')}`, toggle(Music.enabled(), () => { Music.setEnabled(!Music.enabled()); renderSettings(); }));
    if (Notify.available()) {
      const sw = toggle(Notify.enabled(), async () => {
        if (Notify.enabled() && sw.dataset.blocked) {
          if (!(await Notify.ask())) toast(t('notifBlockedHelp'));
        } else await Notify.setEnabled(!Notify.enabled());
        planReminders();
        renderSettings();
      });
      const r = row(sound, `🔔 ${t('notifications')}`, sw);
      // If the phone said no, say so: tapping asks again, or explains where to allow them.
      Notify.allowed().then((ok) => {
        if (ok || !Notify.enabled()) return;
        sw.dataset.blocked = '1';
        sw.classList.remove('on');
        r.querySelector('.setLabel').append(el('small', 'setWarn', t('notifBlocked')));
      });
    }
    // Look. With Modern picked, a branch below it holds the Modern-only choices.
    const modern = document.documentElement.classList.contains('modern');
    const looks = card(t('setLook'));
    row(looks, `✨ ${t('uiLook')}`, seg([['classic', t('uiClassic')], ['modern', t('uiModern')]], modern ? 'modern' : 'classic', (v) => setLook(v === 'modern')));
    if (modern) {
      const branch = el('div', 'setBranch');
      looks.append(branch);
      row(branch, t('uiChar'), seg([['2d', '2D'], ['3d', '3D']], charStyle(), setCharStyle));
      goRow(branch, `🎨 ${t('colorsTitle')}`, openColors);
    }
    // Game
    const game = card(t('setGame'));
    const giftSeg = seg([['ask', t('giftModeAsk')], ['auto', t('giftModeAuto')], ['off', t('giftModeOff')]], giftMode(), (v) => { S.giftMode = v; save(); sync(); });
    giftSeg.classList.add('wide');
    row(game, `🎁 ${t('giftSetting')}`, giftSeg).classList.add('stack');
    goRow(game, `📖 ${t('tutReplay')}`, startTutorial);
    if (isAdmin()) goRow(game, `💻 ${t('terminal')}`, openTerminal);
  }

  // ----- Modern colours -----
  // Each colour can be changed; "btn" is only set when every button should share one colour.
  const COLOR_KEY = 'sbuffogotchi.colors';
  const COLOR_DEFAULTS = { btn: '#4e3a66', win: '#100f18', o1: '#f5a3c7', o2: '#b9a3ff', text: '#ece6f5', glow: '#f5a3c7' };
  const COLOR_ROWS = [['btn', 'colorBtn'], ['win', 'colorWin'], ['o1', 'colorO1'], ['o2', 'colorO2'], ['text', 'colorText'], ['glow', 'colorGlow']];
  function lookColors() {
    try { return JSON.parse(localStorage.getItem(COLOR_KEY) || 'null') || {}; } catch { return {}; }
  }
  function setLookColors(c) {
    try { localStorage.setItem(COLOR_KEY, JSON.stringify(c)); } catch { /* lasts until the app closes */ }
    window.applyLookColors?.(c);
  }
  function renderColors() {
    const c = lookColors();
    const list = $('colorList');
    list.replaceChildren();
    const tints = document.createElement('button');
    tints.textContent = `${t('colorTints')}: ${t(c.btn ? 'musicOff' : 'musicOn')}`;
    if (!c.btn) tints.className = 'picked';
    tints.onclick = () => {
      const now = lookColors();
      if (now.btn) delete now.btn; else now.btn = COLOR_DEFAULTS.btn;
      setLookColors(now); renderColors();
    };
    list.append(tints);
    for (const [key, label] of COLOR_ROWS) {
      const row = document.createElement('label');
      row.className = 'colorRow';
      const name = document.createElement('span');
      name.textContent = t(label);
      const pick = document.createElement('input');
      pick.type = 'color';
      pick.value = c[key] || COLOR_DEFAULTS[key];
      // Picking a button colour gives every button that colour (and switches off the per-button colours).
      pick.oninput = () => {
        const now = lookColors(); now[key] = pick.value; setLookColors(now);
        if (key === 'btn' && !c.btn) { c.btn = pick.value; tints.textContent = `${t('colorTints')}: ${t('musicOff')}`; tints.className = ''; }
      };
      row.append(name, pick);
      list.append(row);
    }
  }
  function openColors() { renderColors(); $('colorWin').classList.add('on'); }
  $('btnColorsDone').onclick = () => $('colorWin').classList.remove('on');
  $('btnColorsReset').onclick = () => { setLookColors({}); renderColors(); };

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
      day.textContent = t('dayN', { n: i + 1 });
      const label = document.createElement('span');
      label.textContent = dailyLabel(r);
      tile.append(img, day, label);
      days.append(tile);
    });
    $('daily').classList.add('on');
  }
  function claimDaily() {
    if (!dailyReady()) { $('daily').classList.remove('on'); return; }
    const r = DAILY_REWARDS[S.rewardDay % DAILY_REWARDS.length];
    if (r.items) addItems(r.items);
    if (r.str) S.str += r.str;
    if (r.xp) addXp(r.xp);
    S.rewardDay += 1;
    S.lastReward = dayNumber(Cloud.now());
    save();
    $('daily').classList.remove('on');
    render(); play($('pet'), 'happy', restingAnim());
    toast(t('dailyToast', { label: dailyLabel(r) }));
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
    el.className = 'golden'; el.src = 'sprites/golden_bowl.png'; el.alt = t('goldenAlt');
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
    S.joy = clamp(S.joy + 10);
    addItems({ pokebowl: 1 });
    save(); render(); play($('pet'), 'happy', restingAnim());
    toast(`${t('goldenToast')} ${itemsText({ pokebowl: 1 })} · ${t('plusXp', { n: xp })} · ${t('plusJoy', { n: 10 })}`);
  }
  function homeTimers() {
    if (tutorialOn()) return;
    if (!$('s-home').classList.contains('on') || $('death').classList.contains('on')) return;
    tick();
    if (isDead()) return openDeath();
    if ($('daily').classList.contains('on')) return;
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
    $('trainInfo').textContent = t('roundInfo', { a: train.round + 1, b: TRAIN_ROUNDS, n: train.hits });
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
      finishTraining(train.hits, TRAIN_ROUNDS, t('wrapped'));
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
    toast(`${hits}/${total} ${word} · ${t('plusStr', { n: strGain })} · ${t('plusXp', { n: xp })}`);
  }
  function menuRow(list, game, cost) {
    const row = document.createElement('div');
    row.className = 'bossRow';
    const img = document.createElement('img');
    img.src = game.art; img.alt = '';
    const text = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = t(game.key);
    const about = document.createElement('span');
    about.className = 'dim'; about.textContent = t(game.about);
    text.append(title, about);
    const go = document.createElement('button');
    // A tired player can still play minigames for free, so running out of energy is never a dead end.
    const tired = S.energy <= cost;
    go.textContent = t(tired && game.tiredOk ? 'playTired' : 'play'); go.className = 'main';
    go.disabled = tired && !game.tiredOk;
    go.onclick = game.start;
    row.append(img, text, go);
    list.append(row);
  }
  function renderGameMenu() {
    tick();
    const list = $('trainList');
    list.textContent = '';
    for (const [key, games, cost] of [['trainHeader', TRAINING_GAMES, TRAIN_COST], ['gamesHeader', MINI_GAMES, MINI_COST]]) {
      list.append(heading(key));
      games.forEach((game) => menuRow(list, game, game.cost ?? cost));
    }
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
    whack = { pops: 0, veggies: 0, hits: 0, cell: -1, bowl: false, art: 'broccoli', timer: null };
    show('whack'); whackInfo();
    if (window.Games3D && use3d()) Games3D.whack.start(grid, () => (whack && whack.cell >= 0 ? { cell: whack.cell, kind: whack.bowl ? 'bowl' : whack.art } : null));
    whack.timer = setTimeout(whackPop, 500);
  }
  function whackInfo(note) {
    $('whackInfo').textContent = note || t('whackInfo', { n: whack.hits });
  }
  function whackClear() {
    if (whack.cell >= 0) $('whackGrid').children[whack.cell].textContent = '';
    whack.cell = -1;
  }
  function whackPop() {
    if (whack.pops >= WHACK_POPS) return finishTraining(whack.hits, whack.veggies, t('whacked'));
    let cell;
    do { cell = Math.floor(Math.random() * 9); } while (cell === whack.last);
    whack.last = cell; whack.cell = cell; whack.pops += 1;
    whack.bowl = Math.random() < 0.2;
    if (!whack.bowl) whack.veggies += 1;
    const img = document.createElement('img');
    img.alt = '';
    whack.art = BOSSES[Math.floor(Math.random() * BOSSES.length)].art;
    img.src = whack.bowl ? 'sprites/icons/bowl.png' : `sprites/boss_${whack.art}.png`;
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
      whackInfo(t('whackBowl'));
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
    $('orderInfo').textContent = t('orderWatch', { a: order.round + 1, b: ORDER_ROUNDS });
    const lit = Math.max(280, 460 - order.round * 30);
    order.seq.forEach((item, i) => setTimeout(() => flashPad(item, lit), 500 + i * (lit + 180)));
    setTimeout(() => {
      order.taking = true;
      $('orderInfo').textContent = t('orderTurn', { a: order.round + 1, b: ORDER_ROUNDS });
    }, 500 + order.seq.length * (lit + 180));
  }
  function orderTap(i) {
    if (!order?.taking) return;
    flashPad(i, 130);
    if (i !== order.seq[order.at]) {
      order.taking = false;
      $('orderInfo').textContent = t('orderWrong');
      setTimeout(() => finishTraining(order.round, ORDER_ROUNDS, t('orders')), 800);
      return;
    }
    order.at += 1;
    if (order.at < order.seq.length) return;
    order.taking = false;
    order.round += 1;
    $('orderInfo').textContent = t('orderDone');
    if (order.round >= ORDER_ROUNDS) setTimeout(() => finishTraining(order.round, ORDER_ROUNDS, t('orders')), 600);
    else setTimeout(nextOrderRound, 700);
  }

  // ----- canvas minigames -----
  // Canvas games are 440 high. On phones they're 320 wide; on computers they widen to fit the screen.
  let MINI_W = 320;
  const MINI_H = 440;
  const BASE_W = 320;
  function fitMiniWidth(game, extra) {
    const wide = usesKeyboard() && innerWidth >= 900 && !(extra.duel && game.sameShape);
    if (!wide) return BASE_W;
    const room = Math.min(innerWidth - 48, 1500) / Math.max(200, innerHeight - (game.pad ? 300 : 210));
    return Math.max(BASE_W, Math.min(900, Math.round((MINI_H * room) / 2) * 2));
  }
  const art = (src) => { const i = new Image(); i.src = src; return i; };
  const ART = {
    pizza: art('sprites/pizza.png'), rice: art('sprites/rice.png'),
    bowl: art('sprites/poke_bowl.png'), broccoli: art('sprites/boss_broccoli.png'),
    walker: art('sprites/walker.png'), carrot: art('sprites/boss_carrot.png'), sprout: art('sprites/boss_sprout.png'),
  };
  let mini = null;
  let MINI_SCALE = 1;
  const drawMini = (g, c) => (g.is3d ? g.draw3d(g, c) : g.draw(g, c));
  // extra.duel is set for a live game against a friend: it's free and starts with a countdown.
  function startMini(title, game, extra = {}) {
    tick();
    const cost = game.cost ?? MINI_COST;
    const tired = !extra.duel && S.energy <= cost;
    if (!tired && !extra.duel) payEnergy(cost);
    $('miniTitle').textContent = extra.duel ? `${t(title)} · ${t('vs', { name: extra.duel.friendName })}` : t(title);
    $('btnJump').textContent = t(game.padBtn || 'jumpBtn');
    document.querySelector('#padControls .keysHint').textContent = t(game.keysHint || 'keysHint');
    MINI_W = fitMiniWidth(game, extra);
    // In 3D the canvas is drawn at twice the size so the 3D scene stays sharp; the game still thinks in its own pixels.
    const is3d = !!(game.draw3d && window.Games3D && use3d());
    MINI_SCALE = is3d || game.hiRes ? 2 : 1;
    $('miniCanvas').width = MINI_W * MINI_SCALE;
    $('miniCanvas').height = MINI_H * MINI_SCALE;
    $('miniCanvas').classList.toggle('is3d', is3d);
    $('miniCanvas').style.aspectRatio = `${MINI_W} / ${MINI_H}`;
    $('s-mini').classList.toggle('wide', MINI_W > BASE_W);
    mini = { ...game, tired, is3d, pointerX: MINI_W / 2, raf: 0, last: performance.now(), ...extra };
    if (extra.duel) mini.countdown = 3;
    $('s-mini').classList.toggle('pad', !!game.pad);
    mini.begin(mini);
    show('mini');
    mini.raf = requestAnimationFrame(miniLoop);
    catchKeys();
  }
  // Keyboard add-ons such as Vimium take letter keys (Vimium's D scrolls the page) unless a text box
  // has focus, so on computers the walking games keep an invisible one focused.
  const usesKeyboard = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  function catchKeys() {
    if ((mini?.pad || mini?.keys) && usesKeyboard() && document.activeElement !== $('keyCatcher')) $('keyCatcher').focus({ preventScroll: true });
  }
  function miniLoop(t) {
    if (!mini) return;
    const dt = Math.min(0.05, (t - mini.last) / 1000);
    mini.last = t;
    const c = $('miniCanvas').getContext('2d');
    c.setTransform(MINI_SCALE, 0, 0, MINI_SCALE, 0, 0);
    c.imageSmoothingEnabled = false;
    // 3, 2, 1, GO! before races and friendly battles.
    if (mini.countdown > 0) {
      mini.countdown -= dt;
      drawMini(mini, c);
      const n = Math.ceil(mini.countdown);
      c.fillStyle = '#231d3388'; c.fillRect(0, 0, MINI_W, MINI_H);
      c.font = 'bold 64px "Courier New", monospace'; c.textAlign = 'center'; c.fillStyle = '#ffc857';
      c.fillText(n > 0 ? String(n) : I18n.t('countGo'), MINI_W / 2, MINI_H / 2);
      c.textAlign = 'left';
      mini.raf = requestAnimationFrame(miniLoop);
      return;
    }
    mini.update(mini, dt);
    if (!mini) return;
    drawMini(mini, c);
    mini.raf = requestAnimationFrame(miniLoop);
  }
  function stopMini() {
    if (mini) cancelAnimationFrame(mini.raf);
    mini = null;
    $('keyCatcher').blur();
  }
  function finishMini(joy, baseXp, message, drops, str = 0) {
    const tired = mini.tired;
    stopMini();
    const parts = [];
    if (!tired) {
      S.joy = clamp(S.joy + joy);
      const xp = addXp(baseXp);
      parts.push(t('plusJoy', { n: joy }), t('plusXp', { n: xp }));
      if (str) { S.str += str; parts.push(t('plusStr', { n: str })); }
    }
    if (drops) parts.push(itemsText(dropItems(drops)));
    save(); show('home'); play($('pet'), 'happy', restingAnim());
    toast(`${message} ${parts.join(' · ')}`);
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
    sameShape: true,
    begin(g) {
      g.you = 0; g.cpu = 0; g.px = MINI_W / 2; g.cx = MINI_W / 2;
      g.py = MINI_H - 30; g.cy = 30;
      g.remoteX = MINI_W / 2; g.sendIn = 0;
      pongServe(g, true);
      this.info(g);
    },
    info(g) {
      $('miniInfo').textContent = g.duel ? t('duelScore', { a: g.you, b: g.cpu, name: g.duel.friendName }) : t('pongScore', { a: g.you, b: g.cpu });
    },
    send(g, dt) {
      g.sendIn -= dt;
      if (g.sendIn > 0) return;
      g.sendIn = 1 / 30;
      const b = g.ball;
      if (g.duel.host) g.duel.send({ t: 'pong', bx: b.x, by: b.y, vx: b.vx, vy: b.vy, px: g.px, you: g.you, cpu: g.cpu, wait: g.wait });
      else g.duel.send({ t: 'paddle', x: g.px });
    },
    // The friend's copy: draws the host's ball turned upside down, so both players play from the bottom.
    follow(g, dt) {
      this.send(g, dt);
      const s = g.state;
      if (!s) return;
      g.cx = MINI_W - s.px;
      if (s.wait > 0) return;
      const b = g.ball;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < RICE_R) { b.x = RICE_R; b.vx = Math.abs(b.vx); }
      if (b.x > MINI_W - RICE_R) { b.x = MINI_W - RICE_R; b.vx = -Math.abs(b.vx); }
    },
    net(g, msg) {
      if (msg.t === 'paddle') g.remoteX = msg.x;
      if (msg.t === 'pong') {
        g.state = msg;
        g.ball = { x: MINI_W - msg.bx, y: MINI_H - msg.by, vx: -msg.vx, vy: -msg.vy };
        if (g.you !== msg.cpu || g.cpu !== msg.you) { g.you = msg.cpu; g.cpu = msg.you; this.info(g); }
      }
      if (msg.t === 'pongEnd') finishDuel(msg.hostWon ? 'lose' : 'win', t(msg.hostWon ? 'duelPongLose' : 'duelPongWin', { name: g.duel.friendName }));
    },
    update(g, dt) {
      g.px = Math.max(PIZZA_R, Math.min(MINI_W - PIZZA_R, g.pointerX));
      if (g.duel && !g.duel.host) return this.follow(g, dt);
      if (g.duel) this.send(g, dt);
      if (g.wait > 0) { g.wait -= dt; return; }
      const b = g.ball;
      if (g.duel) g.cx = MINI_W - g.remoteX;
      else {
        const aim = b.vy < 0 ? b.x : MINI_W / 2;
        const reach = (120 + g.you * 18) * dt;
        g.cx += Math.max(-reach, Math.min(reach, aim - g.cx));
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < RICE_R) { b.x = RICE_R; b.vx = Math.abs(b.vx); }
      if (b.x > MINI_W - RICE_R) { b.x = MINI_W - RICE_R; b.vx = -Math.abs(b.vx); }
      pongBounce(b, g.px, g.py);
      pongBounce(b, g.cx, g.cy);
      // Invincible: the rice bounces back off her edge instead of getting past.
      if (cheat('invincible') && !g.duel && b.y > MINI_H - RICE_R) { b.y = MINI_H - RICE_R; b.vy = -Math.abs(b.vy); }
      if (b.y < -12 || b.y > MINI_H + 12) {
        const youScored = b.y < 0;
        if (youScored) g.you += 1; else g.cpu += 1;
        this.info(g);
        if (g.duel && (g.you >= PONG_WIN || g.cpu >= PONG_WIN)) {
          const won = g.you >= PONG_WIN;
          g.duel.send({ t: 'pong', bx: b.x, by: b.y, vx: 0, vy: 0, px: g.px, you: g.you, cpu: g.cpu, wait: 1 });
          g.duel.send({ t: 'pongEnd', hostWon: won });
          return finishDuel(won ? 'win' : 'lose', t(won ? 'duelPongWin' : 'duelPongLose', { name: g.duel.friendName }));
        }
        if (g.you >= PONG_WIN) return finishMini(15, 20, t('pongWin'), 2);
        if (g.cpu >= PONG_WIN) return finishMini(5, 5, t('pongLose'), Math.random() < 0.5 ? 1 : 0);
        pongServe(g, !youScored);
      }
    },
    draw3d(g, c) { Games3D.frame('pong', g, c, MINI_W, MINI_H); },
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
      $('miniInfo').textContent = t('catchInfo', { n: g.score, l: g.lives, s: Math.ceil(g.time) });
    },
    end(g) {
      const joy = Math.min(15, Math.floor(g.score / 2));
      const xp = Math.min(25, g.score);
      finishMini(joy, xp, t('catchDone', { n: g.score }), Math.min(3, Math.floor(g.score / 12)));
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
      for (const item of caught) { if (!item.bad) g.score += 1; else if (!cheat('invincible')) g.lives -= 1; }
      g.items = g.items.filter((i) => !caught.includes(i) && i.y < MINI_H + 30);
      this.info(g);
      if (g.time <= 0 || g.lives <= 0) this.end(g);
    },
    draw3d(g, c) { Games3D.frame('catch', g, c, MINI_W, MINI_H); },
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

  // ----- Garden Parkour -----
  // # hedge, . path, _ gap (jump it), s timed spikes, C checkpoint, V patrolling vegetable, G goal, P start.
  const PARKOUR_MAP = [
    '##########',
    '###.GG.###',
    '###....###',
    '#________#',
    '#........#',
    '#.ss.ss.s#',
    '#........#',
    '####..####',
    '#V.......#',
    '#........#',
    '#..####..#',
    '#.......V#',
    '#___..___#',
    '#___..___#',
    '#...CC...#',
    '#........#',
    '#________#',
    '#........#',
    '##.####.##',
    '#V.......#',
    '#.ssssss.#',
    '#........#',
    '####..####',
    '#........#',
    '#__####__#',
    '#........#',
    '#...CC...#',
    '#.......V#',
    '#________#',
    '#........#',
    '#...P....#',
    '##########',
  ];
  const TILE = 32;
  const WALK_SPEED = 120;
  const JUMP_TIME = 0.5;
  const PARKOUR_HEARTS = 5;
  const tileAt = (x, y) => (PARKOUR_MAP[Math.floor(y / TILE)] || '#')[Math.floor(x / TILE)] || '#';
  const footBlocked = (x, y) => [[-7, -4], [7, -4], [-7, 4], [7, 4]].some(([a, b]) => tileAt(x + a, y + b) === '#');
  const spikesUp = (time, x, y) => (time + (Math.floor(x / TILE) + Math.floor(y / TILE)) * 0.25) % 1.6 < 0.7;
  const GARDEN_PARKOUR = {
    pad: true,
    begin(g) {
      g.held = {}; g.time = 0; g.hearts = PARKOUR_HEARTS; g.jump = 0; g.fall = 0; g.safe = 0; g.facing = 'up'; g.walked = 0; g.flip = false;
      g.foes = [];
      PARKOUR_MAP.forEach((row, y) => [...row].forEach((c, x) => {
        const at = { x: x * TILE + 16, y: y * TILE + 16 };
        if (c === 'P') g.spawn = at;
        if (c === 'V') g.foes.push({ ...at, dir: 1, art: g.foes.length % 2 ? 'carrot' : 'sprout' });
      }));
      g.x = g.spawn.x; g.y = g.spawn.y;
      g.box = t('parkourIntro'); g.boxTime = 0;
      this.info(g);
    },
    info(g) { $('miniInfo').textContent = `${'♥'.repeat(g.hearts)} ${t('parkourInfo', { l: g.hearts })}`; },
    press(g) {
      if (g.box) {
        // The first press finishes the typing; the next one closes the box.
        if (g.boxTime * 30 < g.box.length) g.boxTime = g.box.length / 30; else g.box = null;
        return;
      }
      if (g.jump <= 0 && g.fall <= 0) g.jump = JUMP_TIME;
    },
    hurt(g) {
      if (cheat('invincible')) return;
      g.hearts -= 1;
      g.fall = 0; g.jump = 0; g.safe = 1.2;
      g.x = g.spawn.x; g.y = g.spawn.y;
      this.info(g);
      if (g.hearts <= 0) finishMini(4, 4, t('parkourLose'), 0);
    },
    update(g, dt) {
      if (g.box) {
        g.boxTime += dt;
        return;
      }
      g.time += dt;
      g.safe = Math.max(0, g.safe - dt);
      for (const f of g.foes) {
        f.x += f.dir * 85 * dt;
        if (tileAt(f.x + f.dir * 14, f.y) === '#') f.dir = -f.dir;
      }
      if (g.fall > 0) {
        g.fall -= dt;
        if (g.fall <= 0) this.hurt(g);
        return;
      }
      // The joystick wins when in use. With both keys of a pair held, the one pressed last wins.
      let dx = g.held.right && g.held.left ? (g.lastX === 'left' ? -1 : 1) : (g.held.right ? 1 : 0) - (g.held.left ? 1 : 0);
      let dy = g.held.down && g.held.up ? (g.lastY === 'up' ? -1 : 1) : (g.held.down ? 1 : 0) - (g.held.up ? 1 : 0);
      if (g.stick) { dx = g.stick.x; dy = g.stick.y; }
      const push = Math.hypot(dx, dy);
      if (push > 1) { dx /= push; dy /= push; }
      if (push) {
        const step = WALK_SPEED * dt;
        if (!footBlocked(g.x + dx * step, g.y)) g.x += dx * step;
        if (!footBlocked(g.x, g.y + dy * step)) g.y += dy * step;
        g.walked += step * Math.min(1, push);
        if (Math.abs(dy) >= Math.abs(dx)) g.facing = dy < 0 ? 'up' : 'down';
        else { g.facing = 'side'; g.flip = dx < 0; }
      } else g.walked = 0;
      const air = g.jump > 0;
      if (air) g.jump -= dt;
      else {
        const here = tileAt(g.x, g.y);
        if (here === '_' && !cheat('invincible')) { g.fall = 0.4; return; }
        if (here === 's' && !g.safe && spikesUp(g.time, g.x, g.y)) return this.hurt(g);
        if (here === 'C') g.spawn = { x: Math.floor(g.x / TILE) * TILE + 16, y: Math.floor(g.y / TILE) * TILE + 16 };
        if (here === 'G') return finishMini(15, 25, t('parkourWin'), 2);
      }
      if (!air && !g.safe && g.foes.some((f) => Math.hypot(f.x - g.x, f.y - g.y) < 22)) this.hurt(g);
    },
    draw(g, c) {
      const camY = Math.max(0, Math.min(PARKOUR_MAP.length * TILE - MINI_H, g.y - MINI_H * 0.6));
      c.fillStyle = '#231d33'; c.fillRect(0, 0, MINI_W, MINI_H);
      // On a wide screen the garden hedge fills the sides of the map.
      const side = Math.round((MINI_W - BASE_W) / 2);
      if (side) {
        c.fillStyle = '#2f6b3f'; c.fillRect(0, 0, side, MINI_H); c.fillRect(side + BASE_W, 0, side, MINI_H);
        c.fillStyle = '#3f8a4f';
        for (let y = -Math.round(camY) % TILE - TILE; y < MINI_H; y += TILE) {
          for (let x = side - TILE; x > -TILE; x -= TILE) { c.fillRect(x + 3, y + 3, 10, 8); c.fillRect(x + 17, y + 14, 11, 8); }
          for (let x = side + BASE_W; x < MINI_W; x += TILE) { c.fillRect(x + 3, y + 3, 10, 8); c.fillRect(x + 17, y + 14, 11, 8); }
        }
      }
      c.save(); c.translate(side, -Math.round(camY));
      PARKOUR_MAP.forEach((row, y) => [...row].forEach((ch, x) => {
        const px = x * TILE, py = y * TILE;
        if (py + TILE < camY || py > camY + MINI_H) return;
        if (ch === '#') {
          c.fillStyle = '#2f6b3f'; c.fillRect(px, py, TILE, TILE);
          c.fillStyle = '#3f8a4f'; c.fillRect(px + 3, py + 3, 10, 8); c.fillRect(px + 17, py + 14, 11, 8);
          return;
        }
        if (ch === '_') {
          c.fillStyle = '#17111f'; c.fillRect(px, py, TILE, TILE);
          c.fillStyle = '#3a2a22'; c.fillRect(px, py, TILE, 5);
          return;
        }
        c.fillStyle = (x + y) % 2 ? '#d9bd8c' : '#cfb07d'; c.fillRect(px, py, TILE, TILE);
        if (ch === 'C') { c.fillStyle = '#5fcf80'; c.fillRect(px + 6, py + 6, 20, 20); }
        if (ch === 'G') { c.fillStyle = '#ffc857'; c.fillRect(px + 2, py + 2, 28, 28); }
        if (ch === 's') {
          const up = spikesUp(g.time, px, py);
          c.fillStyle = up ? '#e8604c' : '#8f7a5a';
          for (const [a, b] of [[6, 7], [20, 7], [13, 19]]) c.fillRect(px + a, py + b, 6, up ? 8 : 2);
        }
      }));
      for (const f of g.foes) c.drawImage(ART[f.art], f.x - 16, f.y - 22, 32, 32);
      const air = g.jump > 0 ? Math.sin((1 - g.jump / JUMP_TIME) * Math.PI) * 18 : 0;
      c.fillStyle = '#0005'; c.fillRect(g.x - 9, g.y + 4, 18, 4);
      const flicker = g.safe > 0 && Math.floor(g.safe * 10) % 2;
      if (!flicker) {
        const shrink = g.fall > 0 ? g.fall / 0.4 : 1;
        const col = g.walked ? Math.floor(g.walked / 14) % 4 : 0;
        const row = { down: 0, up: 1, side: 2 }[g.facing];
        c.save();
        c.translate(g.x, g.y + 6 - air);
        c.scale(g.facing === 'side' && g.flip ? -shrink : shrink, shrink);
        c.drawImage(ART.walker, col * 16, row * 22, 16, 22, -21, -36, 42, 36);
        c.restore();
      }
      c.restore();
      this.drawBox(g, c);
    },
    draw3d(g, c) {
      Games3D.frame('parkour', g, c, MINI_W, MINI_H, { map: PARKOUR_MAP, tile: TILE, look: skinNow().id, spikesUp });
      this.drawBox(g, c);
    },
    drawBox(g, c) {
      if (g.box) {
        c.fillStyle = '#000'; c.fillRect(10, MINI_H - 110, MINI_W - 20, 100);
        c.strokeStyle = '#f6eedd'; c.lineWidth = 4; c.strokeRect(12, MINI_H - 108, MINI_W - 24, 96);
        c.fillStyle = '#f6eedd'; c.font = 'bold 16px "Courier New", monospace';
        const shown = g.box.slice(0, Math.floor(g.boxTime * 30));
        let line = '', y = MINI_H - 84;
        for (const word of shown.split(' ')) {
          if (c.measureText(`${line}${word}`).width > MINI_W - 48) { c.fillText(line, 24, y); y += 20; line = ''; }
          line += `${word} `;
        }
        c.fillText(line, 24, y);
      }
    },
  };

  // ----- Rice Rhythm -----
  // Rice falls down four lanes onto four poke bowls; press a bowl as the rice lands on it.
  // It never ends on its own: it speeds up as you score, and too many misses finish it.
  const RHYTHM_LANES = 4;
  const laneW = () => MINI_W / RHYTHM_LANES;
  const RHYTHM_HIT_Y = 382;
  const RHYTHM_GOOD = 34; // How far from the bowl (in pixels) a press still counts.
  const RHYTHM_PERFECT = 12;
  const RHYTHM_MISSES = 5;
  const RHYTHM_COLORS = ['#c46ad8', '#5aa8e8', '#5fcf80', '#e8604c'];
  // Left, down, up, right like other rhythm games, plus D F J K and A S W D style keys.
  const RHYTHM_KEYS = {
    ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
    KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3,
  };
  const RHYTHM_LABELS = ['D ←', 'F ↓', 'J ↑', 'K →'];
  // In a battle the pace follows the clock instead of the score, so both players get the same rice.
  const rhythmLevel = (g) => (g.duel ? g.time * 1.1 : g.score);
  const rhythmSpeed = (g) => Math.min(560, 170 + rhythmLevel(g) * 3.2);
  const rhythmGap = (g) => Math.max(0.2, 0.78 - rhythmLevel(g) * 0.0075);
  const RICE_RHYTHM = {
    keys: true,
    cost: TRAIN_COST,
    begin(g) {
      g.score = 0; g.combo = 0; g.bestCombo = 0; g.misses = 0; g.notes = []; g.spawn = 1.2;
      g.flash = [0, 0, 0, 0]; g.bump = [0, 0, 0, 0]; g.word = null;
      g.time = 0; g.rand = g.duel ? g.duel.rand : Math.random; g.rivalScore = 0; g.rivalOut = null; g.out = false;
      this.info(g);
    },
    info(g) {
      const l = '♥'.repeat(Math.max(0, RHYTHM_MISSES - g.misses));
      $('miniInfo').textContent = g.duel ? t('duelRhythmInfo', { n: g.score, r: g.rivalScore, name: g.duel.friendName, l })
        : t('rhythmInfo', { n: g.score, c: g.combo, l });
    },
    net(g, msg) {
      if (msg.t === 'rscore') { g.rivalScore = msg.n; this.info(g); }
      if (msg.t === 'rout') { g.rivalScore = msg.n; g.rivalOut = msg.n; this.info(g); this.settle(g); }
    },
    // Once both players are out of hearts, the higher score wins.
    settle(g) {
      if (!g.out || g.rivalOut === null) return;
      const name = g.duel.friendName;
      if (g.score === g.rivalOut) finishDuel('draw', t('duelDraw'));
      else if (g.score > g.rivalOut) finishDuel('win', t('duelRhythmWin', { name }));
      else finishDuel('lose', t('duelRhythmLose', { name }));
    },
    say(g, key, color) { g.word = { text: t(key), color, time: 0.5 }; },
    miss(g) {
      g.combo = 0;
      this.say(g, 'rhythmMiss', '#e8604c');
      if (cheat('invincible') && !g.duel) return;
      g.misses += 1;
      if (g.misses >= RHYTHM_MISSES) this.end(g);
    },
    press(g, lane) {
      if (!mini || lane < 0 || lane >= RHYTHM_LANES) return;
      g.flash[lane] = 0.12;
      const hit = g.notes
        .filter((n) => n.lane === lane && Math.abs(n.y - RHYTHM_HIT_Y) <= RHYTHM_GOOD)
        .sort((a, b) => b.y - a.y)[0];
      if (!hit) { this.miss(g); this.info(g); return; }
      g.notes = g.notes.filter((n) => n !== hit);
      g.score += 1; g.combo += 1; g.bestCombo = Math.max(g.bestCombo, g.combo);
      g.bump[lane] = 0.15;
      const perfect = Math.abs(hit.y - RHYTHM_HIT_Y) <= RHYTHM_PERFECT;
      this.say(g, perfect ? 'rhythmPerfect' : 'rhythmGood', perfect ? '#ffc857' : '#f6eedd');
      if (g.duel) g.duel.send({ t: 'rscore', n: g.score });
      this.info(g);
    },
    end(g) {
      if (g.duel) {
        g.out = true; g.notes = [];
        g.duel.send({ t: 'rout', n: g.score });
        return this.settle(g);
      }
      const best = g.score > (S.rhythmBest || 0);
      if (best) S.rhythmBest = g.score;
      // The more rice, the bigger the prize.
      const drops = Math.min(10, Math.floor(g.score / 12));
      const str = Math.min(3, Math.floor(g.score / 25));
      const message = `${t('rhythmDone', { n: g.score, c: g.bestCombo })}${best && g.score ? ` ${t('newBest')}` : ''}`;
      finishMini(Math.min(25, Math.floor(g.score / 4)), Math.min(90, 5 + g.score), message, drops, str);
    },
    update(g, dt) {
      if (g.out) return;
      g.time += dt;
      g.flash = g.flash.map((f) => Math.max(0, f - dt));
      g.bump = g.bump.map((f) => Math.max(0, f - dt));
      if (g.word) { g.word.time -= dt; if (g.word.time <= 0) g.word = null; }
      g.spawn -= dt;
      if (g.spawn <= 0) {
        g.spawn = rhythmGap(g);
        const lane = Math.floor(g.rand() * RHYTHM_LANES);
        g.notes.push({ lane, y: -20 });
        // Later on, sometimes two rice fall together.
        const pair = g.rand() < 0.25, other = Math.floor(g.rand() * 3);
        if (rhythmLevel(g) > 30 && pair) g.notes.push({ lane: (lane + 1 + other) % RHYTHM_LANES, y: -20 });
      }
      const speed = rhythmSpeed(g);
      for (const n of g.notes) n.y += speed * dt;
      const missed = g.notes.filter((n) => n.y > RHYTHM_HIT_Y + RHYTHM_GOOD);
      if (missed.length) {
        g.notes = g.notes.filter((n) => !missed.includes(n));
        for (const _n of missed) { if (!mini) return; this.miss(g); }
        this.info(g);
      }
    },
    draw(g, c) {
      c.fillStyle = '#231d33'; c.fillRect(0, 0, MINI_W, MINI_H);
      for (let i = 0; i < RHYTHM_LANES; i++) {
        const x = i * laneW();
        c.fillStyle = i % 2 ? '#2b2340' : '#271f3a';
        c.fillRect(x, 0, laneW(), MINI_H);
        if (g.flash[i]) { c.globalAlpha = g.flash[i] * 3; c.fillStyle = RHYTHM_COLORS[i]; c.fillRect(x, 0, laneW(), MINI_H); c.globalAlpha = 1; }
        c.fillStyle = RHYTHM_COLORS[i];
        c.fillRect(x + 4, RHYTHM_HIT_Y - 28, laneW() - 8, 4);
      }
      for (const n of g.notes) {
        const cx = n.lane * laneW() + laneW() / 2;
        c.drawImage(ART.rice, cx - 16, n.y - 10, 32, 20);
      }
      for (let i = 0; i < RHYTHM_LANES; i++) {
        const cx = i * laneW() + laneW() / 2;
        const lift = g.bump[i] ? 6 : 0;
        c.drawImage(ART.bowl, 0, 0, 20, 14, cx - 32, RHYTHM_HIT_Y - 18 - lift, 64, 45);
      }
      this.hud(g, c);
    },
    draw3d(g, c) {
      Games3D.frame('rhythm', g, c, MINI_W, MINI_H, { hitY: RHYTHM_HIT_Y });
      this.hud(g, c);
    },
    hud(g, c) {
      for (let i = 0; i < RHYTHM_LANES; i++) {
        const cx = i * laneW() + laneW() / 2;
        if (usesKeyboard()) {
          c.fillStyle = '#b9aec9'; c.font = 'bold 13px "Courier New", monospace'; c.textAlign = 'center';
          c.fillText(RHYTHM_LABELS[i], cx, MINI_H - 10);
        }
      }
      if (g.word) {
        c.globalAlpha = Math.min(1, g.word.time * 3);
        c.fillStyle = g.word.color; c.font = 'bold 26px "Courier New", monospace'; c.textAlign = 'center';
        c.fillText(g.word.text, MINI_W / 2, 200);
        c.globalAlpha = 1;
      }
      if (g.out) {
        c.fillStyle = '#ffc857'; c.font = 'bold 18px "Courier New", monospace'; c.textAlign = 'center';
        c.fillText(t('duelWaitRival', { name: g.duel.friendName }), MINI_W / 2, 230);
      } else if (g.combo >= 5) {
        c.fillStyle = '#ffc857'; c.font = 'bold 18px "Courier New", monospace'; c.textAlign = 'center';
        c.fillText(t('rhythmCombo', { n: g.combo }), MINI_W / 2, 230);
      }
      c.textAlign = 'left';
    },
  };

  // ----- Wipe-Uff -----
  // A poke-bowl kart race through a big vegetable garden, drawn as a pseudo-3D road (each slice of track
  // is projected onto the screen, nearest last). Three laps against three veggie bots, or against a friend.
  const WU = {
    SEG: 200, ROAD: 2200, CAM_H: 1500, DEPTH: 1 / Math.tan((50 * Math.PI) / 180), DRAW: 320, HALF: BASE_W / 2,
    MAX: 8000, LAPS: 3, CENTRI: 0.3, RUMBLE: 3, BOX_RESPAWN: 3,
  };
  WU.ACCEL = WU.MAX / 4; WU.OFF_DECEL = WU.MAX / 1.6; WU.OFF_LIMIT = WU.MAX / 4;
  const WU_ART = Object.fromEntries(['kart', 'cabbage', 'tomato', 'sunflower', 'carrots', 'fence', 'box', 'wasabi', 'chili', 'soy', 'soybottle']
    .map((n) => [n, art(`sprites/wipeuff/${n}.png`)]));
  // World widths of the scenery, so everything keeps its size as it comes closer.
  const WU_SIZE = { cabbage: 700, tomato: 520, sunflower: 600, carrots: 800, fence: 1100, box: 330, soy: 600, chili: 330, kart: 620 };
  const WU_ITEMS = ['wasabi', 'chili', 'soy'];
  const WU_BOTS = [
    { name: 'bossBroccoli', art: 'broccoli', skill: 0.9 },
    { name: 'bossCarrot', art: 'carrot', skill: 0.87 },
    { name: 'bossSprout', art: 'sprout', skill: 0.84 },
  ];
  const ease = { in: (a, b, p) => a + (b - a) * p * p, inOut: (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5) };
  // The same garden circuit every time: built once from straights, bends and gentle hills.
  const WU_TRACK = (() => {
    const segs = [];
    const lastY = () => (segs.length ? segs[segs.length - 1].p2.y : 0);
    const add = (curve, y) => {
      const n = segs.length;
      segs.push({ i: n, p1: { z: n * WU.SEG, y: lastY() }, p2: { z: (n + 1) * WU.SEG, y }, curve, sprites: [], boxes: [] });
    };
    const road = (enter, hold, leave, curve, hill) => {
      const y0 = lastY(), y1 = y0 + hill * WU.SEG, total = enter + hold + leave;
      for (let n = 0; n < enter; n++) add(ease.in(0, curve, n / enter), ease.inOut(y0, y1, (n + 1) / total));
      for (let n = 0; n < hold; n++) add(curve, ease.inOut(y0, y1, (enter + n + 1) / total));
      for (let n = 0; n < leave; n++) add(ease.inOut(curve, 0, n / leave), ease.inOut(y0, y1, (enter + hold + n + 1) / total));
    };
    road(30, 40, 30, 0, 0);
    road(25, 50, 25, 2, 10);
    road(20, 30, 20, 0, -10);
    road(25, 40, 25, -3, 0);
    road(25, 25, 25, 2, 15);
    road(25, 25, 25, -2, -15);
    road(30, 60, 30, -2, 0);
    road(20, 20, 20, 3, 8);
    road(20, 40, 20, 0, -8);
    road(25, 50, 25, 2.5, 0);
    road(25, 30, 25, -1.5, 0);
    road(30, 50, 30, 0, -lastY() / WU.SEG);
    // Scenery along both sides, picked by a fixed pattern so the garden never changes.
    const kinds = ['cabbage', 'tomato', 'sunflower', 'carrots', 'cabbage', 'tomato'];
    for (let i = 20; i < segs.length; i += 6) {
      const k = kinds[(i * 7) % kinds.length];
      segs[i].sprites.push({ art: k, x: -(1.35 + ((i * 13) % 9) / 10) });
      segs[(i + 3) % segs.length].sprites.push({ art: kinds[(i * 5 + 2) % kinds.length], x: 1.35 + ((i * 11) % 9) / 10 });
    }
    for (let i = 0; i < segs.length; i += 40) {
      segs[i].sprites.push({ art: 'fence', x: -1.25 }, { art: 'fence', x: 1.25 });
    }
    // Rows of item crates.
    for (let i = 60; i < segs.length - 20; i += 140) for (const x of [-0.55, 0, 0.55]) segs[i].boxes.push({ x, gone: 0 });
    return { segs, length: segs.length * WU.SEG };
  })();
  const wuSeg = (z) => WU_TRACK.segs[Math.floor(((z % WU_TRACK.length) + WU_TRACK.length) % WU_TRACK.length / WU.SEG) % WU_TRACK.segs.length];
  const wuDist = (k) => k.lap * WU_TRACK.length + k.z;
  const wuOrdinal = (n) => t(`wuPlace${n}`);
  function wuProject(p, camX, camY, camZ, roadW) {
    const cz = p.z - camZ;
    p.scale = WU.DEPTH / cz;
    p.sx = Math.round(MINI_W / 2 + p.scale * (p.x - camX) * WU.HALF);
    p.sy = Math.round(MINI_H / 2 - p.scale * (p.y - camY) * MINI_H / 2);
    p.sw = Math.round(p.scale * roadW * WU.HALF);
    p.cz = cz;
  }
  const WU_HAZE = [226, 238, 236];
  const fogCache = new Map();
  function wuFog(hex, f) {
    if (f <= 0) return hex;
    const key = hex + Math.round(f * 20);
    if (!fogCache.has(key)) {
      const q = Math.round(f * 20) / 20;
      const rgb = [1, 3, 5].map((i, k) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - q) + WU_HAZE[k] * q));
      fogCache.set(key, `rgb(${rgb.join(',')})`);
    }
    return fogCache.get(key);
  }
  function wuQuad(c, color, x1, y1, w1, x2, y2, w2) {
    c.fillStyle = color;
    c.beginPath();
    // Overlaps the next slice by a pixel so no seams show between them.
    c.moveTo(x1 - w1, y1 + 1); c.lineTo(x2 - w2, y2); c.lineTo(x2 + w2, y2); c.lineTo(x1 + w1, y1 + 1);
    c.closePath(); c.fill();
  }
  // Racers are the player ("me"), the bots, and in a friendly race the friend.
  function wuRacer(fields) {
    return { z: 0, x: 0, speed: 0, lap: 0, spin: 0, boost: 0, item: null, done: false, ...fields };
  }
  function wuSpinOut(k) {
    if (k.me && cheat('invincible') && !mini?.duel) return;
    k.spin = 1.2; k.speed *= 0.35;
  }
  const WIPE_UFF = {
    pad: true,
    hiRes: true,
    padBtn: 'wuItem',
    keysHint: 'wuKeysHint',
    begin(g) {
      g.held = {}; g.time = 0; g.countdown = 3; g.msg = null; g.shots = []; g.slicks = []; g.sky = 0; g.sendIn = 0;
      for (const s of WU_TRACK.segs) for (const b of s.boxes) b.gone = 0;
      g.driver = art(skinNow().back);
      g.me = wuRacer({ me: true, name: Cloud.user()?.name || t('guestName'), x: g.duel ? (g.duel.host ? -0.35 : 0.35) : 0.3, z: 0 });
      g.racers = [g.me];
      if (g.duel) {
        g.rival = wuRacer({ name: g.duel.friendName, x: g.duel.host ? 0.35 : -0.35, z: 0, driver: art(skinBack(g.duel.rivalSkin)), remote: true });
        g.racers.push(g.rival);
      } else {
        WU_BOTS.forEach((b, i) => g.racers.push(wuRacer({
          name: t(b.name), bot: b, x: [-0.5, 0.5, -0.1][i], z: (i + 1) * WU.SEG * 3, driverArt: ART[b.art] || art(`sprites/boss_${b.art}.png`),
          itemIn: 6 + Math.random() * 6,
        })));
        g.me.z = 0;
      }
      this.info(g);
    },
    place(g, k) { return 1 + g.racers.filter((o) => o !== k && wuDist(o) > wuDist(k)).length; },
    info(g) {
      const lap = Math.min(WU.LAPS, g.me.lap + 1);
      $('miniInfo').textContent = t('wuInfo', { l: lap, n: WU.LAPS, p: wuOrdinal(this.place(g, g.me)) });
    },
    say(g, text) { g.msg = { text, time: 1.8 }; },
    press(g) {
      const k = g.me;
      if (!k.item || g.countdown > 0 || k.done) return;
      this.useItem(g, k);
    },
    useItem(g, k) {
      const item = k.item;
      k.item = null;
      if (item === 'wasabi') { k.boost = 1.6; k.speed = Math.max(k.speed, WU.MAX); if (k.me) this.say(g, t('wuBoost')); }
      if (item === 'soy') {
        const slick = { z: (k.z - 350 + WU_TRACK.length) % WU_TRACK.length, x: k.x, by: k };
        g.slicks.push(slick);
        if (g.duel && k.me) g.duel.send({ t: 'slick', z: slick.z, x: slick.x });
      }
      if (item === 'chili') {
        // The chili flies after whoever is just ahead.
        const ahead = g.racers.filter((o) => o !== k && !o.done && wuDist(o) > wuDist(k)).sort((a, b) => wuDist(a) - wuDist(b))[0];
        if (!ahead) { if (k.me) this.say(g, t('wuNoTarget')); return; }
        g.shots.push({ z: k.z, lap: k.lap, x: k.x, from: k, target: ahead });
      }
    },
    giveItem(g, k) {
      // Racers further back get the better items.
      const place = this.place(g, k);
      const pool = place === 1 ? ['soy', 'soy', 'wasabi'] : place === g.racers.length ? ['chili', 'wasabi', 'chili'] : WU_ITEMS;
      k.item = pool[Math.floor(Math.random() * pool.length)];
      if (k.me) this.say(g, t(`wuGot_${k.item}`));
    },
    drive(g, k, dt, steer) {
      const seg = wuSeg(k.z);
      const top = WU.MAX * (k.boost > 0 ? 1.35 : 1) * (k.bot ? k.bot.skill * k.rubber : 1);
      if (k.spin > 0) { k.spin -= dt; k.speed = Math.max(0, k.speed - WU.ACCEL * dt); } else k.speed = Math.min(top, k.speed + WU.ACCEL * dt * (k.speed > top ? -1 : 1));
      k.boost = Math.max(0, k.boost - dt);
      const pct = k.speed / WU.MAX;
      k.x += steer * dt * 2.2 * Math.min(1, pct + 0.2);
      k.x -= dt * 2 * pct * seg.curve * WU.CENTRI;
      if (Math.abs(k.x) > 1 && k.speed > WU.OFF_LIMIT && !k.boost) k.speed = Math.max(WU.OFF_LIMIT, k.speed - WU.OFF_DECEL * dt);
      k.x = Math.max(-2, Math.min(2, k.x));
      k.z += k.speed * dt;
      if (k.z >= WU_TRACK.length) { k.z -= WU_TRACK.length; k.lap += 1; }
      // Item crates and soy slicks under the wheels.
      const here = wuSeg(k.z);
      for (const b of here.boxes) if (!b.gone && Math.abs(b.x - k.x) < 0.3) { b.gone = WU.BOX_RESPAWN; if (!k.item && !k.remote) this.giveItem(g, k); }
      for (const s of g.slicks) if (s.by !== k || s.armed) {
        if (Math.abs(((s.z - k.z + WU_TRACK.length * 1.5) % WU_TRACK.length) - WU_TRACK.length / 2) < 150 && Math.abs(s.x - k.x) < 0.3) {
          s.hit = true; wuSpinOut(k);
          if (k.me) this.say(g, t('wuSlipped'));
        }
      }
    },
    update(g, dt) {
      g.time += dt;
      if (g.msg) { g.msg.time -= dt; if (g.msg.time <= 0) g.msg = null; }
      for (const s of WU_TRACK.segs) for (const b of s.boxes) b.gone = Math.max(0, b.gone - dt);
      g.slicks = g.slicks.filter((s) => !s.hit);
      for (const s of g.slicks) if (!s.armed && Math.abs(wuDist(s.by) - s.z) > 0) s.armed = (s.by.z - s.z + WU_TRACK.length) % WU_TRACK.length > 600;
      const me = g.me;
      if (!me.done) {
        let steer = (g.held.right ? 1 : 0) - (g.held.left ? 1 : 0);
        if (g.stick) steer = g.stick.x;
        const before = me.lap;
        this.drive(g, me, dt, steer);
        if (me.lap !== before && me.lap < WU.LAPS) this.say(g, me.lap === WU.LAPS - 1 ? t('wuFinalLap') : t('wuLap', { n: me.lap + 1 }));
        if (me.lap >= WU.LAPS) return this.finish(g);
      }
      g.sky += dt * (me.speed / WU.MAX) * wuSeg(me.z).curve * 0.06;
      // Bots keep up with the player a little (rubber band) so races stay close.
      for (const k of g.racers) {
        if (!k.bot) continue;
        const gap = wuDist(k) - wuDist(me);
        k.rubber = gap < -3000 ? 1.12 : gap > 3000 ? 0.94 : 1;
        const seg = wuSeg(k.z + WU.SEG * 6);
        k.aim = k.aim ?? k.x;
        if (Math.random() < dt * 0.5) k.aim = (Math.random() - 0.5) * 1.3;
        const steer = Math.max(-1, Math.min(1, (k.aim - seg.curve * 0.12 - k.x) * 2));
        this.drive(g, k, dt, steer);
        k.itemIn -= dt;
        if (!k.item && k.itemIn <= 0) { k.item = WU_ITEMS[Math.floor(Math.random() * 3)]; k.itemIn = 7 + Math.random() * 7; }
        if (k.item && Math.random() < dt * 0.4) this.useItem(g, k);
        if (k.lap >= WU.LAPS && !k.done) k.done = g.time;
      }
      // Bumping into each other slows down the one behind.
      for (const k of g.racers) for (const o of g.racers) {
        if (k === o || k.remote) continue;
        const dz = wuDist(o) - wuDist(k);
        if (dz > 0 && dz < 260 && Math.abs(o.x - k.x) < 0.35 && k.speed > o.speed) { k.speed = o.speed * 0.9; k.x += k.x < o.x ? -0.05 : 0.05; }
      }
      // Chilis home in on their target.
      for (const s of g.shots) {
        const tgt = s.target;
        s.z += WU.MAX * 1.7 * dt;
        if (s.z >= WU_TRACK.length) { s.z -= WU_TRACK.length; s.lap += 1; }
        s.x += (tgt.x - s.x) * Math.min(1, dt * 6);
        if (s.lap * WU_TRACK.length + s.z >= wuDist(tgt)) {
          s.hit = true;
          if (tgt.remote) g.duel.send({ t: 'chili' }); else wuSpinOut(tgt);
          if (s.from.me) this.say(g, t('wuHit', { name: tgt.name }));
          else if (tgt.me) this.say(g, t('wuGotHit', { name: s.from.name }));
        }
      }
      g.shots = g.shots.filter((s) => !s.hit);
      if (g.duel) {
        g.sendIn -= dt;
        if (g.sendIn <= 0) { g.sendIn = 1 / 15; g.duel.send({ t: 'pos', z: me.z, x: me.x, lap: me.lap, speed: me.speed }); }
        const r = g.rival;
        if (r.net) { // Glide towards the friend's last known spot.
          r.speed = r.net.speed; r.lap = r.net.lap;
          let dz = r.net.z - r.z;
          if (Math.abs(dz) > WU_TRACK.length / 2) dz -= Math.sign(dz) * WU_TRACK.length;
          r.z = (r.z + dz * Math.min(1, dt * 10) + r.speed * dt * 0.3 + WU_TRACK.length) % WU_TRACK.length;
          r.x += (r.net.x - r.x) * Math.min(1, dt * 10);
        }
      }
      this.info(g);
    },
    net(g, msg) {
      if (msg.t === 'pos') g.rival.net = msg;
      if (msg.t === 'chili') { wuSpinOut(g.me); this.say(g, t('wuGotHit', { name: g.rival.name })); }
      if (msg.t === 'slick') g.slicks.push({ z: msg.z, x: msg.x, by: g.rival, armed: true });
      if (msg.t === 'raceDone') finishDuel('lose', t('wuDuelLost', { name: g.rival.name }));
    },
    finish(g) {
      const me = g.me;
      me.done = g.time;
      if (g.duel) {
        g.duel.send({ t: 'raceDone' });
        return finishDuel('win', t('wuDuelWon'));
      }
      const place = this.place(g, me);
      if (place === 1) S.raceWins = (S.raceWins || 0) + 1;
      const prize = [[20, 40, 3, 300], [12, 25, 2, 150], [8, 15, 1, 75], [5, 8, 0, 25]][place - 1];
      const tired = mini.tired;
      if (!tired) S.poken = (S.poken || 0) + prize[3];
      finishMini(prize[0], prize[1], `${t('wuDone', { p: wuOrdinal(place) })}${tired ? '' : ` · +${prize[3]} Poken ·`}`, prize[2]);
    },
    draw(g, c) {
      // Sky with a low sun, soft clouds and two rows of hills that slide sideways on bends.
      const HZ = MINI_H / 2;
      const sky = c.createLinearGradient(0, 0, 0, HZ);
      sky.addColorStop(0, '#3f8fdc'); sky.addColorStop(0.6, '#8fcdf2'); sky.addColorStop(1, '#f3ecd8');
      c.fillStyle = sky; c.fillRect(0, 0, MINI_W, HZ + 2);
      const sunX = MINI_W * 0.72 - ((g.sky * 40) % (MINI_W * 2)), sunY = HZ * 0.38;
      const glow = c.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
      glow.addColorStop(0, 'rgba(255,248,220,.95)'); glow.addColorStop(0.25, 'rgba(255,236,180,.45)'); glow.addColorStop(1, 'rgba(255,236,180,0)');
      c.fillStyle = glow; c.fillRect(0, 0, MINI_W, HZ);
      c.fillStyle = '#fffbe9'; c.beginPath(); c.arc(sunX, sunY, 13, 0, Math.PI * 2); c.fill();
      const wrap = (x, span) => ((x % span) + span) % span;
      for (const [speed, y0, a, sz] of [[60, 34, 0.55, 0.8], [130, 70, 0.85, 1.1]]) {
        c.fillStyle = `rgba(255,255,255,${a})`;
        for (let i = 0; i < 4; i++) {
          const span = MINI_W + 160;
          const x = wrap(i * span / 4 + (i * 37) % 50 - g.sky * speed, span) - 80, y = y0 + ((i * 23) % 3) * 10;
          for (const [ox, oy, rr] of [[0, 0, 12], [14, -6, 15], [30, 0, 11], [16, 4, 12]]) {
            c.beginPath(); c.arc(x + ox * sz, y + oy * sz, rr * sz, 0, Math.PI * 2); c.fill();
          }
        }
      }
      const hills = (speed, color, shade, height, bumps, seed) => {
        const span = MINI_W * 2, off = wrap(-g.sky * speed, span);
        c.fillStyle = color; c.beginPath(); c.moveTo(0, HZ + 2);
        for (let x = 0; x <= MINI_W; x += 4) {
          const u = (x - off) / span * Math.PI * 2;
          c.lineTo(x, HZ - height * (0.55 + 0.3 * Math.sin(u * bumps + seed) + 0.15 * Math.sin(u * bumps * 2.7 + seed * 2)));
        }
        c.lineTo(MINI_W, HZ + 2); c.closePath(); c.fill();
        const fade = c.createLinearGradient(0, HZ - height, 0, HZ + 2);
        fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, shade);
        c.fillStyle = fade; c.fill();
      };
      hills(90, '#9cbcd6', 'rgba(226,238,236,.9)', 58, 3, 1);
      hills(260, '#78b268', 'rgba(226,238,236,.75)', 30, 5, 4);
      c.fillStyle = '#5ea64c'; c.fillRect(0, HZ, MINI_W, MINI_H - HZ);
      const me = g.me;
      // The road is drawn from the camera (a little behind her) forwards, so it reaches the bottom of the screen.
      const L = WU_TRACK.length;
      const camZ = (((me.z - WU.CAM_H * WU.DEPTH * 1.6) % L) + L) % L;
      const base = wuSeg(camZ);
      const pct = (camZ % WU.SEG) / WU.SEG;
      const camY = WU.CAM_H + base.p1.y + (base.p2.y - base.p1.y) * pct;
      let maxY = MINI_H, x = 0, dx = -(base.curve * pct);
      const drawn = [];
      for (let n = 0; n < WU.DRAW; n++) {
        const seg = WU_TRACK.segs[(base.i + n) % WU_TRACK.segs.length];
        const loop = seg.i < base.i ? WU_TRACK.length : 0;
        const p1 = { x: 0, y: seg.p1.y, z: seg.p1.z + loop }, p2 = { x: 0, y: seg.p2.y, z: seg.p2.z + loop };
        wuProject(p1, me.x * WU.ROAD - x, camY, camZ, WU.ROAD);
        wuProject(p2, me.x * WU.ROAD - x - dx, camY, camZ, WU.ROAD);
        x += dx; dx += seg.curve;
        seg.view = { p1, clip: maxY };
        drawn.push(seg);
        if (p1.cz <= WU.DEPTH || p2.sy >= p1.sy || p2.sy >= maxY) continue;
        const band = Math.floor(seg.i / WU.RUMBLE) % 2;
        const fog = Math.max(0, (n / WU.DRAW - 0.35) / 0.65) ** 1.4;
        c.fillStyle = wuFog(band ? '#66b452' : '#5aa647', fog);
        c.fillRect(0, p2.sy, MINI_W, p1.sy - p2.sy + 1);
        wuQuad(c, wuFog(band ? '#4f9a3f' : '#4a9139', fog), p1.sx, p1.sy, p1.sw * 1.3, p2.sx, p2.sy, p2.sw * 1.3);
        wuQuad(c, wuFog(band ? '#e0473b' : '#fbf6ea', fog), p1.sx, p1.sy, p1.sw * 1.14, p2.sx, p2.sy, p2.sw * 1.14);
        wuQuad(c, wuFog('#9c7448', fog), p1.sx, p1.sy, p1.sw * 1.02, p2.sx, p2.sy, p2.sw * 1.02);
        wuQuad(c, wuFog(band ? '#cba26c' : '#c39a63', fog), p1.sx, p1.sy, p1.sw * 0.94, p2.sx, p2.sy, p2.sw * 0.94);
        wuQuad(c, wuFog(band ? '#d4ad78' : '#cca46e', fog), p1.sx, p1.sy, p1.sw * 0.5, p2.sx, p2.sy, p2.sw * 0.5);
        if (band) wuQuad(c, wuFog('#fbf3dc', fog), p1.sx, p1.sy, p1.sw * 0.025, p2.sx, p2.sy, p2.sw * 0.025);
        if (seg.i < 3) wuQuad(c, seg.i % 2 ? '#222' : '#fff', p1.sx, p1.sy, p1.sw, p2.sx, p2.sy, p2.sw);
        maxY = p1.sy;
      }
      const haze = c.createLinearGradient(0, MINI_H / 2 - 10, 0, MINI_H / 2 + 26);
      haze.addColorStop(0, 'rgba(226,238,236,0)'); haze.addColorStop(0.4, 'rgba(226,238,236,.55)'); haze.addColorStop(1, 'rgba(226,238,236,0)');
      c.fillStyle = haze; c.fillRect(0, MINI_H / 2 - 10, MINI_W, 36);
      // Everything standing on the track, far to near, cut off where a hill hides it.
      const sprite = (img, worldW, seg, offX, lift = 0) => {
        const p = seg.view.p1;
        if (!img.complete || !img.naturalWidth || p.cz <= WU.DEPTH) return;
        const w = worldW * p.scale * WU.HALF;
        const h = (w * img.naturalHeight) / img.naturalWidth;
        const sx = p.sx + p.sw * offX - w / 2;
        const sy = p.sy - h - lift * p.scale * MINI_H / 2;
        const clipH = Math.max(0, Math.min(h, seg.view.clip - sy));
        if (clipH <= 0 || w < 1) return;
        c.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * (clipH / h), sx, sy, w, clipH);
      };
      const racersBySeg = new Map();
      for (const k of g.racers) if (k !== me) {
        const seg = wuSeg(k.z);
        racersBySeg.set(seg, [...(racersBySeg.get(seg) || []), k]);
      }
      for (let n = drawn.length - 1; n >= 1; n--) {
        const seg = drawn[n];
        for (const s of seg.sprites) sprite(WU_ART[s.art], WU_SIZE[s.art], seg, s.x);
        for (const b of seg.boxes) if (!b.gone) sprite(WU_ART.box, WU_SIZE.box, seg, b.x, 120 + Math.sin(g.time * 4) * 40);
        for (const s of g.slicks) if (wuSeg(s.z) === seg) sprite(WU_ART.soy, WU_SIZE.soy, seg, s.x);
        for (const s of g.shots) if (wuSeg(s.z) === seg) sprite(WU_ART.chili, WU_SIZE.chili, seg, s.x, 150);
        for (const k of racersBySeg.get(seg) || []) {
          const driver = k.driverArt;
          if (k.driver) { // A friend in their own kart: their head pokes out of the bowl.
            if (k.driver.complete && k.driver.naturalWidth) {
              const p = seg.view.p1, w = 260 * p.scale * WU.HALF;
              c.drawImage(k.driver, p.sx + p.sw * k.x - w / 2, p.sy - w * 1.45, w, (w * 28) / 30);
            }
          } else if (driver) sprite(driver, 300, seg, k.x, 230);
          { const p = seg.view.p1; if (p.cz > WU.DEPTH && p.sy < seg.view.clip) {
            const w = WU_SIZE.kart * p.scale * WU.HALF;
            c.fillStyle = 'rgba(30,40,20,.35)'; c.beginPath(); c.ellipse(p.sx + p.sw * k.x, p.sy, w * 0.55, w * 0.12, 0, 0, Math.PI * 2); c.fill();
          } }
          sprite(WU_ART.kart, WU_SIZE.kart, seg, k.x + (k.spin > 0 ? Math.sin(g.time * 30) * 0.05 : 0));
        }
      }
      // The player's own kart, always near the bottom of the screen.
      const wob = me.spin > 0 ? Math.sin(g.time * 30) * 8 : 0;
      const bounce = me.speed > 100 ? Math.round(Math.sin(g.time * 22)) : 0;
      const kx = MINI_W / 2 - 44 + wob, ky = MINI_H - 74 + bounce;
      c.fillStyle = 'rgba(30,40,20,.4)'; c.beginPath(); c.ellipse(MINI_W / 2 + wob, ky + 56, 46, 9, 0, 0, Math.PI * 2); c.fill();
      if (g.driver.complete) c.drawImage(g.driver, kx + 28, ky - 20, 32, 30);
      c.drawImage(WU_ART.kart, kx, ky, 88, 57);
      const fast = me.speed / WU.MAX;
      if (fast > 0.75) {
        c.strokeStyle = `rgba(255,255,255,${(fast - 0.75) * 1.6})`; c.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const side = i % 2 ? 1 : -1, y = MINI_H * 0.62 + ((g.time * 900 + i * 53) % (MINI_H * 0.38));
          const x = MINI_W / 2 + side * (MINI_W * 0.36 + (i * 17) % 30);
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + side * 10, y + 22); c.stroke();
        }
      }
      if (me.boost > 0) {
        c.fillStyle = '#9be35a';
        for (let i = 0; i < 4; i++) c.fillRect(kx + 24 + i * 16, ky + 63 + Math.random() * 6, 6, 6 + Math.random() * 8);
      }
      this.hud(g, c);
    },
    // A real 3D race in the 3D look; the item slot and messages are drawn on top as usual.
    draw3d(g, c) {
      const rival = g.duel && (SKINS.find((s) => s.dir === g.duel.rivalSkin) || SKINS[0]).id;
      Games3D.frame('race', g, c, MINI_W, MINI_H, { track: WU_TRACK, WU, look: skinNow().id, rivalLook: rival });
      this.hud(g, c);
    },
    hud(g, c) {
      const me = g.me;
      // Item slot, messages and the countdown.
      c.fillStyle = '#231d33cc'; c.fillRect(MINI_W - 58, 8, 50, 50);
      c.strokeStyle = '#ffc857'; c.lineWidth = 2; c.strokeRect(MINI_W - 58, 8, 50, 50);
      if (me.item) c.drawImage(WU_ART[me.item === 'soy' ? 'soybottle' : me.item], MINI_W - 51, 15, 36, 36);
      c.textAlign = 'center';
      if (g.msg) {
        c.globalAlpha = Math.min(1, g.msg.time * 2);
        c.font = 'bold 20px "Courier New", monospace';
        if (c.measureText(g.msg.text).width > MINI_W - 24) c.font = 'bold 15px "Courier New", monospace';
        c.lineWidth = 4; c.strokeStyle = '#231d33';
        c.strokeText(g.msg.text, MINI_W / 2, 120); c.fillStyle = '#ffc857'; c.fillText(g.msg.text, MINI_W / 2, 120);
        c.globalAlpha = 1;
      }
      c.textAlign = 'left';
    },
  };

  const TRAINING_GAMES = [
    { key: 'rhythm', about: 'rhythmAbout', tiredOk: true, cost: TRAIN_COST, art: 'sprites/icons/bowl.png', start: () => startMini('rhythm', RICE_RHYTHM) },
    { key: 'riceWrap', about: 'riceWrapAbout', art: 'sprites/icons/rice.png', start: () => startTrain() },
    { key: 'whack', about: 'whackAbout', art: 'sprites/boss_broccoli.png', start: () => startWhack() },
    { key: 'order', about: 'orderAbout', art: 'sprites/icons/salmon.png', start: () => startOrder() },
  ];
  const MINI_GAMES = [
    { key: 'pong', about: 'pongAbout', tiredOk: true, art: 'sprites/pizza.png', start: () => startMini('pong', PIZZA_PONG) },
    { key: 'parkour', about: 'parkourAbout', tiredOk: true, art: 'sprites/icons/walker.png', start: () => startMini('parkour', GARDEN_PARKOUR) },
    { key: 'catch', about: 'catchAbout', tiredOk: true, art: 'sprites/icons/bowl.png', start: () => startMini('catch', RICE_CATCH) },
    { key: 'wipeuff', about: 'wipeuffAbout', tiredOk: true, art: 'sprites/wipeuff/kart.png', start: () => startMini('wipeuff', WIPE_UFF) },
  ];

  // ----- friendly duels -----
  // Two friends play live: the challenge goes through the server, then the two devices talk directly
  // (a WebRTC data channel). The challenger hosts: Pizza Pong runs on their device and the friend's copy follows it.
  const DUEL_GAMES = {
    pong: { key: 'pong', art: 'sprites/pizza.png', about: 'duelPongAbout', game: () => PIZZA_PONG },
    rhythm: { key: 'rhythm', art: 'sprites/icons/bowl.png', about: 'duelRhythmAbout', game: () => RICE_RHYTHM },
    race: { key: 'wipeuff', art: 'sprites/wipeuff/kart.png', about: 'duelRaceAbout', game: () => WIPE_UFF },
  };
  const DUEL_WAIT_MS = 60000;
  const DUEL_PRIZE = { win: [15, 30, 100], draw: [10, 20, 50], lose: [5, 10, 25] };
  let duel = null;
  // A small seeded random generator, so both devices drop the same rice in Rice Rhythm.
  const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  function newPeer() {
    return new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] });
  }
  // Waits until the connection knows all the ways it can be reached, so one message carries everything.
  function gathered(pc) {
    return new Promise((done) => {
      if (pc.iceGatheringState === 'complete') return done();
      const timer = setTimeout(done, 4000);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timer); done(); } });
    });
  }
  function closeDuel() {
    if (!duel) return;
    clearInterval(duel.poll); clearTimeout(duel.expire);
    try { duel.chan?.close(); duel.pc?.close(); } catch { /* already closed */ }
    if (duel.id && duel.host && !duel.started) Cloud.deleteDuel(duel.id).catch(() => {});
    duel = null;
    $('duelWait').classList.remove('on');
  }
  function duelSend(msg) {
    if (duel?.chan?.readyState === 'open') duel.chan.send(JSON.stringify(msg));
  }
  function wireChannel(chan) {
    duel.chan = chan;
    chan.onopen = () => {
      if (!duel.host) return;
      duel.seed = Math.floor(Math.random() * 2 ** 31);
      duelSend({ t: 'start', seed: duel.seed, skin: skinNow().dir, name: Cloud.user()?.name });
      Cloud.deleteDuel(duel.id).catch(() => {});
      startDuelGame();
    };
    chan.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'start') { duel.seed = msg.seed; duel.rivalSkin = msg.skin; return startDuelGame(); }
      if (msg.t === 'hello') {
        duel.rivalSkin = msg.skin;
        if (mini?.duel) mini.duel.rivalSkin = msg.skin;
        if (mini?.rival) mini.rival.driver = art(skinBack(msg.skin));
        return;
      }
      if (msg.t === 'quit') return finishDuel('win', t('duelQuit', { name: duel.friendName }));
      if (mini?.duel && mini.net) mini.net(mini, msg);
    };
    chan.onclose = () => { if (duel?.started && mini?.duel) finishDuel('gone', t('duelGone')); };
  }
  function startDuelGame() {
    const d = duel;
    d.started = true;
    clearInterval(d.poll); clearTimeout(d.expire);
    $('duelWait').classList.remove('on'); $('duelAsk').classList.remove('on');
    if (!d.host) duelSend({ t: 'hello', skin: skinNow().dir });
    const info = DUEL_GAMES[d.game];
    startMini(info.key, info.game(), {
      duel: { host: d.host, friendName: d.friendName, send: duelSend, rand: seeded(d.seed || 1), rivalSkin: d.rivalSkin },
    });
  }
  // Ends a duel for this player: 'win', 'lose', 'draw', or 'gone' when the connection dropped.
  function finishDuel(result, message) {
    if (!mini?.duel) return;
    const duelGame = duel?.game;
    stopMini();
    closeDuel();
    const parts = [];
    if (result !== 'gone') {
      const [joy, xp, poken] = DUEL_PRIZE[result];
      S.joy = clamp(S.joy + joy);
      S.poken = (S.poken || 0) + poken;
      if (result === 'win') S.duelWins = (S.duelWins || 0) + 1;
      if (result === 'win' && duelGame === 'race') S.raceWins = (S.raceWins || 0) + 1;
      if (result === 'lose') S.duelLosses = (S.duelLosses || 0) + 1;
      parts.push(t('plusJoy', { n: joy }), t('plusXp', { n: addXp(xp) }), `+${poken} Poken`);
    }
    save(); sync(); show('home');
    play($('pet'), result === 'lose' || result === 'gone' ? 'sad' : 'happy', restingAnim());
    toast(`${message} ${parts.join(' · ')}`);
  }
  function openChallenge(friendId, friendName) {
    const list = $('duelGames');
    list.replaceChildren();
    for (const [game, info] of Object.entries(DUEL_GAMES)) {
      const row = document.createElement('div');
      row.className = 'bossRow';
      const img = document.createElement('img');
      img.src = info.art; img.alt = '';
      const text = document.createElement('div');
      const b = document.createElement('b'); b.textContent = t(info.key);
      const span = document.createElement('span'); span.className = 'dim'; span.textContent = t(info.about);
      text.append(b, span);
      const go = document.createElement('button');
      go.className = 'main'; go.textContent = t('duelGo');
      go.onclick = () => challenge(friendId, friendName, game);
      row.append(img, text, go);
      list.append(row);
    }
    $('duelPickText').textContent = t('duelPickText', { name: friendName });
    $('duelPick').classList.add('on');
  }
  async function challenge(friendId, friendName, game) {
    $('duelPick').classList.remove('on');
    if (duel) closeDuel();
    if (!window.RTCPeerConnection) return toast(t('duelUnsupported'));
    duel = { host: true, friendId, friendName, game };
    const d = duel;
    $('duelWaitText').textContent = t('duelWaiting', { name: friendName, game: t(DUEL_GAMES[game].key) });
    $('duelWait').classList.add('on');
    try {
      d.pc = newPeer();
      wireChannel(d.pc.createDataChannel('duel'));
      await d.pc.setLocalDescription(await d.pc.createOffer());
      await gathered(d.pc);
      if (duel !== d) return;
      d.id = await Cloud.createDuel(friendId, game, JSON.stringify(d.pc.localDescription));
      if (duel !== d) { Cloud.deleteDuel(d.id).catch(() => {}); return; }
      d.expire = setTimeout(() => { if (duel === d && !d.started) { closeDuel(); toast(t('duelNoAnswer', { name: friendName })); } }, DUEL_WAIT_MS);
      d.poll = setInterval(async () => {
        if (duel !== d || d.answered) return;
        const doc = await Cloud.getDuel(d.id).catch(() => undefined);
        if (doc === null && duel === d && !d.started) { closeDuel(); toast(t('duelDeclined', { name: friendName })); return; }
        if (doc?.answer && !d.answered) {
          d.answered = true;
          await d.pc.setRemoteDescription(JSON.parse(doc.answer)).catch(() => { closeDuel(); toast(t('duelFailed')); });
        }
      }, 1500);
    } catch {
      closeDuel();
      toast(t('duelFailed'));
    }
  }
  // Challenges sent to this player pop up on the home screen and menus, never in the middle of a game.
  let askingDuel = null;
  async function checkDuels(force) {
    if (!Cloud.user() || duel || mini || askingDuel || (document.hidden && !force) || $('death').classList.contains('on')) return;
    try {
      const fresh = (await Cloud.incomingDuels()).filter((x) => Cloud.now() - x.at < DUEL_WAIT_MS && DUEL_GAMES[x.game]);
      if (!fresh.length || duel || mini || askingDuel) return;
      askingDuel = fresh.sort((a, b) => b.at - a.at)[0];
      $('duelAskText').textContent = t('duelAskText', { name: askingDuel.fromName || askingDuel.from, game: t(DUEL_GAMES[askingDuel.game].key) });
      $('duelAsk').classList.add('on');
    } catch { /* tried again soon */ }
  }
  async function answerDuel(accept) {
    const ask = askingDuel;
    $('duelAsk').classList.remove('on');
    if (!ask) return;
    if (!accept) { await Cloud.deleteDuel(ask.id).catch(() => {}); askingDuel = null; return; }
    if (!window.RTCPeerConnection) { askingDuel = null; return toast(t('duelUnsupported')); }
    duel = { host: false, id: ask.id, friendId: ask.from, friendName: ask.fromName || ask.from, game: ask.game };
    const d = duel;
    $('duelWaitText').textContent = t('duelConnecting', { name: d.friendName });
    $('duelWait').classList.add('on');
    try {
      d.pc = newPeer();
      d.pc.ondatachannel = (e) => wireChannel(e.channel);
      await d.pc.setRemoteDescription(JSON.parse(ask.offer));
      await d.pc.setLocalDescription(await d.pc.createAnswer());
      await gathered(d.pc);
      await Cloud.answerDuel(ask.id, JSON.stringify(d.pc.localDescription));
      d.expire = setTimeout(() => { if (duel === d && !d.started) { closeDuel(); toast(t('duelFailed')); } }, 20000);
    } catch {
      closeDuel();
      toast(t('duelFailed'));
    }
    askingDuel = null;
  }
  $('btnDuelAccept').onclick = () => answerDuel(true);
  $('btnDuelDecline').onclick = () => answerDuel(false);
  $('btnDuelCancel').onclick = () => { closeDuel(); };
  $('btnDuelPickClose').onclick = () => $('duelPick').classList.remove('on');



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
      status.textContent = beaten ? t('beaten') : t('levelN', { n: (n + 1) * BOSS_EVERY });
      text.append(title, status);
      const go = document.createElement('button');
      if (beaten) {
        go.textContent = t('rematch');
        go.disabled = S.energy <= REMATCH_ENERGY;
      } else {
        go.textContent = t(unlocked ? 'fightBtn' : 'locked');
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
      tapDamage: cheat('oneShot') ? hp : Math.max(1, Math.round((2 + S.str * 0.5) * wellness())),
      hits: Math.min(2 + n, 5), hitDamage: 4 + n * 2, bowlNeed: 6 + Math.min(n, 4) * 2,
      hitsLeft: 0, bites: 0,
    };
    $('bossName').textContent = b.name;
    $('bossArt').src = `sprites/boss_${b.art}.png`;
    $('bowl').classList.remove('on');
    setFightButton();
    $('bossInfo').textContent = t('spam');
    show('boss'); play($('fightPet'), 'battle');
    if (window.Games3D && use3d()) {
      Games3D.boss.start($('bossArt').parentElement, b.art, () => ({ bowl: $('bowl').classList.contains('on'), stage: parseFloat($('bowl').style.backgroundPositionX) || 0 }));
    }
    renderFight(); queueBossAttack();
  }
  function renderFight() {
    $('b-boss').style.width = `${(fight.hp / fight.hpMax) * 100}%`;
    $('b-you').style.width = `${(fight.you / fight.youMax) * 100}%`;
  }
  function setFightButton() {
    const eating = fight.phase === 'bowl';
    $('btnBossTap').textContent = t(eating ? 'eatBtn' : 'attackBtn');
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
    $('bossInfo').textContent = t('attacking', { name: fight.b.name });
    fight.timer = setTimeout(bossStrike, FIRST_HIT_MS);
  }
  function bossStrike() {
    fight.hitsLeft -= 1;
    if (!cheat('god')) fight.you = Math.max(0, fight.you - fight.hitDamage);
    $('bossArt').animate([{ translate: '0' }, { translate: '-46px' }, { translate: '0' }], { duration: 220 });
    window.Games3D?.boss.strike();
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
      $('bossInfo').textContent = fight.hitsLeft ? t('yumBlocked', { n: fight.hitsLeft }) : t('yumDone');
    } else {
      $('bowl').classList.remove('on');
      $('bossInfo').textContent = t('spam');
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
    window.Games3D?.boss.hit();
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
      const found = won ? rollDiamond(dropItems(2, BOSS_ENERGY_SHARE), DIAMOND_CHANCE_REMATCH) : null;
      save(); show('home'); play($('pet'), won ? 'happy' : 'sad', restingAnim());
      toast(won
        ? `${t('beatenAgain', { name: fight.b.name })} ${itemsText(found)} · ${t('plusStr', { n: 1 })} · ${t('plusXp', { n: xp })}`
        : `${t('rematchLost', { name: fight.b.name })} ${t('plusXp', { n: xp })}`);
    } else if (won) {
      S.bossWins += 1; S.str += 3; S.joy = clamp(S.joy + 25);
      const xp = addXp(60);
      const found = rollDiamond(dropItems(3, BOSS_ENERGY_SHARE), DIAMOND_CHANCE_NEW_BOSS);
      save(); show('home'); play($('pet'), 'happy', restingAnim());
      toast(`${t('defeated', { name: fight.b.name })} ${itemsText(found)} · ${t('plusStr', { n: 3 })} · ${t('plusXp', { n: xp })}`);
    } else {
      S.joy = clamp(S.joy - 10);
      const xp = addXp(8);
      save(); show('home'); play($('pet'), 'sad', restingAnim());
      toast(`${t('lost')} ${t('plusXp', { n: xp })}`);
    }
  }

  // ----- friends -----
  const FRIEND_HEART_JOY = 5;
  const IGNORED_KEY = 'sbuffogotchi.ignoredFriends';
  // What friends can see about her. Bars are projected forward from `seen` when shown.
  const publicStats = () => ({
    name: Cloud.user().name, level: S.level, streak: S.streak, bossWins: S.bossWins,
    food: Math.round(S.food), energy: Math.round(S.energy), joy: Math.round(S.joy), seen: Cloud.now(),
    str: S.str, petName: petName(), rhythmBest: S.rhythmBest || 0, deaths: S.life || 0,
    items: Object.values(S.items).reduce((sum, n) => sum + (n || 0), 0), createdAt: S.createdAt,
    noGifts: giftMode() === 'off', duelWins: S.duelWins || 0,
  });
  let friends = null; // { list, hearts, fans } once loaded
  const ignored = () => { try { return JSON.parse(localStorage.getItem(IGNORED_KEY)) || []; } catch { return []; } };
  const cleanName = (name) => name.trim().toLowerCase();
  async function loadFriends() {
    claimGifts();
    friends = null;
    $('friendList').replaceChildren();
    const signedIn = !!Cloud.user();
    if (!signedIn) { $('friendsMsg').textContent = t('friendsSignIn'); return; }
    $('friendsMsg').textContent = t('connecting');
    try {
      const [mine, fans] = await Promise.all([Cloud.getProfile(Cloud.me()), Cloud.addedMe()]);
      friends = { list: mine?.friends || [], hearts: mine?.hearts || {}, fans: new Map(fans.map((p) => [p.id, p])) };
      const count = friends.list.filter((n) => friends.fans.has(n)).length;
      if (count !== S.friendCount) { S.friendCount = count; save(); }
      $('friendsMsg').textContent = '';
      claimHearts();
      renderFriends();
    } catch { $('friendsMsg').textContent = t('friendsOffline'); }
  }
  // A heart a friend sent today gives her happiness once.
  function claimHearts() {
    const today = dayNumber(Cloud.now());
    S.heartsGot = S.heartsGot || {};
    const from = [];
    for (const p of friends.fans.values()) {
      if (!friends.list.includes(p.id) || p.hearts[Cloud.me()] !== today || S.heartsGot[p.id] === today) continue;
      S.heartsGot[p.id] = today;
      from.push(p.stats.name || p.id);
    }
    if (!from.length) return;
    S.joy = clamp(S.joy + FRIEND_HEART_JOY * from.length);
    save();
    toast(t('heartsGot', { names: from.join(', '), n: FRIEND_HEART_JOY * from.length }));
  }
  function seenText(ms) {
    const minutes = Math.round((Cloud.now() - ms) / 60000);
    if (!(minutes >= 5)) return t('seenNow');
    const fmt = new Intl.RelativeTimeFormat(I18n.current(), { numeric: 'auto' });
    const ago = minutes < 60 ? fmt.format(-minutes, 'minute')
      : minutes < 1440 ? fmt.format(-Math.round(minutes / 60), 'hour')
        : fmt.format(-Math.round(minutes / 1440), 'day');
    return t('seenAgo', { t: ago });
  }
  function friendRow(name, lines, buttons, opts = {}) {
    const row = document.createElement('div');
    row.className = 'friendRow';
    const img = document.createElement('img');
    img.src = 'sprites/icons/walker.png'; img.alt = '';
    const info = document.createElement('div');
    const b = document.createElement('b'); b.textContent = name;
    info.append(b);
    for (const [text, cls] of lines) {
      const line = document.createElement('small');
      line.textContent = text;
      if (cls) line.className = cls;
      info.append(line);
    }
    const acts = document.createElement('div');
    acts.className = 'acts';
    for (const [label, action, opts = {}] of buttons) {
      const btn = document.createElement('button');
      btn.textContent = label;
      if (opts.icon) { const ic = document.createElement('img'); ic.className = 'ic'; ic.src = opts.icon; ic.alt = opts.title || ''; btn.append(ic); }
      if (opts.cls) btn.className = opts.cls;
      if (opts.title) btn.title = opts.title;
      btn.disabled = !!opts.disabled;
      btn.onclick = action;
      acts.append(btn);
    }
    row.append(img, info, acts);
    if (opts.profile) {
      row.classList.add('tappable');
      row.onclick = (e) => { if (!e.target.closest('button')) openFriendProfile(opts.profile); };
    }
    return row;
  }
  function heading(key) {
    const head = document.createElement('div');
    head.className = 'bagHead'; head.textContent = t(key);
    return head;
  }
  const statLine = (st) => t('friendLine', { l: st.level ?? 1, s: st.streak ?? 0, b: st.bossWins ?? 0 });
  function renderFriends() {
    if (!friends) return;
    const list = $('friendList');
    list.replaceChildren();
    const today = dayNumber(Cloud.now());
    const mutual = friends.list.filter((n) => friends.fans.has(n));
    const requests = [...friends.fans.keys()].filter((n) => !friends.list.includes(n) && !ignored().includes(n));
    const sent = friends.list.filter((n) => !friends.fans.has(n));
    if (requests.length) {
      list.append(heading('requestsHeader'));
      for (const n of requests) {
        const st = friends.fans.get(n).stats;
        list.append(friendRow(st.name || n, [[statLine(st)]], [
          [t('accept'), () => addFriend(n)],
          ['✕', () => ignoreRequest(n)],
        ]));
      }
    }
    list.append(heading('friendsHeader'));
    const note = document.createElement('small');
    note.className = 'dim'; note.textContent = t(mutual.length ? 'friendsAbout' : 'friendsEmpty');
    list.append(note);
    for (const n of mutual) {
      const st = friends.fans.get(n).stats;
      const hours = Math.max(0, Cloud.now() - (st.seen || 0)) / 3600000;
      const now = (k) => Math.round(clamp((st[k] ?? 0) - DECAY_PER_HOUR[k] * hours));
      const bars = { f: now('food'), e: now('energy'), j: now('joy') };
      const low = Math.min(bars.f, bars.e);
      const sentToday = friends.hearts[n] === today;
      list.append(friendRow(st.name || n, [
        [statLine(st)],
        [t('friendBars', bars), low <= 15 ? 'danger' : ''],
        [low <= 0 ? t('friendDanger') : seenText(st.seen), low <= 0 ? 'danger' : ''],
      ], [
        [sentToday ? '♥ ✓' : '♥', () => sendHeart(n), { cls: 'heartBtn', disabled: sentToday, title: t('friendsAbout') }],
        ['', () => openGift(n), { icon: 'sprites/icons/gift.png', title: t('giftBtn') }],
        ['✕', () => removeFriend(n, st.name || n)],
      ], { profile: n }));
    }
    if (sent.length) {
      list.append(heading('sentHeader'));
      for (const n of sent) list.append(friendRow(n, [], [['✕', () => removeFriend(n, n)]]));
    }
  }
  async function saveFriends(list) {
    await Cloud.setFriends(list);
    friends.list = list;
  }
  async function addFriend(raw) {
    const name = cleanName(raw);
    if (name === ADMIN_CODE) return unlockAdmin();
    if (!friends) { if (!Cloud.user()) $('friendsMsg').textContent = t('friendsSignIn'); return; }
    if (!name) return;
    if (name === Cloud.me()) { $('friendsMsg').textContent = t('friendSelf'); return; }
    if (friends.list.includes(name)) { $('friendsMsg').textContent = t('friendAlready'); return; }
    $('friendsMsg').textContent = t('connecting');
    try {
      // Someone who already added her doesn't need looking up.
      const p = friends.fans.get(name) || await Cloud.getProfile(name);
      if (!p) { $('friendsMsg').textContent = t('friendNotFound', { name: raw.trim() }); return; }
      await saveFriends([...friends.list, name]);
      $('friendName').value = '';
      $('friendsMsg').textContent = '';
      const mutual = friends.fans.has(name);
      toast(t(mutual ? 'friendAdded' : 'requestSent', { name: p.stats.name || name }));
      if (mutual) claimHearts();
      renderFriends();
    } catch { $('friendsMsg').textContent = t('friendsOffline'); }
  }
  async function removeFriend(name, shown) {
    if (!confirm(t('removeFriendConfirm', { name: shown }))) return;
    try {
      await saveFriends(friends.list.filter((n) => n !== name));
      ignoreRequest(name);
    } catch { $('friendsMsg').textContent = t('friendsOffline'); }
  }
  function ignoreRequest(name) {
    try { localStorage.setItem(IGNORED_KEY, JSON.stringify([...new Set([...ignored(), name])])); } catch { /* shows again next time */ }
    renderFriends();
  }
  async function sendHeart(name) {
    const today = dayNumber(Cloud.now());
    // Only today's hearts matter, so older ones are dropped to keep the profile small.
    const hearts = Object.fromEntries(Object.entries(friends.hearts).filter(([, day]) => day === today));
    hearts[name] = today;
    try {
      await Cloud.setHearts(hearts);
      friends.hearts = hearts;
      toast(t('heartSent', { name: friends.fans.get(name)?.stats.name || name }));
      renderFriends();
    } catch { $('friendsMsg').textContent = t('friendsOffline'); }
  }

  // ----- secret admin panel -----
  // Unlocked by searching the code below in Friends. Toggles are kept on this device only.
  const ADMIN_CODE = '0100000101000100010011010100100101001110'; // "ADMIN" in binary.
  // Kept in the save, so the panel stays unlocked on every device until it's locked again.
  const ADMIN_KEY = 'sbuffogotchi.admin'; // b1.4.0 kept the unlock here, on one device only.
  const cheats = () => (S.cheats ||= {});
  const cheat = (name) => !!(S.cheats?.unlocked && S.cheats[name]);
  function adoptOldCheats() {
    try {
      const old = JSON.parse(localStorage.getItem(ADMIN_KEY));
      if (old?.unlocked && !S.cheats?.unlocked) S.cheats = old;
      localStorage.removeItem(ADMIN_KEY);
    } catch { /* nothing to bring over */ }
  }
  const saveCheats = () => save();
  function unlockAdmin() {
    cheats().unlocked = true;
    saveCheats();
    $('friendName').value = '';
    render();
    openTerminal();
    toast(t('adminUnlocked'));
  }
  function adminButton(label, onclick, cls) {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.onclick = onclick;
    return b;
  }
  // ----- profiles -----
  // Your own profile shows everything about her; a friend's shows what their public profile shares.
  let profileFrom = 'home';
  const totalItems = () => Object.values(S.items).reduce((sum, n) => sum + (n || 0), 0);
  const fmtDate = (ms) => (ms ? new Intl.DateTimeFormat(I18n.current(), { dateStyle: 'long' }).format(new Date(ms)) : '?');
  const shown = (v) => (v === undefined || v === null ? '?' : v);
  function statTile(icon, value, label) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const img = document.createElement('img');
    img.src = icon; img.alt = '';
    const b = document.createElement('b');
    b.textContent = value;
    const span = document.createElement('span');
    span.textContent = label;
    tile.append(img, b, span);
    return tile;
  }
  function profileBars(f, e, j) {
    const box = $('profBars');
    box.replaceChildren();
    for (const [icon, value, color] of [['apple', f, 'var(--gold)'], ['bolt', e, 'var(--blue)'], ['smile', j, 'var(--green)']]) {
      const ic = document.createElement('img');
      ic.className = 'ic'; ic.src = `sprites/icons/${icon}.png`; ic.alt = '';
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('i');
      fill.style.width = `${clamp(value)}%`; fill.style.background = color;
      bar.append(fill);
      box.append(ic, bar);
    }
  }
  function fillProfile(p) {
    $('profName').textContent = p.name;
    $('profSince').textContent = p.since;
    $('profSeen').textContent = p.seen || '';
    profileBars(p.food, p.energy, p.joy);
    const grid = $('profGrid');
    grid.replaceChildren(...p.tiles.map(([icon, value, label]) => statTile(`sprites/${icon}.png`, value, label)));
    $('profActs').replaceChildren(...p.actions);
    $('profActs').className = p.actions.length > 1 ? 'row2' : 'row1';
  }
  async function openMyProfile() {
    tick();
    profileFrom = 'home';
    const u = Cloud.user();
    const logout = document.createElement('button');
    logout.textContent = t(u ? 'logout' : 'signIn');
    logout.className = u ? 'boss' : 'main';
    logout.onclick = leaveAccount;
    const me = {
      name: u ? u.name : t('guestName'),
      since: `${petName()} · ${t(u ? 'profJoined' : 'profPlaying', { d: fmtDate(S.createdAt) })}`,
      food: S.food, energy: S.energy, joy: S.joy,
      tiles: [
        ['icons/star', t('levelN', { n: S.level }), t('xpOf', { a: S.xp, b: xpNeeded() })],
        ['icons/trophy', S.bossWins, t('profBosses')],
        ['icons/bowl', S.streak, t('profStreak')],
        ['icons/dumbbell', S.str, t('strength')],
        ['icons/rice', S.rhythmBest || 0, t('profRhythm')],
        ['icons/backpack', totalItems(), t('profItems')],
        ['icons/diamond', S.items.diamond || 0, t('itemDiamond')],
        ['icons/poken', (S.poken || 0).toLocaleString(I18n.current()), 'Poken'],
        ['icons/cd', (S.cds || []).length, t('profCds')],
        ['icons/trophy', `${S.duelWins || 0} - ${S.duelLosses || 0}`, t('profDuelsMine')],
        ['icons/heart', S.life || 0, t('profDeaths')],
        ['icons/friends', u ? '…' : '-', t('friends')],
      ],
      actions: [logout],
    };
    fillProfile(me);
    show('profile');
    if (!u) return;
    // The friend count needs the server, so it fills in when it arrives.
    try {
      const [mine, fans] = await Promise.all([Cloud.getProfile(Cloud.me()), Cloud.addedMe()]);
      const count = (mine?.friends || []).filter((n) => fans.some((p) => p.id === n)).length;
      const tile = [...$('profGrid').children].at(-1);
      if (tile && $('s-profile').classList.contains('on')) tile.querySelector('b').textContent = count;
    } catch { /* stays as … */ }
  }
  function openFriendProfile(id) {
    const st = friends?.fans.get(id)?.stats;
    if (!st) return;
    profileFrom = 'friends';
    const hours = Math.max(0, Cloud.now() - (st.seen || 0)) / 3600000;
    const now = (k) => Math.round(clamp((st[k] ?? 0) - DECAY_PER_HOUR[k] * hours));
    const heart = document.createElement('button');
    const sentToday = friends.hearts[id] === dayNumber(Cloud.now());
    heart.textContent = sentToday ? '♥ ✓' : `♥ ${t('sendHeart')}`;
    heart.className = 'main';
    heart.disabled = sentToday;
    heart.onclick = async () => { await sendHeart(id); openFriendProfile(id); };
    const gift = document.createElement('button');
    gift.className = 'main';
    const giftIc = document.createElement('img');
    giftIc.className = 'ic'; giftIc.src = 'sprites/icons/gift.png'; giftIc.alt = '';
    gift.append(giftIc, t('giftBtn'));
    gift.onclick = () => openGift(id);
    const battle = document.createElement('button');
    battle.className = 'boss';
    battle.textContent = `⚔ ${t('challenge')}`;
    battle.onclick = () => openChallenge(id, st.name || id);
    fillProfile({
      name: st.name || id,
      since: [st.petName, st.createdAt ? t('profJoined', { d: fmtDate(st.createdAt) }) : ''].filter(Boolean).join(' · '),
      seen: seenText(st.seen),
      food: now('food'), energy: now('energy'), joy: now('joy'),
      tiles: [
        ['icons/star', shown(st.level), t('level')],
        ['icons/trophy', shown(st.bossWins), t('profBosses')],
        ['icons/bowl', shown(st.streak), t('profStreak')],
        ['icons/dumbbell', shown(st.str), t('strength')],
        ['icons/rice', shown(st.rhythmBest), t('profRhythm')],
        ['icons/backpack', shown(st.items), t('profItems')],
        ['icons/heart', shown(st.deaths), t('profDeaths')],
        ['icons/trophy', shown(st.duelWins), t('profDuels')],
      ],
      actions: [heart, gift, battle],
    });
    show('profile');
  }
  async function leaveAccount() {
    if (Cloud.user()) {
      if (!confirm(t('logoutConfirm'))) return;
      await sync();
      Cloud.logout();
      localStorage.removeItem(SAVE_KEY);
    }
    localStorage.removeItem('sbuffogotchi.guest');
    show('login');
  }

  // ----- gifts -----
  // Send friends any items, as many as you like. A gift waits on the server until they open the game;
  // claiming deletes it first, so the same gift can never be collected twice.
  let giftTo = null;
  let giftPick = {};
  function openGift(id) {
    const st = friends?.fans.get(id)?.stats;
    if (st?.noGifts) { toast(t('giftRefused', { name: st.name || id })); return; }
    giftTo = { id, name: st?.name || id };
    giftPick = {};
    $('giftWinTitle').textContent = t('giftTitle', { name: giftTo.name });
    renderGift();
    $('giftWin').classList.add('on');
  }
  function closeGift() { $('giftWin').classList.remove('on'); }
  function renderGift() {
    const list = $('giftList');
    list.replaceChildren();
    const owned = Object.keys(ITEMS).filter((id) => S.items[id] > 0);
    if (!owned.length) {
      const empty = document.createElement('p');
      empty.className = 'center dim'; empty.textContent = t('giftNothing');
      list.append(empty);
    }
    for (const id of owned) {
      const have = S.items[id];
      const pick = giftPick[id] || 0;
      const row = document.createElement('div');
      row.className = 'giftRow';
      const img = document.createElement('img');
      img.src = ITEMS[id].icon; img.alt = '';
      const name = document.createElement('span');
      name.textContent = `${t(ITEMS[id].key)} (${have})`;
      const set = (n) => () => { giftPick[id] = Math.max(0, Math.min(have, n)); renderGift(); };
      const minus = adminButton('−', set(pick - 1));
      const count = document.createElement('b');
      count.textContent = pick;
      const plus = adminButton('+', set(pick + 1));
      const all = adminButton(t('giftAll'), set(have));
      minus.disabled = !pick; plus.disabled = pick >= have;
      row.append(img, name, minus, count, plus, all);
      list.append(row);
    }
    const total = Object.values(giftPick).reduce((a, b) => a + b, 0);
    $('btnGiftSend').disabled = !total;
    $('btnGiftSend').textContent = total ? t('giftSend', { n: total }) : t('giftPick');
  }
  async function sendGift() {
    const items = Object.fromEntries(Object.entries(giftPick).filter(([id, n]) => n > 0 && n <= (S.items[id] || 0)));
    if (!Object.keys(items).length || !giftTo) return;
    $('btnGiftSend').disabled = true;
    try {
      await Cloud.sendGift(giftTo.id, items);
    } catch {
      toast(t('friendsOffline'));
      renderGift();
      return;
    }
    for (const [id, n] of Object.entries(items)) S.items[id] -= n;
    S.giftsSent = (S.giftsSent || 0) + 1;
    save(); render();
    closeGift();
    toast(t('giftSent', { name: giftTo.name, items: itemsText(items) }));
  }
  // How gifts arrive: 'ask' shows each one on the home screen, 'auto' takes them all, 'off' turns them away.
  const giftMode = () => S.giftMode || 'ask';
  let claiming = false;
  let giftQueue = [];
  async function claimGifts() {
    if (!Cloud.user() || claiming) return;
    claiming = true;
    try {
      const incoming = await Cloud.incomingGifts();
      if (giftMode() === 'ask') {
        const known = new Set(giftQueue.map((gift) => gift.id));
        giftQueue.push(...incoming.filter((gift) => !known.has(gift.id)));
        showNextGift();
      } else {
        const got = [];
        for (const gift of incoming) {
          // Only the copy that is actually deleted here counts, so two devices can't both collect it.
          if (!(await Cloud.claimGift(gift.id))) continue;
          if (giftMode() === 'auto') got.push(takeGift(gift));
        }
        if (got.length) { save(); render(); toast(got.join(' · ')); }
      }
    } catch { /* tried again later */ }
    claiming = false;
  }
  function giftItems(gift) {
    return Object.fromEntries(Object.entries(gift.items).filter(([id, n]) => ITEMS[id] && n > 0));
  }
  function takeGift(gift) {
    const items = giftItems(gift);
    addItems(items);
    return t('giftGot', { name: gift.fromName || gift.from, items: itemsText(items) });
  }
  // One gift at a time, only on the home screen and never over another window or the tutorial.
  function showNextGift() {
    if (!giftQueue.length || $('giftAsk').classList.contains('on')) return;
    if (!$('s-home').classList.contains('on') || tutorialOn() || document.querySelector('.modal.on')) return;
    const gift = giftQueue[0];
    $('giftAskText').textContent = t('giftAskText', { name: gift.fromName || gift.from });
    const list = $('giftAskItems');
    list.replaceChildren();
    for (const [id, n] of Object.entries(giftItems(gift))) {
      const span = document.createElement('span');
      const img = document.createElement('img');
      img.src = ITEMS[id].icon; img.alt = '';
      span.append(img, `${n} ${t(ITEMS[id].key)}`);
      list.append(span);
    }
    $('giftAsk').classList.add('on');
  }
  async function answerGift(accept) {
    const gift = giftQueue.shift();
    $('giftAsk').classList.remove('on');
    if (!gift) return;
    if (await Cloud.claimGift(gift.id).catch(() => false)) {
      if (accept) { toast(takeGift(gift)); save(); render(); play($('pet'), 'happy', restingAnim()); }
      else toast(t('giftDeclined', { name: gift.fromName || gift.from }));
    }
    setTimeout(showNextGift, 400);
  }
  $('btnGiftAccept').onclick = () => answerGift(true);
  $('btnGiftDecline').onclick = () => answerGift(false);

  // ----- tutorial -----
  // Shown once when a brand-new Sbuffling hatches, and again from Settings.
  const TUTORIAL = [
    { text: 'tut1' },
    { target: '#s-home .stage', text: 'tut2' },
    { target: '#s-home .bars', text: 'tut3' },
    { target: '#btnFeed', row: true, text: 'tut4' },
    { target: '#btnTrain', text: 'tut5' },
    { target: '#btnBoss', text: 'tut6' },
    { target: '#s-home .top .streak', text: 'tut7' },
    { target: '#btnFriends', text: 'tut8' },
    { target: '#btnAccount', text: 'tut9' },
    { text: 'tut10' },
  ];
  let tutStep = -1;
  const tutorialOn = () => tutStep >= 0;
  function startTutorial() {
    $('daily').classList.remove('on');
    removeGolden();
    show('home');
    tutStep = 0;
    $('tut').classList.add('on');
    drawTutorial();
  }
  function endTutorial() {
    tutStep = -1;
    $('tut').classList.remove('on');
    setTimeout(showNextGift, 300);
    S.tutorialDone = true;
    save();
    Notify.askOnce();
  }
  function drawTutorial() {
    if (!tutorialOn()) return;
    const step = TUTORIAL[tutStep];
    $('tutText').textContent = t(step.text);
    $('tutCount').textContent = `${tutStep + 1}/${TUTORIAL.length}`;
    $('btnTutNext').textContent = t(tutStep === TUTORIAL.length - 1 ? 'tutGo' : 'tutNext');
    $('btnTutSkip').style.visibility = tutStep === TUTORIAL.length - 1 ? 'hidden' : '';
    $('tutPic').hidden = !!step.target;
    let el = step.target && document.querySelector(step.target);
    if (el && step.row) el = el.parentElement;
    const hole = $('tutHole'), box = $('tutBox');
    box.style.top = ''; box.style.bottom = '';
    if (!el) {
      hole.style.cssText = `left:50%;top:50%;width:0;height:0;`;
      box.style.top = '50%'; box.style.transform = 'translate(-50%,-50%)';
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    hole.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;`;
    box.style.transform = 'translateX(-50%)';
    // The text goes on whichever side of the highlight has more room.
    if (r.top + r.height / 2 < innerHeight / 2) box.style.top = `${Math.min(innerHeight - box.offsetHeight - 8, r.bottom + pad + 10)}px`;
    else box.style.bottom = `${Math.min(innerHeight - box.offsetHeight - 8, innerHeight - r.top + pad + 10)}px`;
  }
  $('btnTutNext').onclick = () => {
    if (!tutorialOn()) return;
    if (tutStep >= TUTORIAL.length - 1) return endTutorial();
    tutStep += 1;
    drawTutorial();
  };
  $('btnTutSkip').onclick = endTutorial;
  window.addEventListener('resize', drawTutorial);

  // ----- phone reminders -----
  // The whole schedule is rebuilt every few minutes while the game is open (and when it closes),
  // so it is always ready even if the phone suspends the app before it can react to being closed.
  const QUIET_FROM = 22; // No gentle reminders from 22:00...
  const QUIET_TO = 9; // ...until 9:00. Urgent ones still come, since she could die overnight.
  const MIN_GAP_MS = 60 * 60000; // Gentle reminders are at least an hour apart.
  const FIRST_AFTER_MS = 30 * 60000; // Nothing in the first half hour after leaving.
  function outsideQuietHours(ms) {
    const d = new Date(ms);
    if (d.getHours() >= QUIET_FROM) { d.setDate(d.getDate() + 1); d.setHours(QUIET_TO, 0, 0, 0); }
    else if (d.getHours() < QUIET_TO) d.setHours(QUIET_TO, 0, 0, 0);
    return d.getTime();
  }
  // Each bar warns at several levels, so a pet left alone gets a few nudges before it is urgent.
  const NEED_STEPS = {
    food: [[50, 'notifPeckish'], [30, 'notifHungry'], [15, 'notifVeryHungry'], [8, 'notifStarving', true], [5, 'notifLastChance', true]],
    energy: [[45, 'notifSleepy'], [30, 'notifTired'], [15, 'notifVeryTired'], [8, 'notifExhausted', true], [3, 'notifLastChance', true]],
    joy: [[45, 'notifBored'], [25, 'notifLonely'], [10, 'notifSad']],
  };
  function reminders(now = Date.now()) {
    tick();
    if (isDead()) return [];
    const list = [];
    const after = (ms) => Math.max(now + FIRST_AFTER_MS, ms);
    const at = (k, level) => now + ((S[k] - level) / DECAY_PER_HOUR[k]) * 3600000;
    const deathAt = Math.min(at('food', 0), at('energy', 0));
    // Night-time reminders wait for the morning, unless the morning would be too close to her dying.
    // (Only food and energy can make her die, so only they may break the quiet hours.)
    const when = (ms, urgent, vital) => {
      if (urgent) return after(ms);
      const morning = outsideQuietHours(after(ms));
      return vital && morning > deathAt - 6 * 3600000 ? after(ms) : morning;
    };
    const add = (key, ms, urgent = false, vars = {}, important = false, vital = false) => list.push({
      key, urgent, important, title: t(`${key}Title`, vars), body: t(`${key}Body`, vars), at: when(ms, urgent, vital),
    });
    if (!cheat('god')) {
      for (const [k, steps] of Object.entries(NEED_STEPS)) {
        // With a CD playing her joy doesn't drop, but the CD stops when the app closes, so plan as usual.
        for (const [level, key, urgent] of steps) if (S[k] > level) add(key, at(k, level), !!urgent, {}, false, k !== 'joy');
      }
    }
    // Streak: tomorrow at 19:00, and a last call at 21:30.
    const day = (offset, h, m = 0) => { const d = new Date(Cloud.now()); d.setDate(d.getDate() + offset); d.setHours(h, m, 0, 0); return d.getTime(); };
    add('notifStreak', day(1, 19), false, { n: S.streak + 1 }, true);
    if (S.streak >= 3) add('notifStreakLast', day(1, 21, 30), true, { n: S.streak });
    // Daily reward in the morning, and a midday visit for every day of the next three she isn't seen.
    add('notifDaily', dailyReady() && new Date(Cloud.now()).getHours() < 10 ? day(0, 10) : day(1, 10));
    for (let d = 1; d <= 3; d++) add('notifMiss', day(d, 13, 30));
    // Nothing after the moment she would die.
    const alive = list.filter((n) => n.at < deathAt);
    // Urgent and streak reminders always come; gentle ones fill in at least an hour away from everything else,
    // and "she misses you" only on a day with nothing else to say.
    const kept = alive.filter((n) => n.urgent || n.important);
    const gentle = alive.filter((n) => !n.urgent && !n.important).sort((a, b) => a.at - b.at);
    const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
    for (const n of gentle) {
      if (kept.some((o) => Math.abs(o.at - n.at) < MIN_GAP_MS)) continue;
      if (n.key === 'notifMiss' && kept.some((o) => sameDay(o.at, n.at))) continue;
      kept.push(n);
    }
    kept.sort((a, b) => a.at - b.at);
    return kept.slice(0, 40).map((n, i) => ({ ...n, id: 101 + i }));
  }
  let planTimer = null;
  function planReminders() {
    clearTimeout(planTimer);
    planTimer = setTimeout(() => Notify.plan(reminders()), 400);
  }
  function leavingApp() { clearTimeout(planTimer); Notify.plan(reminders()); }
  function backInApp() { Notify.clear().then(() => planReminders()); }
  setInterval(() => { if (!document.hidden) planReminders(); }, 5 * 60000);

  // ----- accounts -----
  async function enterGame() {
    S = loadLocal();
    let offline = false;
    const uid = Cloud.user()?.uid;
    if (uid) {
      try {
        const remote = await Cloud.pull();
        // A save left on this device by a guest (or another account) never mixes into an existing account.
        // A brand-new account keeps the guest's progress.
        if (S.owner && S.owner !== uid) S = remote ? { ...fresh(), ...remote } : S;
        else S = merge(S, remote);
      } catch { offline = true; toast(t('offlineLater')); }
    }
    S.owner = uid || 'guest';
    // A Sbuffling that has never had a first day is brand new: time for the tutorial.
    if (S.lastDay == null && S.tutorialDone === undefined && !offline) S.tutorialDone = false;
    adoptOldCheats();
    if (!S.createdAt) S.createdAt = Date.now();
    if (Cloud.user()) {
      Cloud.accountCreated().then((made) => {
        if (made && made < S.createdAt) { S.createdAt = made; save(); }
      }).catch(() => { /* keeps the device's date */ });
    }
    // Saves from before dying existed get one top-up, so the update itself can't kill her.
    if (!S.mortal) {
      S.mortal = true;
      S.food = Math.max(S.food, REVIVE_BARS);
      S.energy = Math.max(S.energy, REVIVE_BARS);
      S.tickAt = Date.now();
    }
    tick();
    const msg = checkIn();
    save(); show('home');
    if (msg) { toast(msg); play($('pet'), 'happy', restingAnim()); }
    if (S.tutorialDone === false) startTutorial(); else Notify.askOnce();
    backInApp();
    claimGifts();
    homeTimers();
  }
  async function authAction(kind) {
    if (!$('user').value.trim() || !$('pass').value) {
      $('loginMsg').textContent = t('missingCreds');
      return;
    }
    $('loginMsg').textContent = t('connecting');
    try {
      await Cloud[kind]($('user').value, $('pass').value);
      $('loginMsg').textContent = '';
      $('pass').value = '';
      await enterGame();
      await sync();
    } catch (e) { $('loginMsg').textContent = e.message; }
  }

  // ----- terminal -----
  // A console like the ones in PC games, only for players in admin mode (unlocked with the code in Friends):
  // ` or F11 opens it, or Settings on phones. For everyone else those keys do nothing here.
  // Every change it makes is saved and sent to the server at once, as the player's real data.
  const GAME_VERSION = '1.9.0';
  const term = { open: false, history: [], at: 0, started: Date.now() };
  const isAdmin = () => !!S.cheats?.unlocked;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  function termPrint(text, cls = '') {
    const line = document.createElement('div');
    line.className = `tl ${cls}`;
    if (text instanceof Node) line.append(text); else line.textContent = text;
    $('termOut').append(line);
    $('termOut').scrollTop = $('termOut').scrollHeight;
  }
  const termHtml = (html, cls = '') => { const d = document.createElement('div'); d.innerHTML = html; termPrint(d, cls); };
  function openTerminal() {
    if (!isAdmin()) return;
    term.open = true;
    $('termWin').classList.add('on');
    if (!$('termOut').childElementCount) { fetchLogo(); termPrint(t('tm_welcome'), 'dim'); }
    setTimeout(() => $('termIn').focus(), 30);
  }
  function closeTerminal() {
    term.open = false;
    $('termWin').classList.remove('on');
    $('termIn').blur();
  }
  const toggleTerminal = () => (term.open ? closeTerminal() : openTerminal());

  // --- values: anything you type after = is read as JSON when it can be, otherwise as text ---
  function parseValue(raw) {
    const v = raw.trim();
    if (v === '') return '';
    try { return JSON.parse(v); } catch { /* not JSON */ }
    if (/^(on|yes)$/i.test(v)) return true;
    if (/^(off|no)$/i.test(v)) return false;
    return v.replace(/^['"]|['"]$/g, '');
  }
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const findCd = (name) => CDS.find((c) => c.id === slug(name) || slug(c.title) === slug(name));
  const findSkin = (name) => SKINS.find((s) => s.id === slug(name) || slug(t(s.key)) === slug(name));
  const findAch = (name) => ACHIEVEMENTS.find((a) => a.id.toLowerCase() === slug(name).replace(/_/g, '') || a.id === name);
  function getPath(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), S);
  }
  function setPath(path, value) {
    const keys = path.split('.');
    let o = S;
    for (const k of keys.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
    o[keys.at(-1)] = value;
  }
  // After any change: marked as a terminal edit (so it wins over older copies), saved and sent to the server now.
  function changed() { S.editedAt = Date.now(); tick(); S.tickAt = Date.now(); save(); sync(); render(); if ($('s-shop').classList.contains('on')) renderShop(); }
  // The terminal speaks in verbs:
  //   set.items.poken = 500   set.items.pizza = +3   set.stats.joy = 100   set.sbuffling.name = "Nonna"
  //   set.cheats.god = true                      (change a value)
  //   get.cds = sbuff_n_base   get.skins = boxer   get.achievements = level25   (get something)
  //   remove.cds = sbuff_n_base   ...            (take it away)
  //   show items.poken   show.stats.streak       (just look)
  // The value must have the right type: a number where a number goes, true/false where that goes.
  const STATS = ['food', 'energy', 'joy', 'level', 'xp', 'str', 'streak', 'bossWins'];
  function typedValue(raw, kind, path) {
    const v = raw.trim();
    if (kind === 'number') {
      if (!/^[+-]?\d+(\.\d+)?(e\d+)?$/i.test(v)) { termPrint(t('tm_isNumber', { path, v }), 'err'); return undefined; }
      return Number(v);
    }
    if (kind === 'boolean') {
      if (v !== 'true' && v !== 'false') { termPrint(t('tm_isBool', { path, v }), 'err'); return undefined; }
      return v === 'true';
    }
    if (kind === 'string') {
      const m = v.match(/^"(.*)"$|^'(.*)'$/);
      if (!m) { termPrint(t('tm_isText', { path, v }), 'err'); return undefined; }
      return m[1] ?? m[2];
    }
    return undefined;
  }
  // Works out what a path like items.poken points at: how to read it, how to write it, and its type.
  const OWNABLE = ['cds', 'skins', 'achievements'];
  function resolve(path) {
    const parts = path.split('.');
    if (parts.length < 2) return null;
    const [group, ...rest] = parts;
    const key = rest.join('.');
    if (group === 'items') {
      if (key === 'poken') return { kind: 'number', read: () => S.poken || 0, write: (v) => { S.poken = v; } };
      if (!(key in S.items)) return null;
      return { kind: 'number', read: () => S.items[key] || 0, write: (v) => { S.items[key] = v; } };
    }
    if (group === 'stats') {
      if (!STATS.includes(key)) return null;
      return { kind: 'number', read: () => S[key], write: (v) => { S[key] = v; } };
    }
    if (group === 'sbuffling' && key === 'name') return { kind: 'string', read: () => petName(), write: (v) => { S.petName = v; } };
    if (group === 'cds') {
      const cd = findCd(key); if (!cd) return null;
      return { kind: 'boolean', read: () => (S.cds || []).includes(cd.id),
        write: (v) => { S.cds = (S.cds || []).filter((id) => id !== cd.id); if (v) S.cds.push(cd.id); } };
    }
    if (group === 'skins') {
      const skin = findSkin(key); if (!skin) return null;
      return { kind: 'boolean', read: () => skin.id === 'default' || (S.skins || []).includes(skin.id),
        write: (v) => { S.skins = (S.skins || []).filter((id) => id !== skin.id); if (v && skin.id !== 'default') S.skins.push(skin.id); } };
    }
    if (group === 'achievements') {
      const ac = findAch(key); if (!ac) return null;
      // true unlocks it (ready to claim in Achievements, like doing it for real); false takes it back.
      return { kind: 'boolean', read: () => achDone(ac),
        write: (v) => {
          S.achForced = { ...(S.achForced || {}) };
          if (v) S.achForced[ac.id] = true;
          else {
            delete S.achForced[ac.id];
            S.achieved = { ...(S.achieved || {}) }; delete S.achieved[ac.id];
            if (S.achSeen) delete S.achSeen[ac.id];
          }
        } };
    }
    if (group === 'cheats') {
      if (!['god', 'oneShot', 'invincible'].includes(key)) return null;
      return { kind: 'boolean', read: () => !!cheats()[key], write: (v) => { cheats()[key] = v; } };
    }
    return null;
  }
  function assign(left, op, raw) {
    const path = left.trim();
    if ((/^color[_.-](\w+)$/i).test(path)) return runCommand(`color ${path.split(/[_.-]/)[1]} ${raw}`);
    const [verb, ...restParts] = path.split('.');
    const target = restParts.join('.');
    // get.cds = <name> gives it, remove.cds = <name> takes it away.
    if (verb === 'get' || verb === 'remove') {
      if (!OWNABLE.includes(target)) return termPrint(t('tm_ownOnly', { path }), 'err');
      const name = raw.trim().replace(/^['"]|['"]$/g, '');
      const slot = resolve(`${target}.${name}`);
      if (!slot) return termPrint(t('tm_noPath', { path: `${target}.${name}` }), 'err');
      slot.write(verb === 'get');
      changed();
      if (target === 'achievements') checkAchievements();
      return termPrint(t(verb === 'get' ? 'tm_got' : 'tm_removed', { x: name, g: target }), 'ok');
    }
    if (verb !== 'set') return termPrint(t('tm_notGet', { path }), 'err');
    if (OWNABLE.includes(restParts[0])) return termPrint(t('tm_useGet', { g: restParts[0] }), 'err');
    const slot = resolve(target);
    if (!slot) return termPrint(t('tm_noPath', { path }), 'err');
    if (op !== '=' && slot.kind !== 'number') return termPrint(t('tm_onlyNumbers', { op }), 'err');
    const value = typedValue(raw, slot.kind, path);
    if (value === undefined) return;
    // "= +x" / "= -x" (or just "+x" / "-x" after the path) add or take away x; a plain number replaces the value.
    const relative = slot.kind === 'number' && /^[+-]/.test(raw.trim());
    tick(); // bars drain first, so what you set is exactly what you get
    const next = op === '+=' ? slot.read() + value : op === '-=' ? slot.read() - value : relative ? slot.read() + value : value;
    slot.write(next);
    changed();
    termPrint(`${path} = ${JSON.stringify(slot.read())}`, 'ok');
  }
  // show <path> / show.<path>: prints a value (items.poken, stats.joy, sbuffling.name...) or any part of her save.
  function showPath(path) {
    const p = path.trim().replace(/^S\./, '');
    if (OWNABLE.includes(p)) return COMMANDS.ls(p);
    const slot = resolve(p);
    if (slot) return termPrint(`${p} = ${JSON.stringify(slot.read())}`);
    const v = getPath(p);
    termPrint(v === undefined ? t('tm_noPath', { path: p }) : JSON.stringify(v, null, 2), v === undefined ? 'err' : '');
  }

  // --- screens and windows that 'open' knows ---
  const OPENERS = {
    home: () => show('home'), shop: () => { shopTab = 'sell'; show('shop'); }, cds: () => { shopTab = 'cds'; show('shop'); },
    skins: () => { shopTab = 'skins'; show('shop'); }, bag: () => openBag(null), inventory: () => openBag(null),
    friends: () => show('friends'), settings: () => show('settings'), achievements: () => show('ach'), ach: () => show('ach'),
    training: () => show('trainMenu'), train: () => show('trainMenu'), bosses: () => show('bosses'), profile: () => openMyProfile(),
    colors: () => openColors(), colours: () => openColors(), cdplayer: () => openCd(), daily: () => openDaily(),
    name: () => openPetName(), tutorial: () => startTutorial(),
    pong: () => startMini('pong', PIZZA_PONG), rhythm: () => startMini('rhythm', RICE_RHYTHM), catch: () => startMini('catch', RICE_CATCH),
    parkour: () => startMini('parkour', GARDEN_PARKOUR), wipeuff: () => startMini('wipeuff', WIPE_UFF), race: () => startMini('wipeuff', WIPE_UFF),
    whack: () => startWhack(), order: () => startOrder(), ricewrap: () => startTrain(),
  };
  const COLOR_NAMES = { btn: 'btn', button: 'btn', win: 'win', window: 'win', outline: 'o1', outline1: 'o1', o1: 'o1', outline2: 'o2', o2: 'o2', text: 'text', glow: 'glow' };

  // The real graphics card, as the browser names it (shortened); a plain guess when it won't say.
  let gpuName = null;
  function realGpu() {
    if (gpuName) return gpuName;
    let name = '';
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      name = (ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl?.getParameter(gl.RENDERER) || '';
    } catch { /* no WebGL */ }
    // "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00003EA0) Direct3D11 vs_5_0 ps_5_0, D3D11)" -> "Intel UHD Graphics 620"
    // Firefox hides the real card behind a stand-in model and adds ", or similar": then only the brand is true.
    if (/or similar/i.test(name)) {
      const brand = (name.match(/NVIDIA|AMD|Radeon|Intel|Apple|Adreno|Mali|PowerVR/i) || ['GPU'])[0].replace(/radeon/i, 'AMD');
      gpuName = `${brand} (model hidden by your browser)`;
      return gpuName;
    }
    const m = name.match(/^ANGLE \([^,]*,\s*([^,]+?)(?:\s*\(0x[0-9a-f]+\))?\s*(?:Direct3D|OpenGL|Vulkan|Metal|,)/i);
    name = (m ? m[1] : name).replace(/\((R|TM)\)/gi, '').replace(/\s+/g, ' ').trim();
    gpuName = name || 'Integrated Graphics';
    return gpuName;
  }
  // --- sbuffofetch: her head as the OS logo, drawn from the real sprite with half blocks ---
  function fetchLogo() {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const H = 42;
      c.width = 44; c.height = H;
      const g2 = c.getContext('2d');
      g2.drawImage(img, 0, 0, 44, H, 0, 0, 44, H);
      let px;
      try { px = g2.getImageData(0, 0, 44, H).data; } catch { px = null; }
      // Trim empty columns so the logo hugs the head.
      const solid = (x, y) => px && px[(y * 44 + x) * 4 + 3] > 40;
      let x0 = 44, x1 = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < 44; x++) if (solid(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      // Very dark pixels (her black curls, the outline) are lifted so they show on the dark terminal.
      const col = (x, y) => {
        const i = (y * 44 + x) * 4;
        let [r0, g0, b0] = [px[i], px[i + 1], px[i + 2]];
        if (r0 + g0 + b0 < 150) { r0 = r0 * 0.5 + 92; g0 = g0 * 0.5 + 80; b0 = b0 * 0.5 + 118; }
        return `rgb(${r0 | 0},${g0 | 0},${b0 | 0})`;
      };
      const rows = [];
      for (let y = 0; y < H; y += 2) {
        let line = '';
        for (let x = x0; x <= x1; x++) {
          const yy = solid(x, y) ? y : (y + 1 < H && solid(x, y + 1) ? y + 1 : -1);
          if (yy < 0) { line += ' '; continue; }
          const i = (yy * 44 + x) * 4;
          const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
          const ch = '@#%$*+=o:'[Math.min(8, Math.floor(lum * 9))];
          line += `<span style="color:${col(x, yy)}">${ch}</span>`;
        }
        rows.push(line);
      }
      const u = Cloud.user();
      const who = `${esc((u?.name || 'guest').toLowerCase())}@sbuffogotchi`;
      const days = S.createdAt ? Math.max(0, Math.floor((Date.now() - S.createdAt) / 86400000)) : 0;
      const mins = Math.floor((Date.now() - term.started) / 60000);
      const info = [
        `<b class="tp">${who}</b>`, '-'.repeat(who.length),
        ['OS', `SbuffOS ${GAME_VERSION} x86_64`], ['Host', `${esc(petName())} (${t('tm_level')} ${S.level})`],
        ['Kernel', '6.9.0-uff-sbuffling'], ['Uptime', t('tm_uptime', { d: days, m: mins })],
        ['Packages', `${Object.values(S.items).reduce((a, b) => a + (b || 0), 0)} (${t('tm_bag')}), ${(S.cds || []).length} (cd)`],
        ['Shell', 'sbsh 1.0'], ['Resolution', `${innerWidth}x${innerHeight}`],
        ['Theme', document.documentElement.classList.contains('modern') ? 'Modern [glass]' : 'Classic [pixel]'],
        ['Skin', esc(t(skinNow().key))], ['CPU', `Poke Bowl Core (${S.str}) @ ${t('tm_streak', { n: S.streak })}`],
        ['GPU', `Rice Rendering ${esc(realGpu())}`], ['Memory', t('tm_memory', { f: Math.round(S.food), e: Math.round(S.energy), j: Math.round(S.joy) })],
        ['Poken', (S.poken || 0).toLocaleString()],
      ].map((r) => (Array.isArray(r) ? `<span class="tp">${r[0]}</span>: ${r[1]}` : r));
      const blocks = ['#231d33', '#e8604c', '#5fcf80', '#ffc857', '#62b6e8', '#c46ad8', '#5fcfb8', '#f6eedd']
        .map((b) => `<span style="background:${b}">&nbsp;&nbsp;&nbsp;</span>`).join('');
      info.push('', blocks);
      const wrap = document.createElement('div');
      wrap.className = 'tfetch';
      wrap.innerHTML = `<pre class="tlogo">${rows.join('\n')}</pre><div class="tinfo">${info.map((l) => `<div>${l || '&nbsp;'}</div>`).join('')}</div>`;
      termPrint(wrap);
    };
    img.src = `${skinNow().dir}/idle_sheet.png`;
  }

  // --- commands ---
  // The commands (left) stay in English; their descriptions (grey) follow the game's language.
  // The commands (left) stay in English; their descriptions (grey) follow the game's language.
  const HELP = [
    ['help', 'h_help'], ['sbuffofetch', 'h_fetch'], ['clear', 'h_clear'], ['close', 'h_close'], ['lock', 'h_lock'],
    ['set.items.<item> = <number>', 'h_items'],
    ['set.stats.<food|energy|joy|level|xp|str|streak|bossWins> = <number>', 'h_stats'],
    ['set.sbuffling.name = "<text>"', 'h_petName'],
    ['set.cheats.<god|oneShot|invincible> = true|false', 'h_cheats'],
    ['get.<cds|skins|achievements> = <name>', 'h_get'],
    ['remove.<cds|skins|achievements> = <name>', 'h_remove'],
    ['give <item> [n]', 'h_give'], ['fill', 'h_fill'], ['golden', 'h_golden'],
    ['show <path>', 'h_show'], ['ls [items|cds|skins|achievements|screens|state]', 'h_ls'], ['cat save', 'h_cat'],
    ['open <screen>', 'h_open'],
    ['look modern|classic|2d|3d', 'h_look'], ['color <btn|win|outline1|outline2|text|glow> <#hex>', 'h_color'],
    ['lang en|es|it', 'h_lang'], ['music on|off', 'h_music'], ['play <cd> / stop', 'h_play'],
    ['say <text>', 'h_say'], ['toast <text>', 'h_toast'], ['js <code>', 'h_js'],
    ['history, echo, date, whoami, uname -a, pwd, reboot', 'h_usual'],
  ];
  const COMMANDS = {
    help() { for (const [c, d] of HELP) termHtml(`<span class="tp">${esc(c)}</span>  <span class="dim">${esc(t(d, { list: Object.keys(OPENERS).join(', ') }))}</span>`); },
    // Leaves admin mode: the terminal locks until the code is entered in Friends again.
    lock() { S.cheats = {}; changed(); closeTerminal(); toast(t('tm_locked')); },
    sbuffofetch: () => fetchLogo(), neofetch: () => fetchLogo(), fastfetch: () => fetchLogo(),
    clear() { $('termOut').replaceChildren(); },
    close: () => closeTerminal(), exit: () => closeTerminal(),
    echo: (rest) => termPrint(rest),
    date: () => termPrint(new Date().toString()),
    whoami: () => termPrint((Cloud.user()?.name || 'guest').toLowerCase()),
    uname: () => termPrint(`SbuffOS sbuffogotchi 6.9.0-uff-sbuffling #1 SMP PREEMPT_DYNAMIC ${GAME_VERSION} x86_64 GNU/Sbuffling`),
    history: () => term.history.forEach((h, i) => termPrint(`${String(i + 1).padStart(4)}  ${h}`)),
    reboot: () => location.reload(),
    sudo: (rest) => (rest ? runCommand(rest) : termPrint(t('tm_sudo'))),
    rm: (rest) => termPrint(t(/-rf|\//.test(rest) ? 'tm_rmNice' : 'tm_rmNothing'), 'err'),
    pwd: () => termPrint(`/home/${(Cloud.user()?.name || 'guest').toLowerCase()}/${document.querySelector('.screen.on')?.id.replace('s-', '') || 'home'}`),
    cd: (rest) => (OPENERS[rest.replace(/^\/|\/$/g, '')] ? (OPENERS[rest.replace(/^\/|\/$/g, '')](), termPrint(`→ ${rest}`)) : termPrint(t('tm_noScreen', { x: rest }), 'err')),
    open(rest) {
      const key = rest.toLowerCase().replace(/[\s_-]/g, '');
      if (!OPENERS[key]) return termPrint(t('tm_openUnknown', { x: rest, list: Object.keys(OPENERS).join(', ') }), 'err');
      OPENERS[key]();
      termPrint(t('tm_opened', { x: key }), 'ok');
    },
    ls(rest) {
      const what = rest || 'state';
      if (what === 'screens') return termPrint(Object.keys(OPENERS).join('  '));
      if (what === 'items') return Object.keys(ITEMS).forEach((id) => termPrint(`${id.padEnd(10)} ${S.items[id] || 0}`));
      if (what === 'cds') return CDS.forEach((c) => termPrint(`${(S.cds || []).includes(c.id) ? '●' : '○'} ${c.id.padEnd(18)} ${c.title}`));
      if (what === 'skins') return SKINS.forEach((s) => termPrint(`${ownsSkin(s.id) ? '●' : '○'} ${s.id.padEnd(10)} ${t(s.key)}`));
      if (what.startsWith('ach')) return ACHIEVEMENTS.forEach((a) => termPrint(`${(S.achieved || {})[a.id] ? '●' : '○'} ${a.id.padEnd(10)} ${t(`ach_${a.id}`)}`));
      const obj = what === 'state' ? S : getPath(what);
      if (obj && typeof obj === 'object') return Object.keys(obj).forEach((k) => termPrint(`${k.padEnd(14)} ${typeof obj[k] === 'object' ? (Array.isArray(obj[k]) ? `[${obj[k].length}]` : '{…}') : JSON.stringify(obj[k])}`));
      termPrint(t('tm_lsNothing', { x: what }), 'err');
    },
    show: (rest) => showPath(rest),
    cat(rest) { if (/save/.test(rest)) termPrint(JSON.stringify(S, null, 2)); else termPrint(t('tm_catTry', { x: rest }), 'err'); },
    set(rest) { const m = rest.match(/^(\S+)\s+(.*)$/); if (!m) return termPrint(t('tm_usage', { x: 'set <path> <value>' }), 'err'); assign(m[1], '=', m[2]); },
    color(rest) {
      const [k, hex] = rest.split(/\s+/);
      if (k === 'reset') { setLookColors({}); return termPrint(t('tm_colorsReset'), 'ok'); }
      const key = COLOR_NAMES[(k || '').toLowerCase()];
      if (!key || !/^#?[0-9a-f]{6}$/i.test(hex || '')) return termPrint(t('tm_usage', { x: 'color <btn|win|outline1|outline2|text|glow> <#rrggbb>  /  color reset' }), 'err');
      if (!document.documentElement.classList.contains('modern')) runCommand('look modern');
      const now = lookColors(); now[key] = hex.startsWith('#') ? hex : `#${hex}`; setLookColors(now);
      termPrint(`${k} = ${now[key]}`, 'ok');
    },
    look(rest) {
      if (/^[23]d$/i.test(rest.trim())) { setCharStyle(rest.trim().toLowerCase()); return termPrint(`character = ${charStyle()}`, 'ok'); }
      const on = /modern/i.test(rest);
      if (!/modern|classic/i.test(rest)) return termPrint(t('tm_usage', { x: 'look modern|classic|2d|3d' }), 'err');
      setLook(on);
      termPrint(`look = ${on ? 'modern' : 'classic'}`, 'ok');
    },
    name(rest) { S.petName = rest.slice(0, PET_NAME_MAX); save(); sync(); render(); termPrint(t('tm_nameNow', { name: petName() }), 'ok'); },
    say(rest) { sighText = rest; sighUntil = Date.now() + 6000; show('home'); render(); termPrint(t('tm_says', { x: rest }), 'ok'); },
    toast: (rest) => toast(rest),
    lang(rest) { if (!I18n.langs[rest]) return termPrint(`lang: ${Object.keys(I18n.langs).join(', ')}`, 'err'); I18n.set(rest); render(); termPrint(`language = ${rest}`, 'ok'); },
    music(rest) { Music.setEnabled(!/off|0|false/i.test(rest)); termPrint(`music = ${Music.enabled() ? 'on' : 'off'}`, 'ok'); },
    play(rest) {
      const cd = findCd(rest.replace(/^cd\s+/, ''));
      if (!cd) return termPrint(t('tm_noCd', { x: rest }), 'err');
      if (!(S.cds || []).includes(cd.id)) return termPrint(t('tm_notOwned', { x: cd.title, id: cd.id }), 'err');
      playCd(cd.id); termPrint(`♪ ${cd.title}`, 'ok');
    },
    stop() { stopCd(); termPrint(t('tm_stopped'), 'ok'); },
    give(rest) {
      const [id, n = '1'] = rest.split(/\s+/);
      if (!ITEMS[id]) return termPrint(t('tm_giveItems', { list: Object.keys(ITEMS).join(', ') }), 'err');
      
      addItems({ [id]: Math.max(1, parseInt(n, 10) || 1) }); changed();
      termPrint(`${id} = ${S.items[id]}`, 'ok');
    },
    fill() { S.food = S.energy = S.joy = 100; changed(); termPrint(t('tm_filled'), 'ok'); },
    golden() { closeTerminal(); show('home'); spawnGolden(); },
    js(rest) {
      // Runs with the save and the game in reach; whatever it returns is printed.
      // console.log / print inside the code write to the terminal too (and still to the browser console).
      const fmt = (v) => typeof v === 'string' ? v : JSON.stringify(v, null, 2);
      const say = (kind) => (...v) => { console[kind](...v); termPrint(v.map(fmt).join(' '), kind === 'error' || kind === 'warn' ? 'err' : ''); };
      const con = { ...console, log: say('log'), info: say('info'), warn: say('warn'), error: say('error') };
      const args = ['S', 'Game', 'save', 'render', 'show', 'toast', 'console', 'print'];
      const vals = [S, window.Game, save, render, show, toast, con, say('log')];
      try {
        const out = new Function(...args, `return (${rest})`)(...vals);
        if (out !== undefined) termPrint(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
        render();
      } catch (e1) {
        try { new Function(...args, rest)(...vals); render(); } catch (e2) { termPrint(String(e2), 'err'); }
      }
    },
  };
  COMMANDS.eval = COMMANDS.js;
  function runCommand(line) {
    const text = line.trim();
    if (!text) return;
    const m = text.match(/^([\w.\-[\]]+)\s*(\+=|-=|=)\s*(.*)$/);
    if (m && !COMMANDS[m[1]]) return assign(m[1], m[2], m[3]);
    const rel = text.match(/^(set\.[\w.\-]+)\s+([+-]\s*\S+)$/);
    if (rel) return assign(rel[1], '=', rel[2].replace(/\s+/g, ''));
    const [cmd, ...restParts] = text.split(/\s+/);
    const rest = text.slice(cmd.length).trim();
    const fn = COMMANDS[cmd.toLowerCase()];
    if (fn) return fn(rest, restParts);
    if (text.startsWith('show.')) return showPath(text.slice(5));
    // A bare path prints its value, like a console variable.
    if (resolve(text) || getPath(text.replace(/^S\./, '')) !== undefined) return showPath(text);
    termPrint(t('tm_notFound', { x: cmd }), 'err');
  }
  $('termIn').addEventListener('keydown', (e) => {
    e.stopPropagation();
    const input = $('termIn');
    if (e.key === 'Enter') {
      const line = input.value;
      input.value = '';
      termHtml(`<span class="tp">${esc((Cloud.user()?.name || 'guest').toLowerCase())}@sbuffogotchi</span>:<span class="tb">~</span>$ ${esc(line)}`);
      if (line.trim()) { term.history.push(line); term.at = term.history.length; }
      try { runCommand(line); } catch (err) { termPrint(String(err), 'err'); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      term.at = Math.max(0, term.at - 1); input.value = term.history[term.at] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      term.at = Math.min(term.history.length, term.at + 1); input.value = term.history[term.at] || '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const words = input.value.split(' ');
      const last = words.at(-1);
      const pool = words.length === 1 ? Object.keys(COMMANDS) : words[0] === 'open' || words[0] === 'cd' ? Object.keys(OPENERS)
        : words[0] === 'play' ? CDS.map((c) => c.id) : words[0] === 'give' ? Object.keys(ITEMS) : Object.keys(S);
      const hits = pool.filter((w) => w.startsWith(last));
      if (hits.length === 1) { words[words.length - 1] = hits[0]; input.value = `${words.join(' ')} `; }
      else if (hits.length > 1) termPrint(hits.join('  '), 'dim');
    } else if (e.key === 'Escape' || e.code === 'Backquote' || e.key === 'F11') {
      e.preventDefault(); closeTerminal();
    }
  });
  $('termOut').addEventListener('pointerup', () => { if (!getSelection().toString()) $('termIn').focus(); });
  $('btnTermClose').onclick = closeTerminal;
  // ` (the key under Esc, like PC games) or F11 opens it on computers.
  window.addEventListener('keydown', (e) => {
    if (!(e.code === 'Backquote' || e.key === 'F11') || !isAdmin()) return;
    const typing = document.activeElement?.matches?.('input:not(#keyCatcher), textarea') && document.activeElement !== $('termIn');
    if (typing && e.key !== 'F11') return;
    e.preventDefault(); e.stopPropagation();
    toggleTerminal();
  }, true);
  // Dragged by its title bar, like the admin panel.
  $('termDrag').onpointerdown = (e) => {
    if (e.target.closest('button')) return;
    const win = $('termWin');
    const box = win.getBoundingClientRect();
    const dx = e.clientX - box.left, dy = e.clientY - box.top;
    $('termDrag').setPointerCapture(e.pointerId);
    $('termDrag').onpointermove = (m) => {
      win.style.left = `${Math.max(-box.width / 2, Math.min(innerWidth - box.width / 2, m.clientX - dx)) + box.width / 2}px`;
      win.style.top = `${Math.max(0, Math.min(innerHeight - 40, m.clientY - dy)) + box.height / 2}px`;
    };
    $('termDrag').onpointerup = () => { $('termDrag').onpointermove = null; };
  };

  // ----- wiring -----
  $('btnFeed').onclick = () => openBag('food');
  $('btnRest').onclick = () => openBag('energy');
  $('btnBag').onclick = () => openBag(null);
  $('btnShop').onclick = () => { shopTab = 'sell'; show('shop'); };
  $('btnFriends').onclick = () => show('friends');
  $('btnAddFriend').onclick = () => addFriend($('friendName').value);
  $('friendName').onkeydown = (e) => { if (e.key === 'Enter') addFriend($('friendName').value); };
  $('pet').onpointerdown = petHer;
  document.querySelectorAll('[data-settings]').forEach((b) => {
    b.onclick = () => {
      settingsReturn = document.querySelector('.screen.on')?.id === 's-login' ? 'login' : 'home';
      show('settings');
    };
  });
  $('btnSettingsBack').onclick = () => show(settingsReturn);
  $('btnTrain').onclick = () => show('trainMenu');
  document.querySelectorAll('[data-home]').forEach((b) => { b.onclick = () => show('home'); });
  $('btnMiniQuit').onclick = () => {
    if (mini?.duel) { duelSend({ t: 'quit' }); finishDuel('gone', t('duelYouQuit')); return; }
    stopMini(); show('trainMenu');
  };
  const KEY_DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
  const KEY_NAMES = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const keyDir = (e) => KEY_DIRS[e.code] || KEY_NAMES[String(e.key).toLowerCase()];
  const holdDir = (dir) => {
    mini.held[dir] = true;
    if (dir === 'left' || dir === 'right') mini.lastX = dir; else mini.lastY = dir;
  };
  const parkourPress = () => { if (mini?.pad) mini.press(mini); };
  window.addEventListener('keydown', (e) => {
    if (mini?.keys && e.code in RHYTHM_KEYS) {
      if (!e.repeat) mini.press(mini, RHYTHM_KEYS[e.code]);
      e.preventDefault();
      return;
    }
    if (!mini?.pad) return;
    if (keyDir(e)) { if (!e.repeat) holdDir(keyDir(e)); else mini.held[keyDir(e)] = true; if (mini.box && !e.repeat) parkourPress(); e.preventDefault(); }
    if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'Enter') { if (!e.repeat) parkourPress(); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (mini?.pad && keyDir(e)) mini.held[keyDir(e)] = false; });
  window.addEventListener('blur', () => { if (mini?.pad) mini.held = {}; });
  window.addEventListener('focus', catchKeys);
  $('s-mini').addEventListener('pointerup', catchKeys);
  $('keyCatcher').addEventListener('input', () => { $('keyCatcher').value = ''; });
  const STICK_RANGE = 40;
  const STICK_DEAD = 0.2;
  function moveStick(e) {
    if (!mini?.pad) return;
    const r = $('stick').getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / STICK_RANGE;
    let y = (e.clientY - (r.top + r.height / 2)) / STICK_RANGE;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    $('knob').style.transform = `translate(${x * STICK_RANGE}px,${y * STICK_RANGE}px)`;
    mini.stick = len < STICK_DEAD ? { x: 0, y: 0 } : { x, y };
  }
  function releaseStick() {
    $('knob').style.transform = '';
    if (mini) mini.stick = null;
  }
  $('stick').onpointerdown = (e) => {
    e.preventDefault();
    $('stick').setPointerCapture(e.pointerId);
    if (mini?.pad && mini.box) parkourPress();
    moveStick(e);
  };
  $('stick').onpointermove = (e) => { if ($('stick').hasPointerCapture(e.pointerId)) moveStick(e); };
  $('stick').onpointerup = releaseStick;
  $('stick').onpointercancel = releaseStick;
  document.addEventListener('contextmenu', (e) => { if (!e.target.matches('input')) e.preventDefault(); });
  $('btnJump').onpointerdown = (e) => { e.preventDefault(); parkourPress(); };
  $('miniCanvas').onpointerdown = (e) => {
    miniPointer(e);
    if (mini?.pad && mini.box) parkourPress();
    if (mini?.keys) mini.press(mini, Math.floor(mini.pointerX / laneW()));
  };
  $('miniCanvas').onpointermove = miniPointer;
  $('btnBoss').onclick = () => show('bosses');
  $('btnBossBack').onclick = () => show('home');
  $('btnTrainTap').onclick = trainTap;
  $('trainMeter').onclick = trainTap;
  $('btnBossTap').onpointerdown = bossTap;
  document.querySelector('.fight').onpointerdown = bossTap;
  $('btnClaim').onclick = claimDaily;
  $('btnRevive').onclick = reviveHer;
  $('btnStartOver').onclick = startOver;
  $('btnLogin').onclick = () => authAction('login');
  $('btnSignup').onclick = () => authAction('signup');
  $('btnOffline').onclick = () => { localStorage.setItem('sbuffogotchi.guest', '1'); enterGame(); };
  $('btnAccount').onclick = openMyProfile;
  $('btnProfileBack').onclick = () => show(profileFrom);
  $('btnGiftClose').onclick = closeGift;
  $('btnGiftSend').onclick = sendGift;
  document.addEventListener('visibilitychange', () => {
    // The CD stops while the app is in the background and carries on when the player is back.
    if (document.hidden && cdNow) { tick(); cdAudio.pause(); cdPausedByHiding = true; }
    else if (!document.hidden && cdPausedByHiding) { cdPausedByHiding = false; if (cdNow) { tick(); cdAudio.play().catch(() => {}); } }
    if (document.hidden) { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); sync(); leavingApp(); } else backInApp();
  });
  window.addEventListener('online', sync);
  setInterval(homeTimers, 1000);
  setInterval(() => { if (!document.hidden) claimGifts(); }, 60000);
  setInterval(checkDuels, 5000);
  setInterval(() => { if ($('s-home').classList.contains('on')) { render(); } }, 5000);

  I18n.apply();
  if (Cloud.user() || localStorage.getItem('sbuffogotchi.guest')) enterGame(); else show('login');

  // For tests: find challenges even in a background tab, and send one without the menus.
  window.__duels = { check: () => checkDuels(true), challenge: (id, game) => challenge(id, id, game), now: () => duel };
  return { state: () => S, set: (patch) => { Object.assign(S, patch); save(); render(); }, checkIn, merge, xpNeeded, show, spawnGolden, mini: () => mini, reminders };
})();
