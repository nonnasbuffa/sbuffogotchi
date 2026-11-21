// The Sbuffling as a 3D chibi for the Modern look, proportioned like a little platformer mascot:
// a huge round head (about half her height), a small egg-shaped body, short thick limbs,
// big round hands and chunky shoes. Everything is built from smooth shapes in code (no model files).
// The Classic look keeps the pixel sprites.
window.Pet3D = (() => {
  if (!window.THREE) return null;
  const T = THREE;
  const HEAD_Y = 1.15; // the head sits right on her shoulders, no neck
  const W = 264, H = 324; // Render size: 6 pixels for every pixel of the 44×54 sprite box.

  // ----- looks: one entry per skin -----
  const LOOKS = {
    default: {
      skin: '#eebd96', blush: '#f08f8f', wrinkle: '#b97c5c', wrinkles: 'lots', hair: '#2a2433', hair2: '#3a3147', hairStyle: 'afro',
      top: '#1e6a55', topDark: '#174f40', topPattern: 'flowers', pants: '#2f2b45', shoes: '#74462f',
      glasses: '#f29cc0', brows: '#3a2a28', eyes: '#2a1c19', stubble: false, scar: false,
    },
    boxer: {
      skin: '#efc09b', blush: '#e99a86', wrinkle: '#c08a6c', wrinkles: 'some', hair: '#cdcdd6', hair2: '#b9b9c4', hairStyle: 'buzz',
      top: '#a2a2ad', topDark: '#85858f', topPattern: 'hoodie', pants: '#93939e', shoes: '#26232d',
      glasses: null, brows: '#8a8a94', eyes: '#1d191f', stubble: true, scar: true,
    },
    ziapuzza: {
      skin: '#f0c4a8', blush: '#ec8c8c', wrinkle: '#c08a6c', wrinkles: 'some', hair: '#cea970', hair2: '#e6cc96', hairStyle: 'wavy',
      top: '#36c4c4', topDark: '#1e8c92', topPattern: 'stars', pants: '#404868', shoes: '#ececf0',
      glasses: '#28283a', glassesShape: 'rect', lips: '#d98aa0', brows: '#8a6a44', eyes: '#3c4656', stubble: false, scar: false,
    },
  };

  const mat = (color, rough = 0.5, extra = {}) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
  function mesh(geo, m, x = 0, y = 0, z = 0) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); return o; }
  const ball = (r, seg = 24) => new T.SphereGeometry(r, seg, Math.round(seg * 0.75));
  const capsule = (r, len) => new T.CapsuleGeometry(r, len, 6, 14);

  // The jumper's pattern, wrapped round the body (the front is the middle of the picture).
  function topTex(L) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = L.top; g.fillRect(0, 0, 256, 128);
    if (L.topPattern === 'flowers') {
      const flower = (x, y, s) => {
        g.fillStyle = '#e8553f';
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.beginPath(); g.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.75, 0, 7); g.fill();
        }
        g.fillStyle = '#ffd36e'; g.beginPath(); g.arc(x, y, s * 0.6, 0, 7); g.fill();
      };
      for (const [x, y] of [[104, 72], [128, 56], [152, 72], [128, 90], [44, 66], [212, 66]]) flower(x, y, 4.5);
      g.fillStyle = L.topDark; g.fillRect(0, 112, 256, 16); // ribbed hem
    } else if (L.topPattern === 'stars') {
      // Little pink five-pointed stars scattered round the shirt.
      g.fillStyle = '#ff78b8';
      const star = (x, y, s) => {
        g.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
        g.closePath(); g.fill();
      };
      for (const [x, y] of [[110, 50], [146, 66], [124, 86], [92, 76], [160, 40], [40, 56], [70, 92], [200, 54], [226, 88], [16, 84]]) star(x, y, 7);
      g.fillStyle = L.topDark; g.fillRect(0, 112, 256, 16);
    } else {
      g.fillStyle = L.topDark; g.fillRect(126, 0, 4, 128); // zip
      g.fillStyle = '#f4f4f4'; g.fillRect(146, 46, 26, 5); g.fillRect(146, 56, 20, 5); // stripes
      g.fillStyle = L.topDark; g.fillRect(0, 110, 256, 18);
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  // A soft round shadow, dark in the middle and fading out.
  let dot = null;
  function softDot() {
    if (dot) return dot;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return (dot = new T.CanvasTexture(c));
  }

  // ----- the model -----
  function build(lookId) {
    const L = LOOKS[lookId] || LOOKS.default;
    const root = new T.Group();
    const skinMat = mat(L.skin, 0.55);

    const shadow = mesh(new T.CircleGeometry(0.5, 32), new T.MeshBasicMaterial({ map: softDot(), transparent: true, opacity: 0.45, depthWrite: false }), 0, 0.005, 0);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 0.6, 1);
    root.add(shadow);

    const body = new T.Group(); // everything that bounces
    root.add(body);

    // Short, sturdy legs and plain rounded shoes.
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new T.Group();
      leg.position.set(0.17 * side, 0.2, 0);
      leg.add(mesh(capsule(0.12, 0.05), mat(L.pants, 0.7), 0, -0.03, 0));
      const shoe = mesh(ball(0.12), mat(L.shoes, 0.45), 0, -0.11, 0.045);
      shoe.scale.set(1, 0.7, 1.45);
      leg.add(shoe);
      const sole = mesh(new T.CylinderGeometry(0.12, 0.12, 0.03, 24), mat('#3b2a24', 0.8), 0, -0.185, 0.045);
      sole.scale.set(1, 1, 1.45);
      leg.add(sole);
      body.add(leg); legs.push(leg);
    }

    // A short, chubby body: rounded shoulders, a full bust and belly pushed forward, broad hips,
    // and wider than it is deep, like a real person rather than a ball.
    const torsoGroup = new T.Group();
    body.add(torsoGroup);
    const profile = [[0, 0.1], [0.3, 0.11], [0.42, 0.17], [0.46, 0.26], [0.46, 0.36], [0.43, 0.46], [0.39, 0.54], [0.36, 0.6], [0.3, 0.65], [0.18, 0.69], [0, 0.7]]
      .map(([x, y]) => new T.Vector2(x, y));
    const torsoGeo = new T.LatheGeometry(profile, 48);
    {
      const pos = torsoGeo.attributes.position, v = new T.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const rr = Math.hypot(v.x, v.z);
        if (rr < 1e-4) continue;
        const front = Math.max(0, v.z / rr);
        const belly = Math.exp(-((v.y - 0.29) ** 2) / (2 * 0.1 ** 2)) * front ** 1.5 * 0.08;
        const bust = Math.exp(-((v.y - 0.5) ** 2) / (2 * 0.06 ** 2)) * front ** 2 * 0.05;
        const k = (rr + belly + bust) / rr;
        v.x *= k; v.z *= k;
        v.z *= v.z < 0 ? 0.78 : 0.9; // a flatter back
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      torsoGeo.computeVertexNormals();
    }
    const tex = topTex(L);
    tex.wrapS = T.RepeatWrapping;
    tex.offset.x = 0.5; // the middle of the pattern faces forward, the seam is at the back
    const torso = new T.Mesh(torsoGeo, mat(0xffffff, 0.75, { map: tex }));
    torsoGroup.add(torso);
    const collar = mesh(new T.TorusGeometry(0.19, 0.045, 12, 28), mat(L.topDark, 0.8), 0, 0.68, 0);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1, 0.85, 1);
    torsoGroup.add(collar);

    // Arms hang down to the hips, a little away from the body because of the tummy.
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new T.Group();
      arm.position.set(0.37 * side, 0.6, 0);
      arm.add(mesh(capsule(0.085, 0.2), mat(L.top, 0.75), 0, -0.14, 0));
      const cuff = mesh(new T.TorusGeometry(0.08, 0.022, 10, 20), mat(L.topDark, 0.8), 0, -0.26, 0);
      cuff.rotation.x = Math.PI / 2;
      arm.add(cuff);
      arm.add(mesh(ball(0.085), skinMat, 0, -0.34, 0.01));
      body.add(arm); arms.push(arm);
    }

    // The head: big and round, slightly wider than tall.
    const head = new T.Group();
    head.position.set(0, HEAD_Y, 0);
    body.add(head);
    const R = 0.5;
    // How far the skin swells out in each direction: fuller jowls, and a double chin that is part of
    // the same skin, with a soft fold where it meets the chin.
    const bulge = (v) => {
      const th = Math.acos(Math.max(-1, Math.min(1, v.y))); // 0 at the top, π at the bottom
      const front = Math.sqrt(Math.max(0, v.z));
      const wide = (s) => Math.exp(-(v.x * v.x) / (2 * s * s));
      const jowls = Math.exp(-((th - 2.2) ** 2) / (2 * 0.3 ** 2)) * Math.max(0, v.z + 0.3) * 0.04;
      const pouch = Math.exp(-((th - 2.47) ** 2) / (2 * 0.17 ** 2)) * wide(0.42) * front * 0.17;
      const fold = Math.exp(-((th - 2.27) ** 2) / (2 * 0.045 ** 2)) * wide(0.36) * front * 0.035;
      return jowls + pouch - fold;
    };
    const skullGeo = new T.SphereGeometry(R, 72, 54);
    {
      const pos = skullGeo.attributes.position, v = new T.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        v.multiplyScalar(R * (1 + bulge(v)));
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      skullGeo.computeVertexNormals();
    }
    const skull = mesh(skullGeo, skinMat);
    head.add(skull);
    // z of the face surface at (x, y), following the swell of the cheeks and chin.
    const onFace = (x, y) => {
      let z = Math.sqrt(Math.max(0, R * R - x * x - y * y));
      for (let k = 0; k < 4; k++) {
        const rad = R * (1 + bulge(new T.Vector3(x, y, z).normalize()));
        z = Math.sqrt(Math.max(0, rad * rad - x * x - y * y));
      }
      return z - 0.004;
    };

    // Eyes: big glossy ovals with a shine; happy eyes are little arches.
    const eyes = [], happyEyes = [], brows = [];
    const eyeMat = mat(L.eyes, 0.15);
    for (const side of [-1, 1]) {
      const x = 0.18 * side, y = -0.02;
      const eye = new T.Group();
      eye.position.set(x, y, onFace(x, y) - 0.01);
      eye.rotation.y = Math.asin(x / R);
      const pupil = mesh(ball(0.085), eyeMat);
      pupil.scale.set(0.8, 1.15, 0.45);
      eye.add(pupil);
      eye.add(mesh(ball(0.026, 12), mat('#ffffff', 0.2, { emissive: '#ffffff', emissiveIntensity: 0.6 }), 0.025, 0.04, 0.035));
      eye.add(mesh(ball(0.012, 10), mat('#ffffff', 0.2, { emissive: '#ffffff', emissiveIntensity: 0.6 }), -0.022, -0.035, 0.035));
      head.add(eye); eyes.push(eye);
      const arch = mesh(new T.TorusGeometry(0.06, 0.016, 8, 20, Math.PI), eyeMat, x, y - 0.02, onFace(x, y) + 0.01);
      arch.rotation.y = Math.asin(x / R);
      arch.visible = false;
      head.add(arch); happyEyes.push(arch);
      // Eyebrows sit above the glasses.
      const brow = mesh(capsule(0.018, 0.09), mat(L.brows, 0.7), x, 0.19, onFace(x, 0.19) + 0.005);
      brow.rotation.set(0, Math.asin(x / R), Math.PI / 2);
      head.add(brow); brows.push(brow);
      // Rosy cheeks.
      const cx = 0.31 * side, cy = -0.14;
      const cheek = mesh(new T.CircleGeometry(0.06, 20), new T.MeshBasicMaterial({ color: L.blush, transparent: true, opacity: 0.45, depthWrite: false }), cx, cy, onFace(cx, cy) + 0.008);
      cheek.rotation.y = Math.asin(cx / R) * 1.1;
      cheek.scale.set(1.3, 0.8, 1);
      head.add(cheek);
    }
    if (L.glasses) {
      const gm = mat(L.glasses, 0.3);
      for (const side of [-1, 1]) {
        const x = 0.18 * side, y = -0.02;
        // Round frames, or rectangular ones (a four-sided ring turned square, then widened).
        const rect = L.glassesShape === 'rect';
        const ring = new T.Group();
        ring.position.set(x, y, onFace(x, y) + 0.04);
        ring.rotation.y = Math.asin(x / R);
        const hoop = mesh(new T.TorusGeometry(rect ? 0.16 : 0.13, 0.022, 10, rect ? 4 : 32), gm);
        if (rect) { hoop.rotation.z = Math.PI / 4; const sq = new T.Group(); sq.scale.set(1.12, 0.78, 1); sq.add(hoop); ring.add(sq); } else ring.add(hoop);
        head.add(ring);
        const lens = mesh(new T.CircleGeometry(0.125, 28), new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false }), x, y, onFace(x, y) + 0.04);
        lens.rotation.y = Math.asin(x / R);
        head.add(lens);
      }
      const bridge = mesh(capsule(0.016, 0.05), gm, 0, 0.0, onFace(0, 0) + 0.035);
      bridge.rotation.z = Math.PI / 2;
      head.add(bridge);
    }
    // Wrinkles: thin creases that follow the curve of the face.
    if (L.wrinkles) {
      const wm = mat(L.wrinkle, 0.8);
      const tilt = (o, x, y) => { o.rotation.x = -Math.asin(y / R); o.rotation.y = Math.asin(x / R); };
      // A crease is a thin arc; 'mid' is the direction its middle bulges (π/2 = up).
      const crease = (x, y, radius, arc, mid, thick = 0.007) => {
        const g = new T.Group();
        g.position.set(x, y, onFace(x, y) + 0.004);
        tilt(g, x, y);
        const a = mesh(new T.TorusGeometry(radius, thick, 6, 24, arc), wm);
        a.rotation.z = mid - arc / 2;
        a.position.set(-Math.cos(mid) * radius, -Math.sin(mid) * radius, 0); // so the arc's middle sits on (x, y)
        g.add(a);
        head.add(g);
      };
      const lots = L.wrinkles === 'lots';
      // Forehead lines, gently curved (three on her, one on Babbo).
      crease(0, 0.27, 0.32, 0.6, Math.PI / 2, 0.009);
      if (lots) { crease(0, 0.31, 0.3, 0.5, Math.PI / 2, 0.009); crease(0, 0.35, 0.28, 0.4, Math.PI / 2, 0.008); }
      // A frown line between the eyebrows.
      if (lots) for (const side of [-1, 1]) {
        const x = 0.025 * side, y = 0.17;
        const l = mesh(capsule(0.007, 0.04), wm, x, y, onFace(x, y) + 0.004);
        tilt(l, x, y); l.rotation.z = side * 0.15;
        head.add(l);
      }
      if (lots) {
        const line = (x, y, len, angle, thick = 0.008) => {
          const l = mesh(capsule(thick, len), wm, x, y, onFace(x, y) + 0.004);
          tilt(l, x, y); l.rotation.z = angle;
          head.add(l);
        };
        for (const side of [-1, 1]) {
          // Crow's feet fanning out from the corners of the eyes.
          for (const k of [-1.5, -0.5, 0.5, 1.5]) line(0.35 * side, -0.02 + k * 0.035, 0.05, Math.PI / 2 - side * k * 0.35);
          // Bags under the eyes, just below the glasses.
          crease(0.18 * side, -0.17, 0.09, 1.2, -Math.PI / 2, 0.008);
          crease(0.18 * side, -0.195, 0.08, 0.9, -Math.PI / 2, 0.007);
          // Creases running down the cheeks, like on her sprite.
          for (const [dx, dy, len] of [[0.27, -0.22, 0.08], [0.32, -0.2, 0.09], [0.37, -0.17, 0.08], [0.23, -0.27, 0.06]]) {
            line(dx * side, dy, len, side * 0.12);
          }
          // Lines from the corners of the mouth down to the chin.
          line(0.09 * side, -0.29, 0.06, side * 0.25);
        }
        // Smile lines from beside the nose round to the corners of the mouth: ( )
        crease(-0.13, -0.17, 0.085, 1.4, Math.PI, 0.009);
        crease(0.13, -0.17, 0.085, 1.4, 0, 0.009);
        // Creases under the lip and on the chin.
        crease(0, -0.28, 0.07, 0.9, -Math.PI / 2, 0.008);
        crease(0, -0.33, 0.09, 0.8, -Math.PI / 2, 0.008);
        // Soft lines across the double chin, following its curve.
        crease(0, -0.37, 0.17, 1.0, -Math.PI / 2, 0.008);
        crease(0, -0.405, 0.15, 0.95, -Math.PI / 2, 0.008);
        crease(0, -0.44, 0.13, 0.85, -Math.PI / 2, 0.007);
        for (const side of [-1, 1]) line(0.17 * side, -0.39, 0.05, side * 0.6, 0.007);
      }
    }
    // A small round nose.
    head.add(mesh(ball(0.04, 16), mat(L.skin, 0.5), 0, -0.1, onFace(0, -0.1) + 0.02));
    // Mouths, one per mood; only one shows at a time.
    const mouthMat = mat(L.lips || '#7b2f2b', 0.5);
    const mouthAt = (m, y) => { m.position.set(0, y, onFace(0, y) + 0.005); return m; };
    const mouths = {
      idle: mouthAt(mesh(new T.TorusGeometry(0.055, 0.013, 8, 20, Math.PI), mouthMat), -0.2),
      happy: mouthAt(mesh(new T.CircleGeometry(0.075, 24, Math.PI, Math.PI), mouthMat), -0.18),
      sad: mouthAt(mesh(new T.TorusGeometry(0.05, 0.013, 8, 20, Math.PI), mouthMat), -0.24),
      battle: mouthAt(mesh(capsule(0.014, 0.09), mouthMat), -0.21),
    };
    mouths.idle.rotation.z = Math.PI; // ∪, a small smile
    mouths.battle.rotation.z = Math.PI / 2;
    for (const m of Object.values(mouths)) { m.visible = false; head.add(m); }
    if (L.stubble) {
      const stubble = mesh(new T.SphereGeometry(R * 1.005, 32, 16, Math.PI / 2 - 0.75, 1.5, 1.85, 0.75),
        new T.MeshStandardMaterial({ color: '#8f7a6e', transparent: true, opacity: 0.35, roughness: 1, depthWrite: false }));
      
      head.add(stubble);
    }
    if (L.scar) {
      const scar = mesh(capsule(0.01, 0.07), mat('#a5574a', 0.6), 0.27, -0.2, onFace(0.27, -0.2) + 0.01);
      scar.rotation.set(0, Math.asin(0.27 / R), 0.7);
      head.add(scar);
    }

    // Hair
    if (L.hairStyle === 'afro') {
      // A big soft cloud of curls round the top, sides and back; one side is mirrored so it's even.
      const m1 = mat(L.hair, 0.42), m2 = mat(L.hair2, 0.5);
      let seed = 11;
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      // Curls spread evenly over a ball around the head, so her outline stays perfectly round.
      const C = new T.Vector3(0, 0.07, -0.05), HR = 0.56;
      head.add(mesh(ball(HR - 0.1, 32), m1, C.x, C.y + 0.02, C.z - 0.08)); // fills the gaps between curls, behind the face
      const N = 64;
      for (let i = 0; i < N; i++) {
        const y = 1 - (2 * (i + 0.5)) / N;
        const rr = Math.sqrt(1 - y * y), a = i * 2.39996;
        const d = new T.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
        const p = d.clone().multiplyScalar(HR + rnd() * 0.07).add(C); // some curls sit further out: a puffy outline
        if (p.z > 0.12 && p.y < 0.45) continue; // keep the face and forehead clear
        if (p.y < -0.32) continue; // stops above the jaw
        const curl = mesh(ball(0.17 + rnd() * 0.06, 20), rnd() < 0.5 ? m1 : m2, p.x, p.y, p.z);
        head.add(curl);
      }
    } else if (L.hairStyle === 'wavy') {
      // Short wavy hair: a cap with soft waves on top, swept over to one side and short at the back.
      const m1 = mat(L.hair, 0.55), m2 = mat(L.hair2, 0.5);
      head.add(mesh(new T.SphereGeometry(R * 1.04, 40, 20, 0, Math.PI * 2, 0, 1.25), m1));
      // Back and sides come down further, so it's a full short cut rather than a cap.
      const back = mesh(new T.SphereGeometry(R * 1.05, 40, 20, Math.PI / 2 + 1.15, Math.PI * 2 - 2.3, 0, 1.95), m1);
      head.add(back);
      for (const side of [-1, 1]) for (const [y, z, rr] of [[0.2, 0.0, 0.15], [0.05, -0.08, 0.14], [0.22, -0.2, 0.15]]) head.add(mesh(ball(rr, 18), m1, 0.4 * side, y, z));
      // A wavy fringe swept across the forehead to her left.
      for (const [x, y, z, rr] of [[-0.2, 0.36, 0.22, 0.11], [-0.04, 0.34, 0.3, 0.12], [0.13, 0.31, 0.31, 0.12], [0.28, 0.25, 0.27, 0.12], [0.37, 0.12, 0.2, 0.11]]) head.add(mesh(ball(rr, 18), m2, x, y, z));
      const waves = [[-0.3, 0.33, 0.08, 0.13], [-0.12, 0.43, 0.12, 0.14], [0.08, 0.44, 0.13, 0.15], [0.26, 0.36, 0.14, 0.15],
        [0.38, 0.2, 0.1, 0.14], [0.42, 0.02, 0.0, 0.12], [0.2, 0.3, 0.24, 0.12], [0.04, 0.33, 0.27, 0.1],
        [-0.2, 0.36, -0.12, 0.15], [0.1, 0.38, -0.2, 0.16], [-0.38, 0.15, -0.05, 0.12], [0.35, 0.18, -0.15, 0.14]];
      waves.forEach(([x, y, z, rr], i) => head.add(mesh(ball(rr, 18), i % 3 ? m1 : m2, x, y, z)));
      for (const side of [-1, 1]) head.add(mesh(ball(0.09, 16), skinMat, R * 1.04 * side, -0.04, 0)); // ears
    } else {
      const hm = mat(L.hair, 0.9);
      const cap = mesh(new T.SphereGeometry(R * 1.035, 40, 20, 0, Math.PI * 2, 0, 1.2), hm);
      
      head.add(cap);
      for (let i = 0; i < 9; i++) {
        const x = -0.28 + i * 0.07;
        const spike = mesh(new T.ConeGeometry(0.05, 0.13, 10), hm, x, Math.sqrt(R * R - x * x) * 1.02 + 0.03, 0.04 * ((i % 2) * 2 - 1));
        spike.rotation.z = -x * 1.1;
        head.add(spike);
      }
      for (const side of [-1, 1]) head.add(mesh(ball(0.09, 16), skinMat, R * 1.04 * side, -0.04, 0)); // ears
    }
    return { root, body, head, arms, legs, eyes, happyEyes, brows, mouths, torsoGroup, look: L, lookId };
  }

  // Her camera. The room behind her uses the same one, widened to the whole stage, so the floors line up.
  function petCamera(aspect) {
    const camera = new T.PerspectiveCamera(22, aspect, 0.1, 40);
    camera.position.set(0, 1.75, 8.4);
    camera.lookAt(0, 1.42, 0); // the floor lands at the bottom of the box, where the sprite stands
    return camera;
  }

  // ----- views: one canvas per sprite box in the page -----
  const views = new Map();
  function makeView(el) {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    const c = renderer.domElement;
    c.className = 'pet3d';
    el.append(c);
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xfff4e8, 0x5a4a6a, 1.5));
    const key = new T.DirectionalLight(0xffffff, 2.0);
    key.position.set(1.8, 3, 4);
    scene.add(key);
    const rim = new T.DirectionalLight(0xc9d8ff, 1.4); // a cool light from behind outlines her
    rim.position.set(-2.5, 2, -3);
    scene.add(rim);
    const camera = petCamera(W / H);
    return { el, renderer, scene, camera, model: null, anim: 'idle', after: null, started: 0, ends: 0, blinkAt: 0 };
  }
  function setModel(v, lookId) {
    if (v.model?.lookId === lookId) return;
    if (v.model) v.scene.remove(v.model.root);
    v.model = build(lookId);
    v.scene.add(v.model.root);
  }

  // ----- animation, worked out from the clock every frame -----
  function pose(v, now) {
    const m = v.model;
    if (v.after && now >= v.ends) { v.anim = v.after; v.after = null; v.started = now; }
    const t = (now - v.started) / 1000;
    const { root, body, head, arms, legs, torsoGroup } = m;
    root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);
    body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1);
    head.position.y = HEAD_Y; head.rotation.set(0, 0, 0);
    torsoGroup.scale.set(1, 1, 1);
    arms.forEach((a, i) => a.rotation.set(0, 0, 0.3 * (i ? 1 : -1)));
    legs.forEach((l) => l.rotation.set(0, 0, 0));
    let browTilt = 0, browY = 0, eyesHalf = false, mouthFace = null;
    const mood = v.anim;
    if (mood === 'idle') {
      // A gentle springy breath: the body squashes a little and the head follows a beat later.
      const s = Math.sin(t * 2.4);
      torsoGroup.scale.set(1 + s * 0.015, 1 - s * 0.02, 1 + s * 0.015);
      head.position.y = HEAD_Y - s * 0.015 + Math.sin(t * 2.4 - 0.6) * 0.01;
      head.rotation.z = Math.sin(t * 1.1) * 0.06;
      head.rotation.x = Math.sin(t * 0.8) * 0.04;
      root.rotation.y = Math.sin(t * 0.45) * 0.28;
      arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 2.4 + i * 1.5) * 0.1; });
    } else if (mood === 'happy') {
      // Bouncy hops with arms thrown up, squashing on landing.
      const ph = (t * 2.6) % 1;
      const air = Math.sin(ph * Math.PI);
      root.position.y = air * 0.35;
      const land = ph < 0.12 || ph > 0.88;
      body.scale.set(land ? 1.06 : 0.97, land ? 0.9 : 1.04, land ? 1.06 : 0.97);
      root.rotation.y = Math.sin(t * 3) * 0.4;
      arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.z = s * (2.3 + Math.sin(t * 14 + i * 2) * 0.3); });
      legs.forEach((l, i) => { l.rotation.x = air * 0.35 * (i ? 1 : -1); });
      head.rotation.z = Math.sin(t * 6) * 0.1;
      browY = 0.02;
    } else if (mood === 'sad') {
      head.rotation.x = 0.28 + Math.sin(t * 0.9) * 0.03;
      head.position.y = HEAD_Y - 0.04;
      head.rotation.z = Math.sin(t * 0.6) * 0.05;
      root.rotation.y = Math.sin(t * 0.35) * 0.12;
      arms.forEach((a, i) => { a.rotation.z = 0.08 * (i ? 1 : -1); a.rotation.x = 0.15; });
      torsoGroup.scale.set(1.02, 0.97, 1.02);
      browTilt = -0.35;
    } else if (mood === 'sigh') {
      // Sbuffare: a big breath in (shoulders up, chest out), then a long puff out as she sags, eyes half shut.
      const ph = (t % 2) / 2;
      const inhale = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI / 2) : Math.cos(((ph - 0.35) / 0.65) * Math.PI / 2);
      torsoGroup.scale.set(1 + inhale * 0.05, 1 + inhale * 0.04 - (1 - inhale) * 0.02, 1 + inhale * 0.05);
      head.position.y = HEAD_Y + inhale * 0.05 - (1 - inhale) * 0.03;
      head.rotation.x = -inhale * 0.15 + (1 - inhale) * 0.12;
      arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.3 + inhale * 0.15); });
      root.rotation.y = Math.sin(t * 0.5) * 0.1;
      browTilt = -0.15; eyesHalf = true;
    } else if (mood === 'cold') {
      // Brr: hugging herself and shivering, teeth chattering.
      root.rotation.z = Math.sin(t * 55) * 0.025;
      root.position.x = Math.sin(t * 47) * 0.015;
      torsoGroup.scale.set(0.97, 0.98, 0.97);
      head.position.y = HEAD_Y - 0.05;
      arms.forEach((a, i) => { a.rotation.x = -0.9; a.rotation.z = (i ? -1 : 1) * 0.55; });
      legs.forEach((l, i) => { l.rotation.z = (i ? 1 : -1) * 0.08; });
      browTilt = -0.25; mouthFace = (t * 12) % 1 < 0.5 ? 'battle' : 'sad';
    } else if (mood === 'hot') {
      // Sweating: head tipped back, fanning herself with one hand, swaying in the heat.
      head.rotation.x = -0.18;
      head.rotation.z = Math.sin(t * 1.4) * 0.08;
      root.rotation.z = Math.sin(t * 1.4) * 0.04;
      arms[1].rotation.z = 2.2 + Math.sin(t * 16) * 0.35;
      arms[1].rotation.x = -0.5;
      arms[0].rotation.z = -0.25;
      browTilt = -0.2; eyesHalf = true; mouthFace = 'happy';
    } else if (mood === 'walk') {
      // A waddling walk: legs and arms swing, the body rocks side to side.
      const w = t * 9;
      legs.forEach((l, i) => { l.rotation.x = Math.sin(w + i * Math.PI) * 0.55; });
      arms.forEach((a, i) => { a.rotation.x = Math.sin(w + i * Math.PI + Math.PI) * 0.5; });
      body.position.y = Math.abs(Math.sin(w)) * 0.04;
      body.rotation.z = Math.sin(w) * 0.06;
    } else if (mood === 'battle') {
      // Guard up, bouncing on her toes, jabbing now and then.
      root.rotation.y = -0.3;
      const b = Math.abs(Math.sin(t * 6));
      root.position.y = b * 0.06;
      body.scale.set(1 + (1 - b) * 0.03, 1 - (1 - b) * 0.04, 1 + (1 - b) * 0.03);
      head.rotation.x = 0.1;
      const jab = (t % 1.1) < 0.2;
      arms.forEach((a, i) => {
        const punching = jab && i === Math.floor(t / 1.1) % 2;
        a.rotation.x = punching ? -1.75 : -1.25;
        a.rotation.z = (i ? 1 : -1) * (punching ? 0.0 : -0.45);
      });
      legs.forEach((l, i) => { l.rotation.x = i ? 0.25 : -0.25; });
      browTilt = 0.35;
    }
    // Face: brows, the right mouth, eyes, and a blink now and then.
    m.brows.forEach((br, i) => { const s = i ? 1 : -1; br.rotation.z = Math.PI / 2 + browTilt * s; br.position.y = 0.19 + browY; });
    const face = mouthFace || (m.mouths[mood] ? mood : 'idle');
    for (const [k, mo] of Object.entries(m.mouths)) mo.visible = k === face;
    if (now > v.blinkAt + 130) v.blinkAt = now + 2200 + Math.random() * 2600;
    const blink = now >= v.blinkAt && now < v.blinkAt + 130;
    m.eyes.forEach((e) => { e.visible = mood !== 'happy'; e.scale.y = blink ? 0.12 : eyesHalf ? 0.45 : 1; });
    m.happyEyes.forEach((e) => { e.visible = mood === 'happy'; });
  }

  let running = false;
  function loop() {
    const now = performance.now();
    for (const v of views.values()) {
      if (!v.el.isConnected || !v.el.offsetParent) continue; // not on screen
      pose(v, now);
      v.renderer.render(v.scene, v.camera);
    }
    for (const [stage, v] of rooms) if (stage.isConnected && stage.offsetParent) drawRoom(stage, v);
    running = views.size > 0 || rooms.size > 0;
    if (running) requestAnimationFrame(loop);
  }

  // Same calls as the sprite player: an animation, and what to go back to afterwards.
  function play(el, name, thenIdle, lookId, durationMs) {
    let v = views.get(el);
    if (!v) { v = makeView(el); views.set(el, v); }
    el.classList.add('is3d');
    setModel(v, lookId);
    v.anim = name;
    v.started = performance.now();
    v.after = thenIdle || null;
    // Short sprite animations feel too quick in 3D: a one-shot lasts at least a second and a half.
    v.ends = v.started + Math.max(1500, durationMs || 0);
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  // ----- her room, as a real 3D scene behind her (home screen, Modern look) -----
  function tex(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  let seedR = 5;
  const rr = () => ((seedR = (seedR * 9301 + 49297) % 233280) / 233280);
  // Oak planks with grain, slightly different shades, and thin gaps between them.
  const woodTex = (repeat) => tex(512, 512, (g, w, h) => {
    const rowH = 64;
    for (let y = 0; y < h; y += rowH) {
      let x = -Math.floor(rr() * 300);
      while (x < w) {
        const len = 260 + rr() * 220;
        g.fillStyle = ['#b9824f', '#a9723f', '#c38e58', '#ad7745', '#b67d49'][Math.floor(rr() * 5)];
        g.fillRect(x, y, len, rowH);
        for (let k = 0; k < 14; k++) { // grain
          g.strokeStyle = `rgba(70,40,20,${0.08 + rr() * 0.12})`;
          g.lineWidth = 1 + rr() * 1.5;
          g.beginPath();
          const gy = y + 4 + rr() * (rowH - 8), amp = 1 + rr() * 3, ph = rr() * 6;
          for (let gx = x; gx <= x + len; gx += 8) g.lineTo(gx, gy + Math.sin(gx / 40 + ph) * amp);
          g.stroke();
        }
        g.fillStyle = 'rgba(50,28,14,.55)'; g.fillRect(x + len - 2, y, 2, rowH); // end joint
        x += len;
      }
      g.fillStyle = 'rgba(50,28,14,.6)'; g.fillRect(0, y, w, 2); // gap between rows
    }
  }, repeat);
  // Cream wallpaper with soft vertical stripes, like her pixel room.
  const wallTex = (repeat) => tex(256, 256, (g, w, h) => {
    g.fillStyle = '#f1e7d3'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = '#e7d8bd'; g.fillRect(x + 20, 0, 22, h); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(120,90,60,${rr() * 0.05})`; g.fillRect(rr() * w, rr() * h, 1, 1); }
  }, repeat);
  const skyTex = () => tex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#6fb3ea'); grad.addColorStop(1, '#cfe9fb');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.95)';
    for (const [cx, cy, sc] of [[90, 120, 1], [190, 70, 0.7]]) {
      for (const [dx, dy, rad] of [[0, 0, 26], [24, -10, 22], [-24, 4, 18], [46, 6, 16], [-44, 10, 13]]) {
        g.beginPath(); g.arc(cx + dx * sc, cy + dy * sc, rad * sc, 0, 7); g.fill();
      }
    }
  });
  // The poke bowl painting.
  const paintingTex = () => tex(256, 200, (g, w, h) => {
    g.fillStyle = '#f4ecdc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(128, 104, 78, 34, 0, Math.PI, 0); g.fill();
    for (let i = 0; i < 18; i++) {
      g.fillStyle = ['#e8553f', '#5fae4f', '#f2a23a'][i % 3];
      g.beginPath(); g.arc(70 + rr() * 116, 84 + rr() * 18, 5, 0, 7); g.fill();
    }
    g.fillStyle = '#3d6fc4'; g.beginPath(); g.moveTo(44, 104); g.lineTo(212, 104); g.quadraticCurveTo(200, 170, 128, 172); g.quadraticCurveTo(56, 170, 44, 104); g.fill();
    g.fillStyle = '#2f5aa3'; g.fillRect(44, 104, 168, 6);
  });
  // A soft pink oval rug with a border.
  const rugTex = () => tex(256, 256, (g, w, h) => {
    const ring = (rad, color) => { g.fillStyle = color; g.beginPath(); g.arc(128, 128, rad, 0, 7); g.fill(); };
    ring(128, '#c94f6d'); ring(116, '#e3889c'); ring(100, '#d26680'); ring(70, '#e797a8'); ring(40, '#d26680');
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${rr() * 0.06})`; g.fillRect(rr() * w, rr() * h, 1, 1); }
  });

  function buildRoom() {
    const scene = new T.Scene();
    scene.background = new T.Color('#e9dcc4');
    const std = (color, rough = 0.7, extra = {}) => new T.MeshStandardMaterial({ color, roughness: rough, ...extra });
    const add = (geo, m, x, y, z, shadow = true) => {
      const o = new T.Mesh(geo, m); o.position.set(x, y, z);
      o.castShadow = shadow; o.receiveShadow = true; scene.add(o); return o;
    };
    const WALL_Z = -2.1;
    // Floor and back wall
    const floor = add(new T.PlaneGeometry(14, 10), std(0xffffff, 0.55, { map: woodTex([7, 5]) }), 0, 0, 2.9, false);
    floor.rotation.x = -Math.PI / 2;
    add(new T.PlaneGeometry(14, 6), std(0xffffff, 0.9, { map: wallTex([9, 4]) }), 0, 3, WALL_Z, false);
    add(new T.BoxGeometry(14, 0.16, 0.05), std('#f6f1e7', 0.5), 0, 0.08, WALL_Z + 0.025); // skirting board
    // Window, top left, with sky outside and a deep sill
    const frame = std('#7a4a2b', 0.5);
    const WX = -1.55, WY = 1.95, WW = 1.05, WH = 1.15;
    add(new T.PlaneGeometry(WW, WH), new T.MeshBasicMaterial({ map: skyTex() }), WX, WY, WALL_Z + 0.005, false);
    for (const [w, h, x, y] of [[WW + 0.12, 0.08, 0, WH / 2], [WW + 0.12, 0.08, 0, -WH / 2], [0.08, WH, -WW / 2, 0], [0.08, WH, WW / 2, 0], [0.05, WH, 0, 0], [WW, 0.05, 0, 0.1]]) {
      add(new T.BoxGeometry(w, h, 0.08), frame, WX + x, WY + y, WALL_Z + 0.04);
    }
    add(new T.BoxGeometry(WW + 0.3, 0.06, 0.24), frame, WX, WY - WH / 2 - 0.07, WALL_Z + 0.12);
    // Plant in a terracotta pot, bottom left
    const PX = -1.85, PZ = -1.25;
    add(new T.CylinderGeometry(0.22, 0.17, 0.38, 28), std('#c4663f', 0.8), PX, 0.19, PZ);
    add(new T.CylinderGeometry(0.235, 0.235, 0.06, 28), std('#b65a36', 0.8), PX, 0.37, PZ);
    add(new T.CylinderGeometry(0.2, 0.2, 0.02, 20), std('#4a3424', 1), PX, 0.39, PZ);
    const leaf = std('#4f9a4a', 0.6), leaf2 = std('#3f8240', 0.6);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39996, up = 0.45 + (i / 16) * 0.75, spread = 0.14 * (1.2 - i / 16);
      const l = add(new T.SphereGeometry(0.1, 14, 10), i % 2 ? leaf : leaf2, PX + Math.cos(a) * spread, up, PZ + Math.sin(a) * spread);
      l.scale.set(0.9, 2.2, 0.5);
      l.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
    }
    // Painting with the poke bowl, top right, and a shelf under it
    const FX = 1.5, FY = 2.05;
    add(new T.BoxGeometry(0.86, 0.7, 0.06), std('#6e4227', 0.5), FX, FY, WALL_Z + 0.03);
    add(new T.PlaneGeometry(0.72, 0.56), std(0xffffff, 0.8, { map: paintingTex() }), FX, FY, WALL_Z + 0.065, false);
    add(new T.BoxGeometry(0.95, 0.045, 0.24), std('#7a4a2b', 0.5), FX, 1.45, WALL_Z + 0.12);
    const gold = std('#e3b33b', 0.25, { metalness: 0.8 });
    add(new T.CylinderGeometry(0.06, 0.07, 0.04, 16), gold, FX - 0.25, 1.495, WALL_Z + 0.12);
    add(new T.CylinderGeometry(0.015, 0.015, 0.07, 10), gold, FX - 0.25, 1.55, WALL_Z + 0.12);
    add(new T.CylinderGeometry(0.09, 0.04, 0.1, 20), gold, FX - 0.25, 1.63, WALL_Z + 0.12);
    add(new T.CylinderGeometry(0.06, 0.05, 0.1, 16), std('#c4663f', 0.8), FX + 0.25, 1.52, WALL_Z + 0.12);
    for (let i = 0; i < 5; i++) {
      const l = add(new T.SphereGeometry(0.04, 10, 8), leaf, FX + 0.25 + Math.cos(i * 1.3) * 0.03, 1.62 + i * 0.015, WALL_Z + 0.12 + Math.sin(i * 1.3) * 0.03);
      l.scale.set(0.8, 1.8, 0.6);
    }
    // Side table with a lamp, right
    const TX = 1.85, TZ = -1.25;
    const wood = std('#6e4227', 0.45), brass = std('#d9b25b', 0.3, { metalness: 0.6 });
    add(new T.CylinderGeometry(0.32, 0.32, 0.05, 32), wood, TX, 0.72, TZ);
    for (const a of [0.8, 2.4, 3.9, 5.5]) add(new T.CylinderGeometry(0.025, 0.02, 0.7, 10), wood, TX + Math.cos(a) * 0.22, 0.35, TZ + Math.sin(a) * 0.22);
    add(new T.CylinderGeometry(0.09, 0.11, 0.05, 20), brass, TX, 0.77, TZ);
    add(new T.CylinderGeometry(0.015, 0.015, 0.42, 10), brass, TX, 0.99, TZ);
    add(new T.CylinderGeometry(0.15, 0.27, 0.3, 32, 1, true), std('#f6d26a', 0.8, { emissive: '#f6c24a', emissiveIntensity: 0.55, side: T.DoubleSide }), TX, 1.28, TZ, false);
    const lamp = new T.PointLight(0xffc477, 2.2, 4, 1.6);
    lamp.position.set(TX, 1.2, TZ);
    scene.add(lamp);
    // Her red boombox (the CD player), bottom left, where its button is
    {
      const BX = -1.55, BZ = 0.75, red = std('#d8435b', 0.35), dark = std('#2a2430', 0.5), metal = std('#c9c9d2', 0.25, { metalness: 0.7 });
      const box = add(new T.BoxGeometry(0.62, 0.32, 0.2), red, BX, 0.17, BZ);
      box.rotation.y = 0.25;
      const g = new T.Group(); g.position.copy(box.position); g.rotation.y = 0.25; scene.add(g);
      for (const side of [-1, 1]) {
        const sp = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 28), dark); sp.rotation.x = Math.PI / 2; sp.position.set(side * 0.18, -0.01, 0.1); g.add(sp);
        const cone = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.035, 20), metal); cone.rotation.x = Math.PI / 2; cone.position.set(side * 0.18, -0.01, 0.105); g.add(cone);
      }
      const deck = new T.Mesh(new T.BoxGeometry(0.14, 0.09, 0.02), dark); deck.position.set(0, -0.02, 0.1); g.add(deck);
      const disc = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.022, 20), metal); disc.rotation.x = Math.PI / 2; disc.position.set(0, -0.02, 0.105); g.add(disc);
      const handle = new T.Mesh(new T.TorusGeometry(0.2, 0.018, 8, 24, Math.PI), dark); handle.position.set(0, 0.16, 0); g.add(handle);
      for (const k of [-1, 0, 1]) { const b = new T.Mesh(new T.BoxGeometry(0.035, 0.02, 0.03), std('#ffd27a', 0.4)); b.position.set(k * 0.05, 0.165, 0.05); g.add(b); }
      g.traverse((o) => { o.castShadow = true; });
    }
    // The rug under her
    const rug = add(new T.CircleGeometry(1, 64), std(0xffffff, 0.95, { map: rugTex() }), 0, 0.004, 0.15, false);
    rug.rotation.x = -Math.PI / 2;
    rug.scale.set(1.55, 0.8, 1);
    // Light: soft daylight from the window side, warm lamp light, and gentle fill
    scene.add(new T.HemisphereLight(0xfff6ea, 0x8a6a50, 1.25));
    const sun = new T.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(-3, 5, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 0.5, far: 15 });
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    return scene;
  }
  const rooms = new Map(); // stage element -> room view
  function room(stage, petEl) {
    let v = rooms.get(stage);
    if (!v) {
      const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      const c = renderer.domElement;
      c.className = 'room3d';
      stage.prepend(c);
      stage.classList.add('has3dRoom');
      v = { renderer, scene: buildRoom(), petEl, key: '' };
      rooms.set(stage, v);
    }
    v.petEl = petEl;
    v.key = ''; // draw again on the next frame
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  // Drawn only when the stage or her box changes size or place: the room itself doesn't move.
  function drawRoom(stage, v) {
    const sr = stage.getBoundingClientRect(), pr = v.petEl.getBoundingClientRect();
    if (!sr.width || !pr.width) return;
    const key = [sr.width, sr.height, pr.left - sr.left, pr.top - sr.top, pr.width, pr.height].map(Math.round).join();
    if (key === v.key) return;
    v.key = key;
    v.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    v.renderer.setSize(sr.width, sr.height, false);
    // Her camera sees exactly her box; the room camera is the same camera seeing the whole stage.
    const cam = petCamera(pr.width / pr.height);
    cam.setViewOffset(pr.width, pr.height, sr.left - pr.left, sr.top - pr.top, sr.width, sr.height);
    v.renderer.render(v.scene, cam);
  }
  function removeRoom(stage) {
    const v = rooms.get(stage);
    if (!v) return;
    v.renderer.dispose();
    v.renderer.domElement.remove();
    stage.classList.remove('has3dRoom');
    rooms.delete(stage);
  }
  function remove(el) {
    const v = views.get(el);
    if (!v) return;
    v.renderer.dispose();
    v.renderer.domElement.remove();
    views.delete(el);
    el.classList.remove('is3d');
  }
  // Her model for other 3D scenes (the minigames): call pose(anim) every frame.
  function figure(lookId) {
    const v = { model: build(lookId), anim: 'idle', after: null, started: performance.now(), ends: 0, blinkAt: 0 };
    // An outer group the scene can move: pose() resets the model's own position every frame.
    const holder = new T.Group();
    holder.add(v.model.root);
    return {
      root: holder,
      pose(anim) { if (anim !== v.anim) { v.anim = anim; v.started = performance.now(); } pose(v, performance.now()); },
    };
  }
  return { play, remove, room, removeRoom, figure, has: (el) => views.has(el) };
})();
