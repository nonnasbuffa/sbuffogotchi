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

  // ----- drawing a frame into a game's canvas -----
  const scenes = {};
  const keyOf = (kind, W, H, extra) => `${kind}|${W}|${H}|${extra || ''}`;
  function frame(kind, g, ctx, W, H, opts = {}) {
    const key = keyOf(kind, W, H, opts.look);
    let s = scenes[kind];
    if (!s || s.key !== key) {
      s = kind === 'pong' ? buildPong(W, H) : kind === 'catch' ? buildCatch(W, H)
        : kind === 'rhythm' ? buildRhythm(W, H, opts.hitY) : buildParkour(W, H, opts.map, opts.tile, opts.look);
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

  return { frame, whack };
})();
