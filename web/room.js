/* Phòng trưng bày 3D — mặt tiền + bên trong, chạm sản phẩm để bay tới xem chi tiết,
   vuốt lên để thoát. Chỉ được tải khi người xem mở tới trang này.
   Phòng được dựng và bake ánh sáng trong Blender (blender/build_room.py → bake.py → export.py)
   rồi xuất ra assets/showroom.glb; sản phẩm được đặt lại ở đây để bấm được. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const W = 7, D = 6.5;                       // phòng: rộng × sâu (mét) — khớp với Blender
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
  renderer.toneMapping = THREE.NoToneMapping;          // ánh sáng đã bake sẵn trong ảnh
  renderer.setClearColor(0x050506);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);

  const manager = new THREE.LoadingManager();
  manager.onLoad = () => { loadingEl.hidden = true; };
  manager.onError = url => { loadingEl.textContent = 'Không tải được ' + url.split('/').pop() + '. Tải lại trang để thử lại.'; };
  const loader = new THREE.TextureLoader(manager);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = url => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
  const add = m => (scene.add(m), m);
  const plane = (w, h, mat, x, y, z, ry = 0) => { const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)); m.position.set(x, y, z); m.rotation.y = ry; return m; };

  /* ── phòng từ Blender: mọi vật liệu đổi sang dạng không cần đèn (đã bake) ── */
  new GLTFLoader(manager).load('assets/showroom.glb', gltf => {
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      const glow = m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0;
      const map = m.emissiveMap || m.map || null;
      if (map) map.anisotropy = aniso;
      const mat = new THREE.MeshBasicMaterial({ map, transparent: m.transparent, alphaTest: m.alphaTest, toneMapped: false, side: m.side });
      if (!map) mat.color.copy(glow ? m.emissive : m.color);
      o.material = mat;
      if (o.name === 'bake_floor' || o.name === 'bake_ground') hideInMirror.push(o);
    });
    scene.add(gltf.scene);
  });

  /* ── sàn bóng: vẽ lại cả cảnh lật qua mặt sàn (y = 0) từ đúng góc máy, rồi phủ mờ ảnh đó lên sàn đã bake (nhoè một
     chút, nhìn càng xiên càng bóng). Lúc vẽ ảnh lật thì ẩn sàn và mặt đường (cùng nằm ở y = 0, sẽ che hết). Mọi vật
     liệu trong phòng đều hai mặt nên lật ảnh không làm mất mặt nào ── */
  const mirrorRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const mirrorCam = new THREE.PerspectiveCamera(); mirrorCam.matrixWorldAutoUpdate = false;
  const FLIP_Y = new THREE.Matrix4().makeScale(1, -1, 1);
  const hideInMirror = [];
  const gloss = add(new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.ShaderMaterial({
    uniforms: { tMirror: { value: mirrorRT.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: `varying vec3 vView;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0); vView = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform sampler2D tMirror; uniform vec2 uRes, uTexel; varying vec3 vView;
      void main() {
        vec2 uv = gl_FragCoord.xy / uRes;
        vec3 c = vec3(0.0);
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
          c += texture2D(tMirror, uv + vec2(float(i), float(j)) * 1.5 * uTexel).rgb;
        float k = 1.0 - abs(normalize(vView).y);
        gl_FragColor = vec4(c / 9.0, mix(.15, .42, k));
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  })));
  gloss.rotation.x = -Math.PI / 2; gloss.position.set(0, .002, -D / 2);
  gloss.onBeforeRender = (r, s, cam) => {
    mirrorCam.projectionMatrix.copy(cam.projectionMatrix); mirrorCam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    mirrorCam.matrixWorld.multiplyMatrices(FLIP_Y, cam.matrixWorld);
    mirrorCam.matrixWorldInverse.multiplyMatrices(cam.matrixWorldInverse, FLIP_Y);
    gloss.visible = false; hideInMirror.forEach(o => { o.visible = false; });
    const prev = r.getRenderTarget();
    r.setRenderTarget(mirrorRT); r.render(s, mirrorCam); r.setRenderTarget(prev);
    gloss.visible = true; hideInMirror.forEach(o => { o.visible = true; });
  };
  /* ── sản phẩm (bấm được) ── */
  const items = [];
  const product = (o) => {
    const face = o.hit ? new THREE.MeshBasicMaterial({ visible: false })      // tấm chạm vô hình phủ lên vật đã có trong GLB
      : new THREE.MeshBasicMaterial({ map: tex('assets/' + o.img), transparent: true, alphaTest: .04, toneMapped: false, side: o.depth ? THREE.FrontSide : THREE.DoubleSide });
    let m;
    if (o.depth) {        // hộp đèn hai mặt: trước & sau in hình, các cạnh tối
      const edge = new THREE.MeshBasicMaterial({ color: 0x0e0f0f });
      m = add(new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.depth), [edge, edge, edge, edge, face, face]));
      m.position.set(...o.pos); m.rotation.y = o.ry || 0;
    } else m = plane(o.w, o.h, face, ...o.pos, o.ry || 0);
    const it = { ...o, mesh: m }; m.userData.item = it; items.push(it); return it;
  };
  // bảng vẫy ở hai góc trên mặt tiền, xoè ra phía đường; standee 80×200 hai bên cửa — khớp blender/build_room.py
  const SA = .9, SW = .78;
  for (const s of [-1, 1]) {
    product({ kind: 'sign', img: 'room-sign.webp', w: SW, h: 1.04, depth: .1, ry: -s * SA, zone: 'out', label: s < 0,
      pos: [s * (3 + SW / 2 * Math.cos(SA)), 2.95, .06 + SW / 2 * Math.sin(SA)] });
    product({ kind: s < 0 ? 'standee1' : 'standee2', img: `room-standee-${s < 0 ? 1 : 2}.webp`, w: .8, h: 2, ry: -s * .1, zone: 'out', label: true,
      pos: [s * 2.45, 1.07, .5] });
  }
  product({ kind: 'banner', img: 'room-banner.webp', w: 2.43, h: 1.19, pos: [-W / 2 + .03, 1.95, -3.3], ry: Math.PI / 2, zone: 'in', label: true });   // bạt trải nắp capo
  product({ kind: 'hood', img: 'room-hood.jpg', w: .95, h: 1.27, pos: [2.15, 2.05, -D + .02], zone: 'in', label: true });
  product({ kind: 'tank', img: 'room-tank-2.webp', w: .56, h: .63, pos: [-2.75, 1.03 + .315, -D + .32], zone: 'in', label: true });
  product({ kind: 'pump', img: 'room-pump.webp', w: .27, h: .39, pos: [1.6, 1.03 + .195, -D + .32], zone: 'in', label: true });
  product({ kind: 'price', img: 'room-price.webp', w: .9, h: 1.27, pos: [-2.15, 2.05, -D + .02], zone: 'in', label: true });   // bảng giá sau bình tạo bọt
  product({ kind: 'demo', img: 'room-may-ban-soi.webp', w: .8, h: .58, pos: [0, .63 + .29, -3.8], zone: 'in', label: true });   // bục giữa
  product({ kind: 'impact', img: 'room-may-tac-dong.webp', w: .65, h: .44, pos: [2.62, 1.03 + .22, -D + .32], zone: 'in', label: true });
  // tường phải: 2 áo treo (mặt trước, mặt sau) + mũ trên kệ nhỏ
  for (const [img, z, label] of [['room-ao-truoc.webp', -4.2, true], ['room-ao-sau.webp', -3.3, false]])
    product({ kind: 'shirt', img, w: .74, h: .95, pos: [W / 2 - .04, 1.8, z], ry: -Math.PI / 2, zone: 'in', label });
  product({ kind: 'cap', img: 'room-mu.webp', w: .5, h: .465, pos: [W / 2 - .13, 1.45 + .015 + .465 / 2, -2.3], ry: -Math.PI / 2, zone: 'in', label: true });
  // biển hiệu ZAPPA trên mặt tiền (đã có trong showroom.glb): phủ tấm chạm vô hình để bấm được
  product({ kind: 'logo', hit: true, w: 3, h: 3 * 449 / 1600, pos: [0, 3.52, .17], zone: 'out', label: true });
  // sàn bóng (quà tặng): tấm chạm vô hình phủ cả sàn, chấm đặt trên thảm vàng bên trái bục (x -1,2; z -3,4); sàn quá
  // rộng nên bấm vào thì bay tới một góc nhìn chéo xuống sàn đặt sẵn
  const floor = product({ kind: 'floor', hit: true, w: W, h: D, pos: [0, .003, -D / 2], zone: 'in', label: true, dot: [-1.2 / W, .15 / D],
    view: { pos: V(0, 2.5, -.3), look: V(0, -.4, -4.2) } });
  floor.mesh.rotation.x = -Math.PI / 2;
  const rows = [['1398 PRO', -2.15, .84], ['1398', -2.15, .52], ['1388 PRO', -2.15, .2], ['1388', 2.15, .84], ['1378', 2.15, .52], ['1368', 2.15, .2]];
  for (const [name, x, y] of rows) {
    const d = ppf.find(p => p.name === name);
    product({ kind: 'film', film: d, img: d.img, w: 1.95, h: .31, pos: [x, y, -D + .605], zone: 'in', label: true, dot: [-.4, 0] });   // chấm ở đầu trái cuộn phim
  }

  /* ── điểm chạm nổi trên sản phẩm (mặc định giữa mép trên; dot = [x, y] theo tỉ lệ bề ngang / chiều cao) ── */
  const hots = items.map(it => {
    if (!it.label) return null;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hot';
    const name = it.kind === 'film' ? 'PPF ' + it.film.name : products[it.kind].short;
    b.innerHTML = `<i></i><span>${name}</span>`;
    b.setAttribute('aria-label', 'Xem ' + name);
    b.addEventListener('click', e => { e.stopPropagation(); focus(it); });
    hotsEl.appendChild(b); return b;
  });
  let labelTimer = 0;
  const flashLabels = () => {        // nhãn tên chỉ hiện vài giây khi vừa tới một góc nhìn
    root.classList.add('labels'); clearTimeout(labelTimer);
    labelTimer = setTimeout(() => root.classList.remove('labels'), 3200);
  };

  /* ── điều khiển góc nhìn ── */
  const stations = {
    out: { pos: V(0, 1.9, 7.2), yaw: 0, pitch: .07, yawMax: .5, pitchMax: .2 },
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
    setTimeout(flashLabels, reduce ? 0 : 1500);
  }
  function focus(it) {
    if (it.zone !== (st === stations.out ? 'out' : 'in')) { st = stations[it.zone]; viewBtns.forEach(b => b.classList.toggle('on', b.dataset.view === it.zone)); }
    focused = it;
    if (it.view) fly(it.view.pos.clone(), it.view.look.clone(), 1150);
    else {
      const c = it.mesh.getWorldPosition(V(0, 0, 0));
      const n = V(0, 0, 1).applyQuaternion(it.mesh.getWorldQuaternion(new THREE.Quaternion()));
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const dist = Math.max(it.h * 1.2 / (.52 * 2 * tan), it.w * 1.15 / (camera.aspect * 2 * tan), .55);
      const pos = c.clone().add(n.multiplyScalar(dist));
      pos.x = THREE.MathUtils.clamp(pos.x, -W / 2 + .3, W / 2 - .3);
      const look = c.clone().add(V(0, -.46 * dist * tan, 0));     // đẩy sản phẩm lên nửa trên, chừa chỗ cho bảng chi tiết
      fly(pos, look, 1150);
    }
    showPanel(it);
    root.classList.add('focused');
  }
  function unfocus(silent) {
    focused = null; panel.classList.remove('open'); root.classList.remove('focused');
    if (!silent) fly(st.pos.clone(), st.pos.clone().add(dirOf(yaw, pitch).multiplyScalar(5)), 950);
  }

  const desc = p => (p.desc ? `<p class="rp-desc">${p.desc}</p>` : '');   // sản phẩm không có mô tả thì thôi
  const toBoard = p => (p.board ? `<button type="button" class="rp-go" data-board="${p.board}">Xem bảng giá</button>` : '');
  function showPanel(it) {
    let html;
    if (it.kind === 'film') {
      const d = it.film;
      html = `<div class="rp-imgs one film"><img src="assets/${d.img}" alt="Hộp phim PPF Zappa ${d.name}"></div>
        <p class="rp-kicker">PPF Zappa Series · ${d.mil} mil · Bảo hành ${d.warranty} năm</p><h3 class="rp-name">PPF Zappa ${d.name}</h3>
        <p class="rp-price"><s class="strike">${vnd(d.list)}</s><span class="p-off">-${d.off}%</span><b>${vnd(d.sale)}</b></p>
        <button type="button" class="rp-go" data-board="ppf-${d.name.toLowerCase().replace(/\s+/g, '')}">Xem bảng giá ${d.name}</button>`;
    } else if (products[it.kind].tall) {      // ảnh dọc (standee): ảnh bên trái, chữ bên phải cho bảng gọn
      const p = products[it.kind];
      html = `<div class="rp-row"><a class="rp-tall" href="assets/${p.imgs[0]}" target="_blank" rel="noopener"><img src="assets/${p.imgs[0]}" alt="${p.name}"></a>
        <div><p class="rp-kicker">${p.kicker}</p><h3 class="rp-name">${p.name}</h3>${desc(p)}
        ${toBoard(p) || `<a class="rp-go" href="assets/${p.imgs[0]}" target="_blank" rel="noopener">Xem ảnh lớn</a>`}</div></div>`;
    } else {
      const p = products[it.kind];
      html = `${p.imgs.length ? `<div class="rp-imgs${p.imgs.length > 1 ? '' : ' one'}">${p.imgs.map(s => `<img src="assets/${s}" alt="${p.name}">`).join('')}</div>` : ''}
        <p class="rp-kicker">${p.kicker}</p><h3 class="rp-name">${p.name}</h3>${desc(p)}${toBoard(p)}`;
    }
    panel.innerHTML = `<button type="button" class="rp-x" aria-label="Thoát">×</button>${html}<p class="rp-hint"><svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>Vuốt lên để thoát</p>`;
    panel.querySelector('.rp-x').addEventListener('click', e => { e.stopPropagation(); unfocus(); });
    const go = panel.querySelector('.rp-go[data-board]');
    if (go) go.addEventListener('click', e => { e.stopPropagation(); goToBoard(go.dataset.board); });
    requestAnimationFrame(() => panel.classList.add('open'));
  }

  /* ── cử chỉ: kéo để nhìn quanh, chạm để chọn, vuốt lên để thoát ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  root.addEventListener('pointerdown', e => {
    if (e.target.closest('.hot, .room-ui, .rp-x, .rp-go, .rp-tall')) return;
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
      // tấm chạm vô hình (biển hiệu, sàn) chỉ tính ở đúng góc nhìn của nó: đứng ngoài chạm vào sàn qua cửa vẫn là bước vào
      const here = st === stations.out ? 'out' : 'in';
      const hit = ray.intersectObjects(items.filter(i => !i.hit || i.zone === here).map(i => i.mesh))[0];
      if (hit) focus(hit.object.userData.item);
      else if (st === stations.out) goStation('in');           // chạm vào cửa/mặt tiền thì bước vào
    }
  });
  root.addEventListener('wheel', e => { if (focused) { e.preventDefault(); e.stopPropagation(); if (e.deltaY < 0) unfocus(); } }, { passive: false });
  for (const ev of ['touchmove', 'touchend']) root.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  // kéo trên khung phòng chỉ để nhìn quanh: chặn mặc định của trình duyệt ngay từ touchstart, kẻo iPhone hiểu vuốt ngang
  // (nhất là bắt đầu sát mép màn) là cử chỉ quay lại / tới trang và thoát khỏi web. Chạm chọn sản phẩm vẫn chạy vì dùng
  // pointerup, không dùng click
  root.addEventListener('touchstart', e => {
    e.stopPropagation();
    if (e.target === canvas) e.preventDefault();
  }, { passive: false });
  viewBtns.forEach(b => b.addEventListener('click', e => { e.stopPropagation(); goStation(b.dataset.view); }));

  /* ── kích thước ── */
  function resize() {
    const w = root.clientWidth, h = root.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = camera.aspect < .8 ? 70 : 56; camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio(), gw = Math.round(w * pr / 2), gh = Math.round(h * pr / 2);   // ảnh phản chiếu nửa độ phân giải
    mirrorRT.setSize(gw, gh);
    gloss.material.uniforms.uTexel.value.set(1 / gw, 1 / gh);
    renderer.getDrawingBufferSize(gloss.material.uniforms.uRes.value);
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
      const b = hots[i]; if (!b) return;
      const [fx, fy] = it.dot || [0, .5];
      it.mesh.localToWorld(tmp.set(fx * it.w, fy * it.h, 0));
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
      if (on) { resize(); requestAnimationFrame(frame); flashLabels(); }
      else {
        if (focused) unfocus(true);
        hots.forEach(b => b && b.classList.remove('show'));    // rời phòng: tắt chấm, không để lọt sang trang khác
      }
    },
  };
}
