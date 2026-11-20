// 3D versions of the minigames for the Modern look with the 3D character picked.
// The games themselves don't change: they keep their rules, controls and 2D coordinates, and each frame
// is drawn here as a 3D scene, copied into the game's own canvas, and the game then draws its text on top.
// 1 unit in these scenes is 40 game pixels (32 in Garden Parkour, one hedge tile).
window.Games3D = (() => {
  if (!window.THREE || !window.Pet3D) return null;
  const T = THREE;
  const PX = 40;

  // ----- shared pieces -----
  let renderer = null;
  function getRenderer() {
    if (renderer) return renderer;
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    return renderer;
  }
  const std = (color, rough = 0.6, extra = {}) => new T.MeshStandardMaterial({ color, roughness: rough, ...extra });
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  let seed = 3;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let dotTex = null;
  function shadow(r) {
    if (!dotTex) {
      dotTex = canvasTex(64, 64, (g) => {
        const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
        grad.addColorStop(0, 'rgba(0,0,0,.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      });
    }
    const m = new T.Mesh(new T.PlaneGeometry(r * 2, r * 2), new T.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  function lights(scene, sky = 0xfff4e6, ground = 0x5a4a6a, sun = 2) {
    scene.add(new T.HemisphereLight(sky, ground, 1.4));
    const d = new T.DirectionalLight(0xffffff, sun);
    d.position.set(2, 6, 4);
    scene.add(d);
    return d;
  }
  // Fit a camera's field of view so every point is on screen.
  function fit(camera, points, margin = 0.04) {
    let lo = 5, hi = 120;
    const v = new T.Vector3();
    for (let i = 0; i < 24; i++) {
      camera.fov = (lo + hi) / 2;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const ok = points.every((p) => { v.copy(p).project(camera); return Math.abs(v.x) <= 1 - margin && Math.abs(v.y) <= 1 - margin; });
      if (ok) hi = camera.fov; else lo = camera.fov;
    }
    camera.fov = hi;
    camera.updateProjectionMatrix();
  }

  // ----- food models -----
  const riceGeo = new T.CapsuleGeometry(0.07, 0.13, 4, 10);
  const riceMat = std('#fbf7ee', 0.35);
  function rice(size = 1) {
    const m = new T.Mesh(riceGeo, riceMat);
    m.scale.setScalar(size);
    return m;
  }
  let pizzaTex = null;
  function pizza(r) {
    if (!pizzaTex) {
      pizzaTex = canvasTex(256, 256, (g) => {
        g.fillStyle = '#d9a05a'; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
        g.fillStyle = '#c7432e'; g.beginPath(); g.arc(128, 128, 108, 0, 7); g.fill();
        for (let i = 0; i < 26; i++) {
          g.fillStyle = `rgba(245,${200 + rnd() * 30 | 0},110,.9)`;
          const a = rnd() * 7, d = rnd() * 92;
          g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 12 + rnd() * 16, 0, 7); g.fill();
        }
        for (let i = 0; i < 9; i++) {
          const a = i * 0.7 + rnd(), d = 30 + rnd() * 60;
          g.fillStyle = '#9f2f2a'; g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 14, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(124 + Math.cos(a) * d, 124 + Math.sin(a) * d, 5, 0, 7); g.fill();
        }
      });
    }
    const side = std('#c98d47', 0.7), top = std(0xffffff, 0.55, { map: pizzaTex });
    return new T.Mesh(new T.CylinderGeometry(r, r, 0.12, 40), [side, top, side]);
  }
  function bowl(r = 1) {
    const g = new T.Group();
    const pts = [[0, 0], [0.45, 0.02], [0.75, 0.15], [0.95, 0.42], [1, 0.62], [0.93, 0.62], [0.88, 0.45], [0.7, 0.22], [0, 0.12]].map(([x, y]) => new T.Vector2(x * r, y * r));
    g.add(new T.Mesh(new T.LatheGeometry(pts, 40), std('#3d6fc4', 0.3, { side: T.DoubleSide })));
    const riceTop = new T.Mesh(new T.SphereGeometry(0.88 * r, 32, 12, 0, Math.PI * 2, 0, 0.9), std('#fbf7ee', 0.5));
    riceTop.position.y = 0.05 * r; riceTop.scale.y = 0.6;
    g.add(riceTop);
    const top = (color, x, z, s, shape) => {
      const m = new T.Mesh(shape === 'cube' ? new T.BoxGeometry(0.22 * r * s, 0.12 * r * s, 0.22 * r * s) : new T.SphereGeometry(0.11 * r * s, 12, 8), std(color, 0.45));
      m.position.set(x * r, 0.62 * r, z * r);
      m.rotation.y = x * 3;
      g.add(m);
    };
    top('#f08a6c', -0.3, 0.1, 1.2, 'cube'); top('#f08a6c', -0.1, -0.25, 1.1, 'cube');
    top('#7fb04a', 0.3, 0.15, 1.1, 'cube'); top('#7fb04a', 0.15, -0.3, 1, 'cube');
    top('#9ad06a', 0.05, 0.35, 0.8, 'ball'); top('#9ad06a', 0.38, -0.08, 0.8, 'ball');
    return g;
  }
  function broccoli(s = 1) {
    const g = new T.Group();
    const stem = new T.Mesh(new T.CylinderGeometry(0.09 * s, 0.13 * s, 0.4 * s, 12), std('#9fcf6a', 0.6));
    stem.position.y = 0.2 * s;
    g.add(stem);
    const fl = std('#3f8f3a', 0.8);
    for (const [x, y, z, r] of [[0, 0.52, 0, 0.22], [0.18, 0.45, 0.05, 0.16], [-0.18, 0.45, 0.05, 0.16], [0.05, 0.45, 0.18, 0.15], [-0.05, 0.47, -0.17, 0.15]]) {
      const b = new T.Mesh(new T.IcosahedronGeometry(r * s, 1), fl);
      b.position.set(x * s, y * s, z * s);
      g.add(b);
    }
    return g;
  }
  function carrot(s = 1) {
    const g = new T.Group();
    const body = new T.Mesh(new T.ConeGeometry(0.17 * s, 0.6 * s, 16), std('#ef7f2d', 0.55));
    body.rotation.x = Math.PI; body.position.y = 0.3 * s;
    g.add(body);
    for (const a of [0, 2.1, 4.2]) {
      const l = new T.Mesh(new T.ConeGeometry(0.04 * s, 0.28 * s, 6), std('#4f9a4a', 0.6));
      l.position.set(Math.cos(a) * 0.05 * s, 0.72 * s, Math.sin(a) * 0.05 * s);
      l.rotation.z = Math.cos(a) * 0.4; l.rotation.x = Math.sin(a) * 0.4;
      g.add(l);
    }
    return g;
  }
  function sprout(s = 1) {
    const g = new T.Group();
    const b = new T.Mesh(new T.SphereGeometry(0.24 * s, 20, 14), std('#7fbf4f', 0.55));
    b.position.y = 0.26 * s;
    g.add(b);
    for (let i = 0; i < 5; i++) {
      const l = new T.Mesh(new T.SphereGeometry(0.13 * s, 12, 8), std('#5fa83f', 0.6));
      const a = (i / 5) * Math.PI * 2;
      l.position.set(Math.cos(a) * 0.18 * s, 0.22 * s, Math.sin(a) * 0.18 * s);
      l.scale.set(1, 0.6, 1);
      g.add(l);
    }
    return g;
  }
  function eggplant(s = 1) {
    const g = new T.Group();
    const b = new T.Mesh(new T.SphereGeometry(0.2 * s, 20, 14), std('#6b3f8f', 0.3));
    b.scale.set(1, 1.6, 1); b.position.y = 0.32 * s;
    g.add(b);
    const cap = new T.Mesh(new T.ConeGeometry(0.12 * s, 0.14 * s, 8), std('#4f9a4a', 0.6));
    cap.position.y = 0.66 * s;
    g.add(cap);
    return g;
  }
  // Little faces on the veggie enemies, like their boss sprites.
  function face(g, y, z, s = 1) {
    const eye = std('#1d1a22', 0.2);
    for (const x of [-0.07, 0.07]) {
      const e = new T.Mesh(new T.SphereGeometry(0.035 * s, 10, 8), eye);
      e.position.set(x * s, y * s, z * s);
      g.add(e);
    }
    return g;
  }
  const VEGGIES = {
    broccoli: (s) => face(broccoli(s), 0.5, 0.22, s),
    carrot: (s) => face(carrot(s), 0.42, 0.13, s),
    sprout: (s) => face(sprout(s), 0.3, 0.24, s),
    eggplant: (s) => face(eggplant(s), 0.42, 0.19, s),
  };

  // ----- Pizza Pong: a felt table seen from behind your pizza -----
  function buildPong(W, H) {
    const scene = new T.Scene();
    scene.background = new T.Color('#1d1828');
    lights(scene);
    const w = W / PX, h = H / PX;
    const felt = canvasTex(256, 256, (g) => {
      g.fillStyle = '#2f6b58'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(rnd() * 256, rnd() * 256, 1, 1); }
    }, [w / 3, h / 3]);
    const table = new T.Mesh(new T.PlaneGeometry(w, h), std(0xffffff, 0.95, { map: felt }));
    table.rotation.x = -Math.PI / 2;
    scene.add(table);
    const line = std('#f6eedd', 0.6);
    for (let x = -w / 2 + 0.25; x < w / 2; x += 0.6) {
      const d = new T.Mesh(new T.BoxGeometry(0.35, 0.01, 0.08), line);
      d.position.set(x, 0.005, 0);
      scene.add(d);
    }
    const wood = std('#6e4227', 0.45);
    for (const [bw, bd, x, z] of [[w + 0.5, 0.25, 0, -h / 2 - 0.125], [w + 0.5, 0.25, 0, h / 2 + 0.125], [0.25, h, -w / 2 - 0.125, 0], [0.25, h, w / 2 + 0.125, 0]]) {
      const b = new T.Mesh(new T.BoxGeometry(bw, 0.3, bd), wood);
      b.position.set(x, 0.1, z);
      scene.add(b);
    }
    const legs = new T.Mesh(new T.BoxGeometry(w + 0.5, 3, h + 0.5), std('#3a2a22', 0.8));
    legs.position.y = -1.55;
    scene.add(legs);
    const floor = new T.Mesh(new T.PlaneGeometry(80, 80), std('#2a2233', 0.9));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3;
    scene.add(floor);
    const you = pizza(34 / PX), cpu = pizza(34 / PX);
    scene.add(you, cpu);
    const ball = rice(1.7);
    const ballShadow = shadow(0.22);
    scene.add(ball, ballShadow);
    const camera = new T.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(0, h * 1.05, h * 0.78);
    camera.lookAt(0, 0, h * 0.04);
    const v3 = (x, z) => new T.Vector3(x, 0.15, z);
    fit(camera, [v3(-w / 2 - 0.3, h / 2 + 0.3), v3(w / 2 + 0.3, h / 2 + 0.3), v3(-w / 2 - 0.3, -h / 2 - 0.3), v3(w / 2 + 0.3, -h / 2 - 0.3)], 0.01);
    return {
      scene, camera,
      update(g, time) {
        const X = (x) => (x - W / 2) / PX, Z = (y) => (y - H / 2) / PX;
        you.position.set(X(g.px), 0.07, Z(g.py));
        cpu.position.set(X(g.cx), 0.07, Z(g.cy));
        you.rotation.y = time * 0.6; cpu.rotation.y = -time * 0.6;
        const b = g.ball;
        ball.position.set(X(b.x), 0.16 + Math.abs(Math.sin(time * 9)) * 0.06, Z(b.y));
        ball.rotation.set(Math.PI / 2, 0, -Math.atan2(b.vy, b.vx) + Math.PI / 2);
        ballShadow.position.set(X(b.x), 0.01, Z(b.y));
      },
    };
  }

  // ----- Rice Catch: rice and broccoli falling into a poke bowl in a kitchen -----
  function buildCatch(W, H) {
    const scene = new T.Scene();
    scene.background = new T.Color('#efe6d4');
    lights(scene, 0xfff6ea, 0x8a6a50, 2.2);
    const w = W / PX, h = H / PX;
    const tiles = canvasTex(256, 256, (g) => {
      g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
        g.fillStyle = (x + y) % 128 ? '#f4f0e8' : '#ece6da';
        g.fillRect(x + 3, y + 3, 58, 58);
      }
    }, [w / 1.6, h / 1.6]);
    const wall = new T.Mesh(new T.PlaneGeometry(w * 2.2, h * 2), std(0xffffff, 0.4, { map: tiles }));
    wall.position.set(0, h / 2, -2.5);
    scene.add(wall);
    const counter = new T.Mesh(new T.BoxGeometry(w * 2.2, 0.75, 4), std('#a8784c', 0.5));
    counter.position.set(0, 0.375 - 0.1, -0.5);
    scene.add(counter);
    const top = new T.Mesh(new T.BoxGeometry(w * 2.2, 0.08, 4.1), std('#e9e4dc', 0.2));
    top.position.set(0, 0.69, -0.5);
    scene.add(top);
    const catcher = bowl(1);
    scene.add(catcher);
    const pool = { good: [], bad: [] };
    const D = 16;
    const camera = new T.PerspectiveCamera(2 * Math.atan(h / 2 / D) * 180 / Math.PI, W / H, 0.1, 100);
    camera.position.set(0, h / 2, D);
    camera.lookAt(0, h / 2, 0);
    return {
      scene, camera,
      update(g, time) {
        const X = (x) => (x - W / 2) / PX, Y = (y) => (H - y) / PX;
        catcher.position.set(X(g.bx), Y(H - 30) + 0.02, 0);
        let gi = 0, bi = 0;
        for (const item of g.items) {
          const list = item.bad ? pool.bad : pool.good;
          const i = item.bad ? bi++ : gi++;
          if (!list[i]) { list[i] = item.bad ? broccoli(1.3) : rice(2.6); scene.add(list[i]); }
          const m = list[i];
          m.visible = true;
          m.position.set(X(item.x), Y(item.y) - (item.bad ? 0.45 : 0), 0.2);
          m.rotation.set(time * 3 + item.x, time * 2 + item.y * 0.01, item.bad ? Math.sin(time * 4 + item.x) * 0.4 : time * 2);
        }
        pool.good.forEach((m, i) => { if (i >= gi) m.visible = false; });
        pool.bad.forEach((m, i) => { if (i >= bi) m.visible = false; });
      },
    };
  }

  // ----- Rice Rhythm: four lanes running into the distance, bowls at the near end -----
  const LANE_COLORS = ['#c46ad8', '#5aa8e8', '#5fcf80', '#e8604c'];
  function buildRhythm(W, H, hitY) {
    const scene = new T.Scene();
    scene.background = new T.Color('#1a1428');
    scene.fog = new T.Fog('#1a1428', 30, 62);
    // A night sky with stars behind the stage, so the top of the screen isn't empty.
    const sky = new T.Mesh(new T.PlaneGeometry(160, 70), new T.MeshBasicMaterial({ fog: false, map: canvasTex(512, 256, (c, sw, sh) => {
      const grad = c.createLinearGradient(0, 0, 0, sh);
      grad.addColorStop(0, '#0d0a1a'); grad.addColorStop(0.6, '#2a1d4a'); grad.addColorStop(1, '#5a2f6a');
      c.fillStyle = grad; c.fillRect(0, 0, sw, sh);
      for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; c.fillRect(rnd() * sw, rnd() * sh * 0.8, 1 + (rnd() < 0.1), 1 + (rnd() < 0.1)); }
      c.fillStyle = 'rgba(255,214,140,.9)'; c.beginPath(); c.arc(sw * 0.72, sh * 0.3, 18, 0, 7); c.fill();
    }) }));
    sky.position.set(0, 18, -70);
    scene.add(sky);
    lights(scene, 0xe8dcff, 0x2a2040, 1.6);
    const laneW = W / 4 / PX, w = W / PX, DEPTH = 3.4, far = -(hitY + 40) / PX * DEPTH;
    const lanes = [], bowls = [];
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.5) * laneW - w / 2;
      const lane = new T.Mesh(new T.PlaneGeometry(laneW * 0.96, -far + 2), std(i % 2 ? '#2b2340' : '#271f3a', 0.7, { emissive: LANE_COLORS[i], emissiveIntensity: 0 }));
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(x, 0, far / 2 + 1);
      scene.add(lane);
      lanes.push(lane);
      const edge = new T.Mesh(new T.BoxGeometry(laneW * 0.9, 0.02, 0.08), std(LANE_COLORS[i], 0.4, { emissive: LANE_COLORS[i], emissiveIntensity: 0.6 }));
      edge.position.set(x, 0.01, -0.7);
      scene.add(edge);
      const b = bowl(Math.min(0.75, laneW * 0.38));
      b.position.set(x, 0, 0);
      scene.add(b);
      bowls.push(b);
    }
    for (let k = 0; k <= 4; k++) { // glowing rails between the lanes
      const rail = new T.Mesh(new T.BoxGeometry(0.04, 0.03, -far + 2), std('#8f7ab8', 0.4, { emissive: '#6a52a0', emissiveIntensity: 0.5 }));
      rail.position.set(k * laneW - w / 2, 0.015, far / 2 + 1);
      scene.add(rail);
    }
    const pool = [];
    const camera = new T.PerspectiveCamera(55, W / H, 0.1, 100);
    // Steep enough that the lanes run from the bowls near the bottom up to the top of the screen.
    camera.position.set(0, w * 1.05, w * 0.5);
    camera.lookAt(0, 0, far * 0.56);
    fit(camera, [new T.Vector3(-w / 2, 0, 0.9), new T.Vector3(w / 2, 0, 0.9), new T.Vector3(0, 0, far)], 0.0);
    return {
      scene, camera,
      update(g, time) {
        for (let i = 0; i < 4; i++) {
          lanes[i].material.emissiveIntensity = g.flash[i] * 4;
          bowls[i].position.y = g.bump[i] ? 0.18 : 0;
        }
        g.notes.forEach((n, i) => {
          if (!pool[i]) { pool[i] = rice(3.4); scene.add(pool[i]); }
          const m = pool[i];
          m.visible = true;
          m.position.set((n.lane + 0.5) * laneW - w / 2, 0.25, (n.y - hitY) / PX * DEPTH);
          m.rotation.set(Math.PI / 2, time * 3 + i, 0);
        });
        pool.forEach((m, i) => { if (i >= g.notes.length) m.visible = false; });
      },
    };
  }

  // ----- Garden Parkour: a 3D hedge maze with her walking through it -----
  function buildParkour(W, H, map, tile, lookId) {
    const scene = new T.Scene();
    scene.background = new T.Color('#140f1c');
    lights(scene, 0xfff4e0, 0x3a5a3a, 2);
    const cols = map[0].length, rows = map.length;
    const X = (x) => x / tile - cols / 2, Z = (y) => y / tile;
    // Hedges: one instanced box per hedge tile, and leafy bumps on top.
    const hedgeCells = [];
    for (let y = -6; y < rows + 4; y++) for (let x = -8; x < cols + 8; x++) {
      const inside = y >= 0 && y < rows && x >= 0 && x < cols;
      if (!inside || map[y][x] === '#') hedgeCells.push([x, y]);
    }
    const hedgeGeo = new T.BoxGeometry(1, 0.8, 1);
    const hedges = new T.InstancedMesh(hedgeGeo, std('#2f6b3f', 0.85), hedgeCells.length);
    const bumps = new T.InstancedMesh(new T.IcosahedronGeometry(0.32, 1), std('#3f8a4f', 0.8), hedgeCells.length * 2);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(1, 1, 1);
    hedgeCells.forEach(([x, y], i) => {
      m4.compose(new T.Vector3(x - cols / 2 + 0.5, 0.4, y + 0.5), q, sc);
      hedges.setMatrixAt(i, m4);
      for (let k = 0; k < 2; k++) {
        const s = 0.8 + rnd() * 0.4;
        m4.compose(new T.Vector3(x - cols / 2 + 0.25 + k * 0.5, 0.82, y + 0.3 + rnd() * 0.4), q, new T.Vector3(s, s * 0.7, s));
        bumps.setMatrixAt(i * 2 + k, m4);
      }
    });
    scene.add(hedges, bumps);
    // Path tiles (none over the gaps, which drop into the dark).
    const pathCells = [];
    map.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '#' && c !== '_') pathCells.push([x, y, c]); }));
    const path = new T.InstancedMesh(new T.BoxGeometry(1, 0.2, 1), std(0xffffff, 0.9), pathCells.length);
    const colA = new T.Color('#d9bd8c'), colB = new T.Color('#cfb07d');
    pathCells.forEach(([x, y], i) => {
      m4.compose(new T.Vector3(x - cols / 2 + 0.5, -0.1, y + 0.5), q, sc);
      path.setMatrixAt(i, m4);
      path.setColorAt(i, (x + y) % 2 ? colA : colB);
    });
    scene.add(path);
    // Pads, spikes
    const spikes = [];
    const spikeMat = std('#d8d8e0', 0.25, { metalness: 0.7 });
    for (const [x, y, c] of pathCells) {
      const cx = x - cols / 2 + 0.5, cz = y + 0.5;
      if (c === 'C' || c === 'G') {
        const pad = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.06, 28), std(c === 'G' ? '#ffc857' : '#5fcf80', 0.3, { emissive: c === 'G' ? '#ffb020' : '#2fa050', emissiveIntensity: 0.5 }));
        pad.position.set(cx, 0.03, cz);
        scene.add(pad);
      }
      if (c === 's') {
        const grp = new T.Group();
        grp.position.set(cx, 0, cz);
        for (const [a, b] of [[-0.25, -0.2], [0.25, -0.2], [0, 0.22], [-0.25, 0.25], [0.25, 0.25]]) {
          const k = new T.Mesh(new T.ConeGeometry(0.09, 0.4, 10), spikeMat);
          k.position.set(a, 0.2, b);
          grp.add(k);
        }
        scene.add(grp);
        spikes.push({ grp, x, y });
      }
    }
    // The goal gets a little poke bowl to walk to.
    const goal = pathCells.filter(([, , c]) => c === 'G');
    if (goal.length) {
      const b = bowl(0.35);
      b.position.set(goal.reduce((s, [x]) => s + x, 0) / goal.length - cols / 2 + 0.5, 0.06, goal[0][1] + 0.5);
      scene.add(b);
    }
    // The void under the gaps
    const voidPlane = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshBasicMaterial({ color: '#0a0710' }));
    voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.y = -3;
    scene.add(voidPlane);
    // Her, small enough for the maze
    const me = Pet3D.figure(lookId);
    const meShadow = shadow(0.35);
    me.root.scale.setScalar(0.5);
    scene.add(me.root, meShadow);
    const foes = [];
    const camera = new T.PerspectiveCamera(48, W / H, 0.1, 200);
    return {
      scene, camera,
      update(g, time, spikesUp) {
        for (const s of spikes) {
          const up = spikesUp(g.time, s.x * tile, s.y * tile);
          s.grp.position.y += ((up ? 0 : -0.36) - s.grp.position.y) * 0.4;
        }
        g.foes.forEach((f, i) => {
          if (!foes[i]) { foes[i] = VEGGIES[f.art](0.9); foes[i].userData.sh = shadow(0.3); scene.add(foes[i], foes[i].userData.sh); }
          const m = foes[i];
          m.position.set(X(f.x), Math.abs(Math.sin(time * 8 + i)) * 0.1, Z(f.y));
          m.rotation.y = f.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          m.userData.sh.position.set(X(f.x), 0.01, Z(f.y));
        });
        const air = g.jump > 0 ? Math.sin((1 - g.jump / 0.5) * Math.PI) * 0.7 : 0;
        const shrink = g.fall > 0 ? g.fall / 0.4 : 1;
        me.root.position.set(X(g.x), air - (1 - shrink) * 1.2, Z(g.y) + 0.1);
        me.root.scale.setScalar(0.5 * shrink);
        me.root.rotation.y = { up: Math.PI, down: 0 }[g.facing] ?? (g.flip ? -Math.PI / 2 : Math.PI / 2);
        me.root.visible = !(g.safe > 0 && Math.floor(g.safe * 10) % 2);
        me.pose(g.walked ? 'walk' : 'idle');
        meShadow.position.set(X(g.x), 0.01, Z(g.y) + 0.1);
        meShadow.visible = g.fall <= 0;
        // The camera follows from behind and above, a little ahead of her.
        const cz = Math.max(4, Math.min(rows - 2, Z(g.y))), cx = X(g.x) * 0.35;
        camera.position.set(cx, 7.2, cz + 5.2);
        camera.lookAt(cx, 0, cz - 1.6);
      },
    };
  }

  // ----- bosses: a garden arena behind the fight, with the boss as a big angry veggie -----
  // Faces for the bosses: white eyes with pupils, angry eyebrows, a frown. Positions are per veggie.
  const BOSS_FACE = { broccoli: [0.27, 0.15], carrot: [0.42, 0.14], sprout: [0.3, 0.24], eggplant: [0.42, 0.2] };
  const BOSS_BODY = { broccoli: broccoli, carrot, sprout, eggplant };
  const BOSS_LIMB = { broccoli: '#9fcf6a', carrot: '#ef7f2d', sprout: '#7fbf4f', eggplant: '#6b3f8f' };
  function bossModel(art) {
    const s = 2.6;
    const holder = new T.Group();
    const body = (BOSS_BODY[art] || broccoli)(s);
    body.position.y = 0.42;
    holder.add(body);
    const [fy, fz] = BOSS_FACE[art] || BOSS_FACE.broccoli;
    const y = fy * s + 0.42, z = fz * s;
    const white = std('#ffffff', 0.3), dark = std('#1d1a22', 0.3);
    for (const side of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.13, 16, 12), white);
      eye.position.set(side * 0.18, y, z);
      eye.scale.set(1, 1.2, 0.5);
      const pupil = new T.Mesh(new T.SphereGeometry(0.065, 12, 10), dark);
      pupil.position.set(side * 0.16, y - 0.02, z + 0.06);
      // Angry eyebrows slanting down towards the middle.
      const brow = new T.Mesh(new T.CapsuleGeometry(0.035, 0.18, 4, 8), dark);
      brow.position.set(side * 0.19, y + 0.2, z + 0.04);
      brow.rotation.z = Math.PI / 2 + side * 0.45;
      holder.add(eye, pupil, brow);
    }
    const mouth = new T.Mesh(new T.TorusGeometry(0.12, 0.03, 8, 20, Math.PI), dark);
    mouth.position.set(0, y - 0.26, z + 0.02);
    holder.add(mouth);
    // Stubby arms and legs, like hers.
    const limb = std(BOSS_LIMB[art] || '#9fcf6a', 0.55);
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new T.Group();
      arm.position.set(side * 0.62, 0.95, 0.05);
      const a = new T.Mesh(new T.CapsuleGeometry(0.09, 0.3, 4, 10), limb);
      a.position.y = -0.18;
      const fist = new T.Mesh(new T.SphereGeometry(0.13, 14, 10), limb);
      fist.position.y = -0.42;
      arm.add(a, fist);
      arm.rotation.z = side * 0.5;
      holder.add(arm);
      arms.push(arm);
      const leg = new T.Mesh(new T.CapsuleGeometry(0.1, 0.2, 4, 10), limb);
      leg.position.set(side * 0.22, 0.2, 0);
      const foot = new T.Mesh(new T.SphereGeometry(0.15, 14, 10), dark);
      foot.position.set(side * 0.22, 0.06, 0.08);
      foot.scale.set(1, 0.6, 1.3);
      holder.add(leg, foot);
    }
    holder.userData.arms = arms;
    holder.userData.body = body;
    return holder;
  }
  const boss = (() => {
    let st = null;
    function start(stage, art, read) {
      stop();
      const r = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
      r.outputColorSpace = T.SRGBColorSpace;
      r.toneMapping = T.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.1;
      r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      const c = r.domElement;
      c.className = 'boss3d';
      stage.prepend(c);
      stage.classList.add('is3d');
      const scene = new T.Scene();
      scene.background = canvasTex(16, 256, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#2b1f4a'); grad.addColorStop(0.55, '#c0587a'); grad.addColorStop(1, '#f6b16b');
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
      });
      lights(scene, 0xffe2c8, 0x40305a, 2.4);
      const rim = new T.DirectionalLight(0xff9a7a, 1.6);
      rim.position.set(-3, 3, -4);
      scene.add(rim);
      // A grassy clearing at sunset, with a hedge behind and a couple of lanterns.
      const grass = canvasTex(256, 256, (g) => {
        g.fillStyle = '#4f8a3c'; g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 2400; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(30,70,25,.5)' : 'rgba(130,190,80,.35)'; g.fillRect(rnd() * 256, rnd() * 256, 2, 5); }
      }, [8, 4]);
      const ground = new T.Mesh(new T.PlaneGeometry(40, 20), std(0xffffff, 0.95, { map: grass }));
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      const hedge = new T.InstancedMesh(new T.IcosahedronGeometry(0.9, 1), std('#2f6b3f', 0.85), 40);
      const m4 = new T.Matrix4(), q = new T.Quaternion();
      for (let i = 0; i < 40; i++) {
        const s = 0.8 + rnd() * 0.6;
        m4.compose(new T.Vector3(-16 + i * 0.85, 0.5 + rnd() * 0.5, -5 - rnd() * 0.8), q, new T.Vector3(s, s, s));
        hedge.setMatrixAt(i, m4);
      }
      scene.add(hedge);
      for (const x of [-5.5, 5.5]) {
        const post = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.4, 10), std('#3a2a22', 0.6));
        post.position.set(x, 1.2, -3.2);
        const glow = new T.Mesh(new T.SphereGeometry(0.22, 16, 12), std('#ffd27a', 0.3, { emissive: '#ffb84a', emissiveIntensity: 1.6 }));
        glow.position.set(x, 2.5, -3.2);
        const light = new T.PointLight(0xffb86a, 3, 6, 1.5);
        light.position.copy(glow.position);
        scene.add(post, glow, light);
      }
      const camera = new T.PerspectiveCamera(38, 2, 0.1, 100);
      camera.position.set(0, 2.4, 9);
      camera.lookAt(0, 1.45, 0);
      const foe = bossModel(art);
      const foeShadow = shadow(1);
      scene.add(foe, foeShadow);
      // The poke bowl she eats during the boss's attack: it empties in three bites' worth of stages.
      const meal = bowl(0.95);
      meal.visible = false;
      scene.add(meal);
      st = { r, c, scene, camera, foe, foeShadow, meal, stage, read, raf: 0, size: '', hitAt: -9, strikeAt: -9, home: new T.Vector3(2.6, 0, 0) };
      const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
      const step = () => {
        if (!st || !stage.offsetParent) return;
        const sr = stage.getBoundingClientRect();
        const size = `${Math.round(sr.width)}x${Math.round(sr.height)}`;
        if (size !== st.size) {
          st.size = size;
          r.setSize(sr.width, sr.height, false);
          camera.aspect = sr.width / sr.height;
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld();
          // The boss stands where its picture would be, and the bowl where the 2D bowl sits.
          const at = (el) => {
            const er = el.getBoundingClientRect();
            const nx = ((er.left + er.width / 2 - sr.left) / sr.width) * 2 - 1;
            const ny = -(((er.bottom - 4 - sr.top) / sr.height) * 2 - 1);
            ray.setFromCamera(new T.Vector2(nx, ny), camera);
            return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
          };
          const b = at(stage.querySelector('#bossArt'));
          if (b) st.home.copy(b);
          const m = at(stage.querySelector('#bowl'));
          if (m) meal.position.copy(m).add(new T.Vector3(0, 0, 0.8));
        }
        const now = performance.now() / 1000;
        const s = read() || {};
        const sinceHit = now - st.hitAt, sinceStrike = now - st.strikeAt;
        foe.position.copy(st.home);
        foe.rotation.set(0, -0.3, 0);
        foe.scale.set(1, 1, 1);
        // Menacing bob, a lunge at her when it strikes, a flinch when she hits it.
        const breathe = Math.sin(now * 3);
        foe.position.y = Math.abs(Math.sin(now * 3)) * 0.06;
        foe.userData.body.scale.set(1 + breathe * 0.02, 1 - breathe * 0.02, 1);
        foe.userData.arms.forEach((a, i) => { a.rotation.x = Math.sin(now * 6 + i * Math.PI) * 0.3; });
        if (sinceStrike < 0.25) {
          const k = Math.sin((sinceStrike / 0.25) * Math.PI);
          foe.position.x -= k * 1.4;
          foe.rotation.z = k * 0.25;
          foe.userData.arms.forEach((a) => { a.rotation.x = -1.6 * k; });
        }
        if (sinceHit < 0.12) {
          const k = Math.sin((sinceHit / 0.12) * Math.PI);
          foe.position.x += k * 0.15;
          foe.scale.set(1 + k * 0.08, 1 - k * 0.1, 1 + k * 0.08);
        }
        foeShadow.position.set(foe.position.x, 0.01, foe.position.z);
        meal.visible = !!s.bowl;
        if (s.bowl) {
          const left = 1 - Math.min(1, (s.stage || 0) / 100);
          meal.children.forEach((m, i) => { if (i > 0) m.visible = left > 0.05; });
          meal.children[1].scale.set(1, Math.max(0.05, 0.6 * left), 1);
        }
        r.render(scene, camera);
      };
      const loop = () => { if (!st) return; st.raf = requestAnimationFrame(loop); step(); };
      st.step = step;
      loop();
    }
    function stop() {
      if (!st) return;
      cancelAnimationFrame(st.raf);
      st.r.dispose();
      st.c.remove();
      st.stage.classList.remove('is3d');
      st = null;
    }
    return {
      start, stop,
      hit() { if (st) st.hitAt = performance.now() / 1000; },
      strike() { if (st) st.strikeAt = performance.now() / 1000; },
      step: () => st?.step(),
    };
  })();

  // ----- Wipe-Uff: a real 3D garden circuit -----
  // The race keeps its own rules (distance along the track, sideways position, laps); here the circuit's
  // bends and hills become a 3D road. Three laps' worth are laid end to end (the one behind, the current
  // one and the next) so the road ahead and behind always exists, and karts are placed on the nearest copy.
  const RACE_SCALE = 200; // the race's own units per 3D unit: one track segment is 1 unit long
  const TURN = 1.6; // how sharply the bends turn
  function raceTextures() {
    const road = canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = '#c8a46c'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(90,60,30,.12)' : 'rgba(255,240,210,.12)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
      g.fillStyle = '#efe2c2'; g.fillRect(w / 2 - 3, 0, 6, h / 2); // the dashed middle line
    });
    road.wrapS = road.wrapT = T.RepeatWrapping;
    const rumble = canvasTex(16, 64, (g, w, h) => {
      g.fillStyle = '#d94c3c'; g.fillRect(0, 0, w, h / 2);
      g.fillStyle = '#f6eedd'; g.fillRect(0, h / 2, w, h / 2);
    });
    rumble.wrapS = rumble.wrapT = T.RepeatWrapping;
    const grass = canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = '#62b04f'; g.fillRect(0, 0, w, h / 2);
      g.fillStyle = '#6fbf5a'; g.fillRect(0, h / 2, w, h / 2);
      for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(40,90,30,.25)'; g.fillRect(rnd() * w, rnd() * h, 1, 3); }
    });
    grass.wrapS = grass.wrapT = T.RepeatWrapping;
    const crate = canvasTex(64, 64, (g) => {
      g.fillStyle = '#f2b53a'; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = '#b5761e'; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58);
      g.fillStyle = '#ffffff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 32, 35);
    });
    const checker = canvasTex(64, 16, (g) => {
      for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#222' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); }
    });
    checker.magFilter = T.NearestFilter;
    return { road, rumble, grass, crate, checker };
  }
  // Garden scenery, each built once and copied along the track.
  function sceneryModels() {
    const m = {};
    const cab = new T.Group();
    const head = new T.Mesh(new T.SphereGeometry(1.2, 20, 14), std('#b9df8a', 0.6));
    head.position.y = 1.0; head.scale.y = 0.85;
    cab.add(head);
    for (let i = 0; i < 6; i++) {
      const l = new T.Mesh(new T.SphereGeometry(0.9, 14, 10), std('#7fbf4f', 0.7));
      const a = (i / 6) * Math.PI * 2;
      l.position.set(Math.cos(a) * 1.1, 0.5, Math.sin(a) * 1.1);
      l.scale.set(1, 0.45, 1);
      cab.add(l);
    }
    m.cabbage = cab;
    const tom = new T.Group();
    const bush = new T.Mesh(new T.IcosahedronGeometry(1.1, 1), std('#4f9a4a', 0.8));
    bush.position.y = 1.3;
    tom.add(bush);
    const stake = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 3, 8), std('#8a6a44', 0.7));
    stake.position.y = 1.5;
    tom.add(stake);
    for (const [x, y, z] of [[0.8, 1.2, 0.5], [-0.7, 1.6, 0.6], [0.2, 0.8, 0.9], [-0.4, 1.0, -0.8]]) {
      const tm = new T.Mesh(new T.SphereGeometry(0.3, 14, 10), std('#e2462e', 0.35));
      tm.position.set(x, y, z);
      tom.add(tm);
    }
    m.tomato = tom;
    const sun = new T.Group();
    const stem = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, 4, 8), std('#5f9a3a', 0.7));
    stem.position.y = 2;
    const disc = new T.Group();
    disc.position.set(0, 4.1, 0.15);
    for (let i = 0; i < 14; i++) {
      const p = new T.Mesh(new T.SphereGeometry(0.32, 10, 8), std('#ffd23a', 0.5));
      const a = (i / 14) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0);
      p.scale.set(1, 0.5, 0.25); p.rotation.z = a;
      disc.add(p);
    }
    const centre = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 0.2, 20), std('#6b3f22', 0.8));
    centre.rotation.x = Math.PI / 2;
    disc.add(centre);
    sun.add(stem, disc);
    m.sunflower = sun;
    const car = new T.Group();
    for (let i = 0; i < 4; i++) {
      const top = new T.Mesh(new T.ConeGeometry(0.22, 0.25, 12), std('#ef7f2d', 0.5));
      top.position.set(-1.5 + i, 0.1, 0);
      const leaves = new T.Mesh(new T.ConeGeometry(0.3, 0.9, 6), std('#4f9a4a', 0.6));
      leaves.position.set(-1.5 + i, 0.65, 0);
      car.add(top, leaves);
    }
    const soil = new T.Mesh(new T.BoxGeometry(4.2, 0.12, 0.9), std('#6b4a32', 0.95));
    car.add(soil);
    m.carrots = car;
    const fence = new T.Group();
    const wood = std('#b8895a', 0.7);
    for (const z of [-2.5, 0, 2.5]) { const p = new T.Mesh(new T.BoxGeometry(0.2, 1.4, 0.2), wood); p.position.set(0, 0.7, z); fence.add(p); }
    for (const y of [0.5, 1.05]) { const r = new T.Mesh(new T.BoxGeometry(0.1, 0.16, 5.4), wood); r.position.set(0, y, 0); fence.add(r); }
    m.fence = fence;
    return m;
  }
  function kart(rider) {
    const g = new T.Group();
    const body = bowl(1.35);
    body.children.slice(1).forEach((c) => { c.visible = false; }); // no rice in the kart bowl, she sits in it
    body.position.y = 0.45;
    g.add(body);
    const tyre = std('#26222c', 0.7);
    for (const [x, z] of [[-1.15, 0.8], [1.15, 0.8], [-1.15, -0.8], [1.15, -0.8]]) {
      const w = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.35, 18), tyre);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.42, z);
      g.add(w);
    }
    rider.position.y = 0.55;
    rider.rotation.y = Math.PI; // facing down the road, so the chase camera sees her from behind
    g.add(rider);
    const sh = shadow(1.8);
    sh.position.y = 0.02;
    g.add(sh);
    return g;
  }
  function chiliModel() {
    const g = new T.Group();
    const b = new T.Mesh(new T.CapsuleGeometry(0.3, 1.1, 6, 12), std('#d8322a', 0.3));
    b.rotation.x = Math.PI / 2;
    const cap = new T.Mesh(new T.ConeGeometry(0.22, 0.4, 10), std('#4f9a4a', 0.6));
    cap.rotation.x = Math.PI / 2; cap.position.z = 0.85;
    g.add(b, cap);
    return g;
  }
  function buildRace(W, H, o) {
    const { track, WU } = o;
    const segs = track.segs, N = segs.length;
    const HW = WU.ROAD / RACE_SCALE; // half the road's width
    const scene = new T.Scene();
    scene.background = canvasTex(16, 256, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#5fb4ee'); grad.addColorStop(0.55, '#bfe4fa'); grad.addColorStop(1, '#d6ecf6');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    });
    scene.fog = new T.Fog('#d6ecf6', 45, 150);
    lights(scene, 0xffffff, 0x6a8a5a, 2.2);
    // Lay out three laps of centreline: positions, headings and heights.
    const total = N * 3;
    const P = new Array(total + 1), Hd = new Array(total + 1), Y = new Array(total + 1);
    const fwd = (h) => new T.Vector3(Math.sin(h), 0, -Math.cos(h));
    P[N] = new T.Vector3(0, 0, 0); Hd[N] = 0;
    for (let j = N; j < total; j++) { Hd[j + 1] = Hd[j] + (segs[j % N].curve / RACE_SCALE) * TURN; P[j + 1] = P[j].clone().add(fwd(Hd[j])); }
    for (let j = N; j > 0; j--) { Hd[j - 1] = Hd[j] - (segs[(j - 1) % N].curve / RACE_SCALE) * TURN; P[j - 1] = P[j].clone().sub(fwd(Hd[j - 1])); }
    for (let j = 0; j <= total; j++) Y[j] = segs[j % N].p1.y / RACE_SCALE;
    const right = (h) => new T.Vector3(Math.cos(h), 0, Math.sin(h));
    // A strip running along the track between two sideways offsets, with its texture repeating every few segments.
    function ribbon(from, to, map, repeatV, rough = 0.9, lift = 0) {
      const pos = [], uv = [], idx = [];
      for (let j = 0; j <= total; j++) {
        const r = right(Hd[j]);
        for (const [k, side] of [[0, from], [1, to]]) {
          const p = P[j].clone().addScaledVector(r, side);
          pos.push(p.x, Y[j] + lift, p.z);
          uv.push(k, j / repeatV);
        }
        if (j < total) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new T.Mesh(geo, std(0xffffff, rough, { map, side: T.DoubleSide }));
      scene.add(mesh);
      return mesh;
    }
    const tx = raceTextures();
    ribbon(-HW, HW, tx.road, 6, 0.95, 0.02);
    ribbon(-HW * 1.12, -HW, tx.rumble, 6, 0.6, 0.03);
    ribbon(HW, HW * 1.12, tx.rumble, 6, 0.6, 0.03);
    ribbon(-HW * 6, -HW * 1.12, tx.grass, 6, 0.95, 0);
    ribbon(HW * 1.12, HW * 6, tx.grass, 6, 0.95, 0);
    const ground = new T.Mesh(new T.PlaneGeometry(4000, 4000), std('#62b04f', 1));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6;
    scene.add(ground);
    // Things placed along the track: (segment index on the 3-lap road, sideways offset in road widths).
    const placeAt = (obj, j, x, lift = 0) => {
      const i = Math.max(0, Math.min(total - 1, Math.floor(j))), f = j - i;
      const h = Hd[i] + (Hd[i + 1] - Hd[i]) * f;
      const p = P[i].clone().lerp(P[i + 1], f).addScaledVector(right(h), x * HW);
      obj.position.set(p.x, Y[i] + (Y[i + 1] - Y[i]) * f + lift, p.z);
      obj.rotation.y = -h;
      return h;
    };
    const models = sceneryModels();
    const props = [];
    for (let lap = 0; lap < 3; lap++) {
      for (const s of segs) {
        const j = s.i + lap * N;
        for (const sp of s.sprites) {
          const obj = models[sp.art].clone();
          placeAt(obj, j, sp.x);
          if (sp.art === 'carrots') obj.rotation.y += Math.PI / 2;
          if (sp.art === 'sunflower') obj.rotation.y += sp.x > 0 ? Math.PI / 2 : -Math.PI / 2;
          scene.add(obj);
          props.push({ obj, j });
        }
      }
      // Chequered start line.
      const line = new T.Mesh(new T.PlaneGeometry(HW * 2, 1.4), std(0xffffff, 0.8, { map: tx.checker }));
      line.rotation.x = -Math.PI / 2;
      const holder = new T.Group();
      holder.add(line);
      placeAt(holder, lap * N + 0.7, 0, 0.05);
      scene.add(holder);
    }
    const crates = [];
    const crateGeo = new T.BoxGeometry(1.3, 1.3, 1.3), crateMat = std(0xffffff, 0.4, { map: tx.crate, emissive: '#ffb020', emissiveIntensity: 0.25 });
    for (let lap = 0; lap < 3; lap++) for (const s of segs) for (const b of s.boxes) {
      const m = new T.Mesh(crateGeo, crateMat);
      scene.add(m);
      crates.push({ m, b, j: s.i + lap * N });
    }
    // Karts: her, the bots (veggies) or the friend.
    const karts = new Map();
    const riderFor = (k) => {
      if (k.me) { const f = Pet3D.figure(o.look); f.root.scale.setScalar(0.85); return { obj: f.root, pose: f.pose }; }
      if (k.remote) { const f = Pet3D.figure(o.rivalLook || 'default'); f.root.scale.setScalar(0.85); return { obj: f.root, pose: f.pose }; }
      const v = (VEGGIES[k.bot?.art] || VEGGIES.broccoli)(2.3);
      v.position.y = 0.75;
      return { obj: v, pose: null };
    };
    const shots = [], slicks = [];
    const chili = chiliModel();
    const slickGeo = new T.CircleGeometry(1.3, 24), slickMat = std('#3a2418', 0.15, { transparent: true, opacity: 0.85 });
    const flames = new T.Group();
    for (let i = 0; i < 3; i++) {
      const f = new T.Mesh(new T.ConeGeometry(0.25, 1.2, 10), std('#9be35a', 0.4, { emissive: '#7fdc3a', emissiveIntensity: 1.4 }));
      f.rotation.x = -Math.PI / 2; f.position.set(-0.5 + i * 0.5, 0.6, 1.9);
      flames.add(f);
    }
    const camera = new T.PerspectiveCamera(58, W / H, 0.1, 400);
    // The copy of a racer's spot that is nearest the player.
    const nearIndex = (z, pj) => {
      let j = z / RACE_SCALE + N;
      if (j - pj > N / 2) j -= N;
      if (pj - j > N / 2) j += N;
      return j;
    };
    return {
      scene, camera,
      update(g, time) {
        const me = g.me;
        const pj = me.z / RACE_SCALE + N;
        const lo = pj - 25, hi = pj + 170;
        for (const p of props) p.obj.visible = p.j > lo && p.j < hi;
        for (const c of crates) {
          c.m.visible = !c.b.gone && c.j > lo && c.j < hi;
          if (c.m.visible) { placeAt(c.m, c.j, c.b.x, 1.4 + Math.sin(time * 4 + c.j) * 0.25); c.m.rotation.y = time * 1.5; c.m.rotation.x = 0.3; }
        }
        for (const k of g.racers) {
          let kt = karts.get(k);
          if (!kt) {
            const rider = riderFor(k);
            kt = { obj: kart(rider.obj), pose: rider.pose };
            scene.add(kt.obj);
            karts.set(k, kt);
          }
          const j = k.me ? pj : nearIndex(k.z, pj);
          kt.obj.visible = j > lo && j < hi;
          placeAt(kt.obj, j, k.x, me.speed > 100 && k.me ? Math.abs(Math.sin(time * 22)) * 0.04 : 0);
          if (k.spin > 0) kt.obj.rotation.y += time * 18;
          kt.pose?.(k.spin > 0 ? 'sad' : k.boost > 0 ? 'happy' : 'idle');
        }
        // Boost flames behind her kart.
        const mine = karts.get(me)?.obj;
        if (mine) {
          if (flames.parent !== mine) mine.add(flames);
          flames.visible = me.boost > 0;
          flames.children.forEach((f, i) => { f.scale.y = 0.7 + Math.random() * 0.6; f.position.z = 1.9 + i * 0.01; });
        }
        g.shots.forEach((s, i) => {
          if (!shots[i]) { shots[i] = chili.clone(); scene.add(shots[i]); }
          shots[i].visible = true;
          placeAt(shots[i], nearIndex(s.z, pj), s.x, 1.6);
          shots[i].rotation.z = time * 12;
        });
        shots.forEach((m, i) => { if (i >= g.shots.length) m.visible = false; });
        g.slicks.forEach((s, i) => {
          if (!slicks[i]) { slicks[i] = new T.Mesh(slickGeo, slickMat); scene.add(slicks[i]); }
          const m = slicks[i];
          m.visible = true;
          placeAt(m, nearIndex(s.z, pj), s.x, 0.06);
          m.rotation.x = -Math.PI / 2;
        });
        slicks.forEach((m, i) => { if (i >= g.slicks.length) m.visible = false; });
        // Chase camera: behind and above her kart, looking down the road ahead.
        const back = new T.Object3D(), ahead = new T.Object3D();
        const h = placeAt(back, pj - 9, me.x, 5.2);
        placeAt(ahead, pj + 9, me.x * 0.9, 1.2);
        camera.position.copy(back.position);
        camera.lookAt(ahead.position);
        camera.rotation.z += 0; // keep the horizon level
        void h;
      },
    };
  }

  // ----- drawing a frame into a game's canvas -----
  const scenes = {};
  const keyOf = (kind, W, H, extra, extra2) => `${kind}|${W}|${H}|${extra || ''}|${extra2 || ''}`;
  function frame(kind, g, ctx, W, H, opts = {}) {
    const key = keyOf(kind, W, H, opts.look, opts.rivalLook);
    let s = scenes[kind];
    if (!s || s.key !== key) {
      s = kind === 'pong' ? buildPong(W, H) : kind === 'catch' ? buildCatch(W, H)
        : kind === 'rhythm' ? buildRhythm(W, H, opts.hitY) : kind === 'race' ? buildRace(W, H, opts)
          : buildParkour(W, H, opts.map, opts.tile, opts.look);
      s.key = key;
      scenes[kind] = s;
    }
    s.update(g, performance.now() / 1000, opts.spikesUp);
    const r = getRenderer();
    const scale = opts.scale || 2;
    const cw = Math.round(W * scale), ch = Math.round(H * scale);
    if (r.domElement.width !== cw || r.domElement.height !== ch) r.setSize(cw, ch, false);
    s.camera.aspect = W / H;
    s.camera.updateProjectionMatrix();
    r.render(s.scene, s.camera);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(r.domElement, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  // ----- Veggie Whack: a garden bed with nine holes, under the game's own buttons -----
  const whack = (() => {
    let st = null;
    function start(grid, read) {
      stop();
      const r = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
      r.outputColorSpace = T.SRGBColorSpace;
      r.toneMapping = T.ACESFilmicToneMapping;
      r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      const c = r.domElement;
      c.className = 'whack3d';
      grid.prepend(c);
      grid.classList.add('is3d');
      const scene = new T.Scene();
      lights(scene, 0xfff6e6, 0x4a6a3a, 2.2);
      const grass = canvasTex(256, 256, (g) => {
        g.fillStyle = '#5f9a45'; g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(40,90,30,.5)' : 'rgba(140,200,90,.35)'; g.fillRect(rnd() * 256, rnd() * 256, 2, 5); }
      }, [6, 6]);
      const ground = new T.Mesh(new T.PlaneGeometry(30, 30), std(0xffffff, 0.95, { map: grass }));
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      const soil = new T.Mesh(new T.BoxGeometry(1, 0.25, 1), std('#6b4a32', 0.95));
      soil.position.y = 0.06;
      scene.add(soil);
      const camera = new T.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 8, 7.4);
      camera.lookAt(0, 0, 0.2);
      const holes = [];
      for (let i = 0; i < 9; i++) {
        const g = new T.Group();
        const hole = new T.Mesh(new T.CircleGeometry(0.62, 32), new T.MeshBasicMaterial({ color: '#1e130c' }));
        hole.rotation.x = -Math.PI / 2; hole.position.y = 0.19;
        const rim = new T.Mesh(new T.TorusGeometry(0.66, 0.12, 10, 32), std('#7d5638', 0.95));
        rim.rotation.x = Math.PI / 2; rim.position.y = 0.2;
        g.add(hole, rim);
        scene.add(g);
        holes.push({ g, pop: null, kind: '', t: 0 });
      }
      st = { r, c, scene, camera, holes, read, grid, raf: 0, size: '' };
      const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), -0.19), hit = new T.Vector3();
      const step = () => {
        if (!st || !grid.offsetParent) return;
        const gr = grid.getBoundingClientRect();
        const size = `${Math.round(gr.width)}x${Math.round(gr.height)}`;
        if (size !== st.size) {
          st.size = size;
          r.setSize(gr.width, gr.height, false);
          camera.aspect = gr.width / gr.height;
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld();
          // Each hole goes exactly under its button.
          [...grid.querySelectorAll('.hole')].forEach((b, i) => {
            const br = b.getBoundingClientRect();
            const nx = ((br.left + br.width / 2 - gr.left) / gr.width) * 2 - 1;
            const ny = -(((br.top + br.height / 2 - gr.top) / gr.height) * 2 - 1);
            ray.setFromCamera(new T.Vector2(nx, ny), camera);
            if (ray.ray.intersectPlane(plane, hit) && holes[i]) holes[i].g.position.set(hit.x, 0, hit.z);
          });
          // The soil bed covers all the holes with a border.
          const xs = holes.map((h) => h.g.position.x), zs = holes.map((h) => h.g.position.z);
          const x0 = Math.min(...xs) - 1.1, x1 = Math.max(...xs) + 1.1, z0 = Math.min(...zs) - 1.1, z1 = Math.max(...zs) + 1.1;
          soil.scale.set(x1 - x0, 1, z1 - z0);
          soil.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2);
        }
        const now = performance.now() / 1000;
        const s = read();
        holes.forEach((h, i) => {
          const want = s && s.cell === i ? s.kind : '';
          if (want !== h.kind) {
            if (h.pop) { h.g.remove(h.pop); h.pop = null; }
            h.kind = want; h.t = now;
            if (want) {
              h.pop = want === 'bowl' ? bowl(0.55) : (VEGGIES[want] || VEGGIES.broccoli)(1.9);
              h.g.add(h.pop);
            }
          }
          if (h.pop) {
            const k = Math.min(1, (now - h.t) / 0.15);
            h.pop.position.y = -1.2 + k * 1.35 + Math.sin(now * 10) * 0.03;
            h.pop.rotation.y = Math.sin(now * 3 + i) * 0.3;
          }
        });
        r.render(scene, camera);
      };
      const loop = () => { if (!st) return; st.raf = requestAnimationFrame(loop); step(); };
      st.step = step;
      loop();
    }
    function stop() {
      if (!st) return;
      cancelAnimationFrame(st.raf);
      st.r.dispose();
      st.c.remove();
      st.grid.classList.remove('is3d');
      st = null;
    }
    // step() draws one frame now (used when checking the game).
    return { start, stop, step: () => st?.step() };
  })();

  return { frame, whack, boss };
})();
