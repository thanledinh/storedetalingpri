/* Phòng trưng bày 3D — mặt tiền + bên trong, chạm sản phẩm để bay tới xem chi tiết,
   vuốt lên để thoát. Chỉ được tải khi người xem mở tới trang này. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const W = 7, D = 6.5, H = 3.2;              // phòng: rộng × sâu × cao (mét)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function mount(root, { products, ppf, vnd, goToBoard, reduce }) {
  const canvas = root.querySelector('canvas');
  const hotsEl = root.querySelector('.room-hots');
  const panel = root.querySelector('.room-panel');
  const loadingEl = root.querySelector('.room-loading');
  const tip = root.querySelector('.room-tip');
  const viewBtns = [...root.querySelectorAll('[data-view]')];

  /* ── renderer, camera ── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x050506);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050506, 16, 34);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);

  const manager = new THREE.LoadingManager();
  manager.onLoad = () => { loadingEl.hidden = true; };
  const loader = new THREE.TextureLoader(manager);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = url => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
  };
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: .05, ...o });
  const add = m => (scene.add(m), m);
  const box = (w, h, d, mat, x, y, z) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); return m; };
  const plane = (w, h, mat, x, y, z, ry = 0) => { const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)); m.position.set(x, y, z); m.rotation.y = ry; return m; };
  const glowTex = canvasTex(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const glow = (w, h, color, opacity, x, y, z, ry = 0) => plane(w, h, new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }), x, y, z, ry);
  const shadow = (w, d, x, z, o = .55) => { const m = plane(w, d, new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: o, depthWrite: false }), x, .006, z); m.rotation.x = -Math.PI / 2; return m; };

  /* ── ánh sáng ── */
  add(new THREE.HemisphereLight(0xffffff, 0x303030, 1.1));
  for (const [x, z] of [[0, -1.6], [0, -4.8], [-2.2, -3.2], [2.2, -3.2]]) {
    const l = add(new THREE.PointLight(0xfff3e2, 9, 9, 1.4)); l.position.set(x, H - .3, z);
  }
  const sun = add(new THREE.DirectionalLight(0xffffff, 2.2)); sun.position.set(3, 7, 10);
  const spot = add(new THREE.SpotLight(0xffffff, 40, 6, .42, .5, 1.2)); spot.position.set(0, H - .1, -3.8); spot.target.position.set(0, 0, -3.8); add(spot.target);

  /* ── sàn, trần, tường bên trong ── */
  const floorTex = canvasTex(1024, 1024, (g, w, h) => {
    const cx = x => (x / W + .5) * w, cy = z => (1 + z / D) * h;
    g.fillStyle = '#6b6c6e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8c80f'; g.fillRect(cx(-1.6), cy(-5.8), cx(1.6) - cx(-1.6), cy(-1.2) - cy(-5.8));
    g.strokeStyle = 'rgba(30,30,30,.55)'; g.lineWidth = 3;
    for (let x = -W / 2; x <= W / 2; x += .7) { g.beginPath(); g.moveTo(cx(x), 0); g.lineTo(cx(x), h); g.stroke(); }
    for (let z = 0; z >= -D; z -= .7) { g.beginPath(); g.moveTo(0, cy(z)); g.lineTo(w, cy(z)); g.stroke(); }
  });
  const floor = plane(W, D, std(0xffffff, { map: floorTex, roughness: .32, metalness: .15 }), 0, 0, -D / 2);
  floor.rotation.x = -Math.PI / 2;

  const hexTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#1b1b1d'; g.fillRect(0, 0, w, h);
    const r = 118, sx = r * 1.5, sy = Math.sqrt(3) * r;
    g.strokeStyle = '#ffffff'; g.lineWidth = 11; g.shadowColor = '#ffffff'; g.shadowBlur = 16;
    for (let c = -1; c < w / sx + 1; c++) for (let rr = -1; rr < h / sy + 1; rr++) {
      const x = c * sx, y = rr * sy + (c % 2 ? sy / 2 : 0), k = r - 16;
      g.beginPath();
      for (let i = 0; i <= 6; i++) { const a = Math.PI / 3 * i; g[i ? 'lineTo' : 'moveTo'](x + k * Math.cos(a), y + k * Math.sin(a)); }
      g.stroke();
    }
  });
  const ceil = plane(W, D, new THREE.MeshStandardMaterial({ color: 0x222222, map: hexTex, emissive: 0xffffff, emissiveMap: hexTex, emissiveIntensity: 1.25 }), 0, H, -D / 2);
  ceil.rotation.x = Math.PI / 2;

  const wallMat = std(0x45473d);
  plane(W, H, wallMat, 0, H / 2, -D);                       // tường sau
  plane(D, H, wallMat, -W / 2, H / 2, -D / 2, Math.PI / 2);  // tường trái
  plane(D, H, wallMat, W / 2, H / 2, -D / 2, -Math.PI / 2);  // tường phải

  /* ── mặt tiền ── */
  const facade = std(0xd9d9d4, { roughness: .9 });
  box(4.2, 4.4, .2, facade, -3.9, 2.2, -.1);
  box(4.2, 4.4, .2, facade, 3.9, 2.2, -.1);
  box(3.6, 1.8, .2, facade, 0, 3.5, -.1);
  const navy = std(0x1d2742, { roughness: .6, metalness: .3 });
  for (const x of [-1.85, 1.85]) box(.12, 2.6, .26, navy, x, 1.3, -.05);
  box(3.82, .12, .26, navy, 0, 2.6, -.05);
  const ribTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#1e2a4a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, 0, 5, h); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 9, 0, 3, h); }
  });
  ribTex.wrapS = THREE.RepeatWrapping; ribTex.repeat.set(3, 1);
  box(5.6, 1.75, .2, std(0xffffff, { map: ribTex, roughness: .55, metalness: .35 }), 0, 3.52, .06);
  const signTex = canvasTex(1024, 320, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(240,215,30,.9)'; g.shadowBlur = 28;
    g.font = 'italic 800 190px Montserrat, sans-serif'; g.lineWidth = 14; g.strokeStyle = '#111'; g.strokeText('ZAPPA', w / 2, 128);
    g.fillStyle = '#f2d51b'; g.fillText('ZAPPA', w / 2, 128);
    g.shadowBlur = 0; g.fillStyle = '#f2d51b'; g.fillRect(170, 236, w - 340, 62);
    g.font = '800 46px Montserrat, sans-serif'; g.fillStyle = '#111'; g.fillText('PAINT PROTECTION FILM', w / 2, 268);
  });
  plane(3.4, 1.06, new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false }), 0, 3.55, .17);
  glow(4.6, 1.8, 0xf2d51b, .22, 0, 3.55, .165);
  const ground = plane(16, 10, std(0x26272a, { roughness: .95 }), 0, 0, 5);
  ground.rotation.x = -Math.PI / 2;
  glow(3.4, 2.4, 0xfff1d0, .25, 0, 1.3, -.02);               // ánh sáng hắt ra từ cửa

  /* ── quầy kệ, bảng treo tường ── */
  const counterMat = std(0x111113, { roughness: .35, metalness: .25 });
  const topMat = std(0xf3f3f1, { roughness: .4 });
  for (const x of [-2.15, 2.15]) { box(2.3, 1, .6, counterMat, x, .5, -D + .3); box(2.34, .03, .64, topMat, x, 1.015, -D + .3); shadow(2.8, 1.2, x, -D + .55, .5); }
  plane(2.5, 1.46, new THREE.MeshBasicMaterial({ map: tex('assets/room-board.jpg'), toneMapped: false }), 0, 2.15, -D + .02);
  glow(3.4, 2.4, 0xfff3c4, .18, 0, 2.15, -D + .01);
  plane(.9, 1.25, new THREE.MeshBasicMaterial({ map: tex('assets/room-price.jpg'), toneMapped: false }), -2.15, 2.05, -D + .02);
  glow(1.6, 2, 0xf2d51b, .3, -2.15, 2.05, -D + .01);
  const logoTex = tex('assets/logo-store.png');
  plane(2.4, .77, new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false }), W / 2 - .02, 2.2, -3.4, -Math.PI / 2);
  glow(3.2, 1.6, 0x40b8da, .16, W / 2 - .03, 2.2, -3.4, -Math.PI / 2);

  /* bục giữa cho máy demo */
  const ped = add(new THREE.Mesh(new THREE.CylinderGeometry(.55, .58, .62, 48), std(0x0d0d0f, { roughness: .25, metalness: .4 })));
  ped.position.set(0, .31, -3.8);
  const ring = add(new THREE.Mesh(new THREE.TorusGeometry(.55, .012, 8, 64), new THREE.MeshBasicMaterial({ color: 0xf2d51b, toneMapped: false })));
  ring.rotation.x = Math.PI / 2; ring.position.set(0, .625, -3.8);
  shadow(1.8, 1.8, 0, -3.8, .6);

  /* ── sản phẩm (bấm được) ── */
  const items = [];
  const product = (o) => {
    const t = tex('assets/' + o.img);
    const m = plane(o.w, o.h, new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .04, toneMapped: false, side: THREE.DoubleSide }), ...o.pos, o.ry || 0);
    if (o.flip) m.scale.x = -1;
    const it = { ...o, mesh: m }; m.userData.item = it; items.push(it); return it;
  };
  product({ kind: 'lightbox', img: 'room-lightbox.webp', w: .9, h: .83, pos: [-2.5, 1.95, .26], zone: 'out', label: true });
  product({ kind: 'lightbox', img: 'room-lightbox.webp', w: .9, h: .83, pos: [2.5, 1.95, .26], zone: 'out', flip: true });
  product({ kind: 'banner', img: 'room-banner.webp', w: 2.3, h: 1.19, pos: [-W / 2 + .03, 1.95, -3.3], ry: Math.PI / 2, zone: 'in', label: true });
  product({ kind: 'hood', img: 'room-hood.jpg', w: .95, h: 1.27, pos: [2.15, 2.05, -D + .02], zone: 'in', label: true });
  product({ kind: 'tank', img: 'room-tank-2.webp', w: .56, h: .63, pos: [-2.75, 1.03 + .315, -D + .32], zone: 'in', label: true });
  product({ kind: 'pump', img: 'room-pump.webp', w: .27, h: .39, pos: [1.6, 1.03 + .195, -D + .32], zone: 'in', label: true });
  product({ kind: 'demo', img: 'room-demo-1.webp', w: 1.05, h: .54, pos: [0, .63 + .27, -3.8], zone: 'in', label: true });
  const rows = [['1398 PRO', -2.15, .84], ['1398', -2.15, .52], ['1388 PRO', -2.15, .2], ['1388', 2.15, .84], ['1378', 2.15, .52], ['1368', 2.15, .2]];
  for (const [name, x, y] of rows) {
    const d = ppf.find(p => p.name === name);
    product({ kind: 'film', film: d, img: d.img, w: 1.95, h: .31, pos: [x, y, -D + .605], zone: 'in' });
  }

  /* ── điểm chạm nổi trên sản phẩm ── */
  const hots = items.map(it => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hot' + (it.label ? ' lbl' : '');
    const name = it.kind === 'film' ? 'PPF ' + it.film.name : products[it.kind].short;
    b.innerHTML = `<i></i>${it.label ? `<span>${name}</span>` : ''}`;
    b.setAttribute('aria-label', 'Xem ' + name);
    b.addEventListener('click', e => { e.stopPropagation(); focus(it); });
    hotsEl.appendChild(b); return b;
  });

  /* ── điều khiển góc nhìn ── */
  const stations = {
    out: { pos: V(0, 1.75, 8.6), yaw: 0, pitch: .06, yawMax: .45, pitchMax: .2 },
    in:  { pos: V(0, 1.72, -.15), yaw: 0, pitch: -.1, yawMax: 1.15, pitchMax: .32 },
  };
  let st = stations.out, yaw = 0, pitch = st.pitch, tYaw = 0, tPitch = st.pitch;
  const view = { pos: st.pos.clone(), look: V(0, 1.9, 0) };
  const dirOf = (y, p) => V(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
  let tween = null, focused = null, active = false;
  function fly(pos, look, ms = 1100) {
    tween = { p0: view.pos.clone(), l0: view.look.clone(), p1: pos, l1: look, t0: performance.now(), ms: reduce ? 1 : ms };
  }
  function goStation(name) {
    if (focused) unfocus(true);
    st = stations[name]; tYaw = yaw = 0; tPitch = pitch = st.pitch;
    fly(st.pos.clone(), st.pos.clone().add(dirOf(0, st.pitch).multiplyScalar(5)), 1500);
    viewBtns.forEach(b => b.classList.toggle('on', b.dataset.view === name));
  }
  function focus(it) {
    if (it.zone !== (st === stations.out ? 'out' : 'in')) { st = stations[it.zone]; viewBtns.forEach(b => b.classList.toggle('on', b.dataset.view === it.zone)); }
    focused = it;
    const c = it.mesh.getWorldPosition(V(0, 0, 0));
    const n = V(0, 0, 1).applyQuaternion(it.mesh.getWorldQuaternion(new THREE.Quaternion()));
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const dist = Math.max(it.h * 1.2 / (.52 * 2 * tan), it.w * 1.15 / (camera.aspect * 2 * tan), .55);
    const pos = c.clone().add(n.multiplyScalar(dist));
    pos.x = THREE.MathUtils.clamp(pos.x, -W / 2 + .3, W / 2 - .3);
    const look = c.clone().add(V(0, -.46 * dist * tan, 0));     // đẩy sản phẩm lên nửa trên, chừa chỗ cho bảng chi tiết
    fly(pos, look, 1150);
    showPanel(it);
    root.classList.add('focused');
  }
  function unfocus(silent) {
    focused = null; panel.classList.remove('open'); root.classList.remove('focused');
    if (!silent) fly(st.pos.clone(), st.pos.clone().add(dirOf(yaw, pitch).multiplyScalar(5)), 950);
  }

  function showPanel(it) {
    let html;
    if (it.kind === 'film') {
      const d = it.film;
      html = `<div class="rp-imgs one film"><img src="assets/${d.img}" alt="Hộp phim PPF Zappa ${d.name}"></div>
        <p class="rp-kicker">PPF Zappa Series · ${d.mil} mil · Bảo hành ${d.warranty} năm</p><h3 class="rp-name">PPF Zappa ${d.name}</h3>
        <p class="rp-price"><s class="strike">${vnd(d.list)}</s><span class="p-off">-${d.off}%</span><b>${vnd(d.sale)}</b></p>
        <button type="button" class="rp-go" data-board="ppf-${d.name.toLowerCase().replace(/\s+/g, '')}">Xem bảng giá ${d.name}</button>`;
    } else {
      const p = products[it.kind];
      html = `<div class="rp-imgs${p.imgs.length > 1 ? '' : ' one'}">${p.imgs.map(s => `<img src="assets/${s}" alt="${p.name}">`).join('')}</div>
        <p class="rp-kicker">${p.kicker}</p><h3 class="rp-name">${p.name}</h3><p class="rp-desc">${p.desc}</p>`;
    }
    panel.innerHTML = `<button type="button" class="rp-x" aria-label="Thoát">×</button>${html}<p class="rp-hint"><svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>Vuốt lên để thoát</p>`;
    panel.querySelector('.rp-x').addEventListener('click', e => { e.stopPropagation(); unfocus(); });
    const go = panel.querySelector('.rp-go');
    if (go) go.addEventListener('click', e => { e.stopPropagation(); goToBoard(go.dataset.board); });
    requestAnimationFrame(() => panel.classList.add('open'));
  }

  /* ── cử chỉ: kéo để nhìn quanh, chạm để chọn, vuốt lên để thoát ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  root.addEventListener('pointerdown', e => {
    if (e.target.closest('.hot, .room-ui, .rp-x, .rp-go')) return;
    down = { x: e.clientX, y: e.clientY, yaw: tYaw, pitch: tPitch, t: performance.now() };
  });
  root.addEventListener('pointermove', e => {
    if (!down || focused || tween) return;
    tYaw = THREE.MathUtils.clamp(down.yaw - (e.clientX - down.x) * .005, st.yaw - st.yawMax, st.yaw + st.yawMax);
    tPitch = THREE.MathUtils.clamp(down.pitch + (e.clientY - down.y) * .004, st.pitch - st.pitchMax, st.pitch + st.pitchMax);
    tip.classList.add('gone');
  });
  addEventListener('pointerup', e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y; const d0 = down; down = null;
    if (focused) { if (dy < -45 && Math.abs(dy) > Math.abs(dx)) unfocus(); return; }
    if (Math.hypot(dx, dy) < 8 && performance.now() - d0.t < 500 && e.target === canvas) {
      const r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(items.map(i => i.mesh))[0];
      if (hit) focus(hit.object.userData.item);
      else if (st === stations.out) goStation('in');           // chạm vào cửa/mặt tiền thì bước vào
    }
  });
  root.addEventListener('wheel', e => { if (focused) { e.preventDefault(); e.stopPropagation(); if (e.deltaY < 0) unfocus(); } }, { passive: false });
  for (const ev of ['touchstart', 'touchmove', 'touchend']) root.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  viewBtns.forEach(b => b.addEventListener('click', e => { e.stopPropagation(); goStation(b.dataset.view); }));

  /* ── kích thước ── */
  function resize() {
    const w = root.clientWidth, h = root.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = camera.aspect < .8 ? 70 : 56; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(root); resize();

  /* ── vòng vẽ ── */
  const tmp = new THREE.Vector3();
  function frame(now) {
    if (!active) return;
    if (tween) {
      const k = easeIO(Math.min(1, (now - tween.t0) / tween.ms));
      view.pos.lerpVectors(tween.p0, tween.p1, k); view.look.lerpVectors(tween.l0, tween.l1, k);
      if (k >= 1) tween = null;
    } else if (!focused) {
      yaw += (tYaw - yaw) * .14; pitch += (tPitch - pitch) * .14;
      view.pos.copy(st.pos); view.look.copy(st.pos).add(dirOf(yaw, pitch).multiplyScalar(5));
    }
    camera.position.copy(view.pos); camera.lookAt(view.look);
    renderer.render(scene, camera);
    // điểm chạm bám theo sản phẩm
    const r = root.getBoundingClientRect();
    camera.updateMatrixWorld();
    items.forEach((it, i) => {
      const b = hots[i];
      it.mesh.getWorldPosition(tmp); tmp.y += it.h * .5;
      const inFront = tmp.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
      tmp.project(camera);
      const here = st === stations.out ? 'out' : 'in';
      const show = !focused && !tween && it.zone === here && inFront && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      b.classList.toggle('show', show);
      if (show) b.style.transform = `translate(${((tmp.x + 1) / 2 * r.width).toFixed(1)}px,${((1 - tmp.y) / 2 * r.height).toFixed(1)}px)`;
    });
    requestAnimationFrame(frame);
  }
  return {
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on) { resize(); requestAnimationFrame(frame); }
      else if (focused) unfocus(true);
    },
  };
}
