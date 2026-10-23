/* Cảnh mở đầu sau khi bấm START: chiếc Urus vàng quay trên bàn xoay, 13 miếng PPF bay tới, uốn theo thân xe rồi
   ập vào xe (mũi trước), một vệt sáng chạy dọc xe và sơn bóng sâu lên.
   Xe, khuôn PPF và chất liệu sơn/phim lấy từ dự án son-wowww (src/car.js, src/v3/kit.js), rút gọn cho một cảnh.
   Mô hình xe: "Lamborghini Urus 2018" của kirikom9000 (Sketchfab, CC BY 4.0), đã chỉnh sửa. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

// trùng bản three trong importmap của index.html
const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/draco/gltf/';
const BG = 0x060708;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t * t;

// mốc thời gian của cảnh (giây)
const T = { fly0: 0.45, flight: 1.1, spread: 1.6, sweep: 0.9, end: 4.7 };

/* ── studio phản chiếu trên sơn: các dải softbox render vào PMREM (src/studio.js) ── */
function studioEnv(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x030304);
  const plane = new THREE.PlaneGeometry(1, 1);
  const add = (color, intensity, pos, scale) => {
    const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity * 0.95), side: THREE.DoubleSide }));
    m.position.set(...pos); m.scale.set(scale[0], scale[1], 1); m.lookAt(0, 0.5, 0);
    env.add(m);
  };
  add(0xffffff, 2.4, [0, 8, 0], [5, 14]);            // softbox trên đầu
  add(0xffffff, 7.0, [-8, 2.6, 0], [16, 0.5]);       // dải trái
  add(0xffffff, 7.0, [8, 2.6, 0], [16, 0.5]);        // dải phải
  add(0xffffff, 3.0, [-8, 0.9, 0], [16, 0.18]);
  add(0xffffff, 3.0, [8, 0.9, 0], [16, 0.18]);
  add(0xffffff, 1.6, [0, 2.5, 9], [7, 2.2]);         // đèn phụ phía trước
  add(0xffb347, 3.2, [-6, 1.5, -7], [4, 3]);         // viền ấm
  add(0x7fe7ef, 1.8, [6, 1.2, -7], [3, 2]);          // viền lạnh
  add(0x15171a, 1.0, [0, -2, 0], [30, 30]);          // sàn hắt lên
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  env.traverse((o) => o.material && o.material.dispose());
  plane.dispose();
  return tex;
}

function radialTexture(inner, outer, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// sàn bóng: phản chiếu hơi nhoè (13 điểm lấy mẫu)
const SOFT_REFLECTOR = {
  ...Reflector.ReflectorShader,
  name: 'SoftReflectorShader',
  uniforms: { ...Reflector.ReflectorShader.uniforms, uBlur: { value: 0.0042 } },
  fragmentShader: /* glsl */ `
    uniform vec3 color; uniform sampler2D tDiffuse; uniform float uBlur;
    varying vec4 vUv;
    #include <logdepthbuf_pars_fragment>
    float blendOverlay(float b, float l) { return b < 0.5 ? (2.0 * b * l) : (1.0 - 2.0 * (1.0 - b) * (1.0 - l)); }
    vec3 blendOverlay(vec3 b, vec3 l) { return vec3(blendOverlay(b.r, l.r), blendOverlay(b.g, l.g), blendOverlay(b.b, l.b)); }
    const vec2 P[12] = vec2[](
      vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
      vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893),
      vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      vec3 acc = texture2D(tDiffuse, uv).rgb;
      for (int i = 0; i < 12; i++) acc += texture2D(tDiffuse, uv + P[i] * uBlur).rgb;
      gl_FragColor = vec4(blendOverlay(acc / 13.0, color), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/* ── sơn Giallo (src/car.js, bỏ phần xước/đá văng): uGloss 0 sơn zin → 1 dưới phim; uSweep vệt sáng mũi → đuôi ── */
function makePaint(u) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xf2b200, metalness: 0.2, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.15 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uCarInv;\nvarying vec3 vCarPos;\nvarying vec3 vCarNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vCarPos = (uCarInv * modelMatrix * vec4(transformed, 1.0)).xyz;
        vCarNrm = normalize(mat3(uCarInv) * mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGloss; uniform float uSweep; uniform float uStudio; uniform float uForm;\nvarying vec3 vCarPos; varying vec3 vCarNrm;')
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        {
          // dưới phim màu sạch và đậm hơn, lớp bóng phẳng như gương; softbox trên đầu: nóc sáng, hông vàng sâu
          float gp = max(uGloss, 0.0);
          vec3 dc = material.diffuseContribution;
          vec3 dl = vec3(dot(dc, vec3(0.2126, 0.7152, 0.0722)));
          material.diffuseContribution = mix(dc, max(dl + (dc - dl) * 1.1, 0.0), gp);
          material.diffuseContribution *= mix(1.0, mix(0.58, 1.12, smoothstep(-0.35, 0.85, vCarNrm.y)), uForm);
          material.roughness *= mix(1.0, 0.8, gp);
          #ifdef USE_CLEARCOAT
            material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.0, gp);
          #endif
        }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        #ifdef USE_ENVMAP
        {
          float gpo = max(uGloss, 0.0);
          float boxW = uForm * uStudio * mix(0.4, 0.62, gpo);
          float soft = mix(0.12, 0.05, gpo);
          vec3 Vg = normalize(vViewPosition);
          float fg = pow(1.0 - clamp(dot(normal, Vg), 0.0, 1.0), 5.0);
          gl_FragColor.rgb += getIBLRadiance(Vg, normal, 0.0) * (0.02 + 0.4 * fg) * gpo;
          vec3 rw = inverseTransformDirection(reflect(-Vg, normal), viewMatrix);
          float ay = fwidth(rw.y) * 0.75 + 1e-4 + soft;
          float band = smoothstep(-0.05 - ay, -0.05 + ay, rw.y) * (1.0 - smoothstep(0.24 - ay, 0.24 + ay, rw.y));
          float ly = fwidth(rw.y) * 0.75 + 1e-4;
          float line = smoothstep(0.35 - ly, 0.35 + ly, rw.y) * (1.0 - smoothstep(0.39 - ly, 0.39 + ly, rw.y)) * gpo;
          float az = atan(rw.z, rw.x) * 0.63661977;
          float pa = fract(az + 0.5), pw = min(fwidth(az), fwidth(pa)) * 0.75 + 1e-4 + soft * 0.7;
          float panel = smoothstep(0.1 - pw, 0.1 + pw, pa) * (1.0 - smoothstep(0.86 - pw, 0.86 + pw, pa));
          float ox = abs(rw.x) / max(rw.y, 0.05), ow = fwidth(ox) * 0.75 + 1e-4 + soft * 0.9;
          float over = (smoothstep(0.2 - ow, 0.2 + ow, ox) - smoothstep(0.29 - ow, 0.29 + ow, ox)) * smoothstep(0.5, 0.56, rw.y);
          vec3 boxes = vec3(1.0, 0.98, 0.95) * ((band * 3.0 + line * 2.2) * panel + over * 2.6);
          gl_FragColor.rgb += boxes * (0.12 + 0.88 * fg) * boxW;
        }
        #endif
        if (uSweep > 0.0 && uSweep < 1.0) {
          float bz = mix(-3.2, 3.2, uSweep);
          float sb = exp(-pow((vCarPos.z - bz) * 3.2, 2.0));
          float fs = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 1.5);
          gl_FragColor.rgb += vec3(1.0, 0.97, 0.9) * sb * (0.18 + 0.7 * fs) * sin(3.14159 * uSweep);
        }`);
  };
  return m;
}

/* ── phim PPF trong suốt, mép cắt bắt sáng (src/v3/kit.js); mỗi miếng một vật liệu để loé sáng riêng khi chạm xe ── */
function makeFilm() {
  const u = { uAlpha: { value: 1 }, uEdge: { value: 0 }, uGlow: { value: 0 } };
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, envMapIntensity: 1.7,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEdge;\nvarying float vEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEdge = aEdge;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uAlpha; uniform float uEdge; uniform float uGlow; varying float vEdge;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        // uGlow: lúc bay trên nền tối, tấm phim phải bắt sáng mới thấy (ánh trắng ngà + viền sáng)
        float fr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 3.0);
        float edge = smoothstep(0.55, 1.0, vEdge);
        gl_FragColor.rgb += vec3(1.0, 0.97, 0.9) * (edge * (0.35 + 0.9 * uEdge) + uGlow * (0.05 + 0.4 * fr));
        gl_FragColor.a = clamp(0.05 + uGlow * 0.07 + fr * (0.42 + 0.2 * uGlow) + edge * (0.35 + 0.5 * uEdge), 0.0, 1.0) * uAlpha;`);
  };
  m.userData.u = u;
  return m;
}

/* các đỉnh nằm trên mép (cạnh chỉ thuộc một tam giác) */
function edgeAttr(geo) {
  const index = geo.index.array, n = geo.attributes.position.count;
  const count = new Map();
  for (let t = 0; t < index.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = index[t + k], b = index[t + ((k + 1) % 3)];
      const key = a < b ? a * 1e6 + b : b * 1e6 + a;
      count.set(key, (count.get(key) || 0) + 1);
    }
  }
  const edge = new Float32Array(n);
  count.forEach((c, key) => { if (c === 1) { edge[Math.floor(key / 1e6)] = 1; edge[key % 1e6] = 1; } });
  return new THREE.BufferAttribute(edge, 1);
}

export async function createCarIntro(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;     // giữ màu vàng Giallo đậm (ACES làm nhạt)
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = (() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 320;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(256, 150, 10, 256, 160, 330);
    grd.addColorStop(0, '#1c1f23'); grd.addColorStop(1, '#060708');
    g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  scene.environment = studioEnv(renderer);
  scene.fog = new THREE.Fog(BG, 14, 34);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);

  // sàn bóng + vùng tối dần ra mép + bóng dưới xe + quầng sáng quanh xe
  const overFloor = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
  const mirror = new Reflector(new THREE.PlaneGeometry(44, 44), { color: 0x5a5a5a, textureWidth: 512, textureHeight: 512, multisample: 0, shader: SOFT_REFLECTOR });
  mirror.rotation.x = -Math.PI / 2;
  const fade = new THREE.Mesh(new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ color: BG, transparent: true, depthWrite: false, alphaMap: radialTexture('rgb(140,140,140)', 'rgb(255,255,255)', 512), ...overFloor }));
  fade.rotation.x = -Math.PI / 2; fade.position.y = 0.01;
  const outer = new THREE.Mesh(new THREE.RingGeometry(14.9, 44, 64), new THREE.MeshBasicMaterial({ color: BG, ...overFloor }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = 0.01;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 12), new THREE.MeshBasicMaterial({
    map: radialTexture('rgba(255,244,226,1)', 'rgba(255,244,226,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.16, ...overFloor,
  }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.012;
  scene.add(mirror, fade, outer, pool);

  // bàn xoay: xe + miếng phim cùng quay; bóng xe quay theo
  const turn = new THREE.Group();
  scene.add(turn);
  const shadowTex = new THREE.TextureLoader().load('assets/car-shadow.jpg');
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 6.6), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { map: { value: shadowTex }, uStrength: { value: 0.96 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform float uStrength; varying vec2 vUv; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, pow(1.0 - texture2D(map, vUv).r, 1.1) * uStrength); }',
  }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.006;
  turn.add(shadow);

  const paintU = {
    uCarInv: { value: new THREE.Matrix4() }, uGloss: { value: 0 }, uSweep: { value: -1 }, uStudio: { value: 1 }, uForm: { value: 1 },
  };

  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const [carGltf, patGltf, layout] = await Promise.all([
    loader.loadAsync('assets/car-urus.glb'),
    loader.loadAsync('assets/ppf-patterns.glb'),
    fetch('assets/ppf-patterns.json').then((r) => r.json()),
  ]);
  draco.dispose();

  const car = carGltf.scene;
  car.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'Paint') o.material = makePaint(paintU);
    else if (o.name === 'Glass') o.material = new THREE.MeshPhysicalMaterial({ color: 0x020304, metalness: 0, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.86, envMapIntensity: 1.8 });
    else if (o.material) o.material.envMapIntensity = 1.15;
  });
  turn.add(car);

  // miếng phim: dáng uốn theo thân xe (toạ độ quanh tâm miếng); morph = dáng phẳng (ép lên mặt phẳng tiếp xúc)
  const pieces = new THREE.Group();
  turn.add(pieces);
  const zs = layout.panels.map((p) => p.rest[2]);
  const z0 = Math.min(...zs), z1 = Math.max(...zs);
  const panels = layout.panels.map((info, i) => {
    const obj = patGltf.scene.getObjectByName(info.name);
    const mesh = obj.isMesh ? obj : obj.getObjectByProperty('isMesh', true);
    const geo = mesh.geometry;
    const dir = new THREE.Vector3().fromArray(info.dir).normalize();
    const pos = geo.attributes.position, nrm = geo.attributes.normal, n = pos.count;
    const dPos = new Float32Array(n * 3), dNrm = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const d = pos.getX(v) * dir.x + pos.getY(v) * dir.y + pos.getZ(v) * dir.z;
      dPos[v * 3] = -dir.x * d; dPos[v * 3 + 1] = -dir.y * d; dPos[v * 3 + 2] = -dir.z * d;
      dNrm[v * 3] = dir.x - nrm.getX(v); dNrm[v * 3 + 1] = dir.y - nrm.getY(v); dNrm[v * 3 + 2] = dir.z - nrm.getZ(v);
    }
    geo.morphAttributes.position = [new THREE.BufferAttribute(dPos, 3)];
    geo.morphAttributes.normal = [new THREE.BufferAttribute(dNrm, 3)];
    geo.morphTargetsRelative = true;
    geo.setAttribute('aEdge', edgeAttr(geo));
    mesh.updateMorphTargets();
    mesh.morphTargetInfluences[0] = 1;
    mesh.material = makeFilm();
    mesh.renderOrder = 6;
    mesh.frustumCulled = false;
    mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
    mesh.visible = false;
    pieces.add(mesh);
    const rest = new THREE.Vector3().fromArray(info.rest);
    const r = Math.sin(i * 12.9898 + 4.1) * 43758.5453, rnd = r - Math.floor(r);
    const r2 = Math.sin(i * 78.233 + 1.7) * 12543.71, rnd2 = r2 - Math.floor(r2);
    const side = new THREE.Vector3(0, 1, 0).cross(dir);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    // bay tới từ xa ngoài thân xe, lơ lửng sát mặt sơn rồi ập vào; mũi xe chạm trước
    const land = T.fly0 + T.flight + ((rest.z - z0) / (z1 - z0)) * T.spread + rnd * 0.12;
    return {
      mesh, rest, u: mesh.material.userData.u, land,
      from: rest.clone().addScaledVector(dir, 3.2 + rnd * 1.4).addScaledVector(side, (rnd2 - 0.5) * 2.6).add(new THREE.Vector3(0, 1.2 + rnd2 * 1.0, 0)),
      hover: rest.clone().addScaledVector(dir, 0.42),
      spin: new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd - 0.5) * 2.2, (rnd2 - 0.5) * 2.6, (rnd - 0.5) * 1.6)),
    };
  });
  const lastLand = Math.max(...panels.map((p) => p.land));

  // khung hình: xe dài ~5,1 m quay quanh tâm; màn dọc (điện thoại) dùng góc rộng hơn và lùi xa cho đủ bề ngang
  const target = new THREE.Vector3(0, 0.72, 0);
  let W = 1, H = 1;
  function resize() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.75, Math.sqrt(3.2e6 / (W * H)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W / H < 0.9 ? 40 : 30;
    camera.updateProjectionMatrix();
  }
  const frameDist = () => {
    const tanV = Math.tan((camera.fov * Math.PI) / 360), tanH = tanV * camera.aspect;
    // khung ~5,5 m bề ngang quanh xe (phim bay vào từ ngoài khung); màn ngang thì chiều cao quyết định — lùi thêm 2,6 m
    // cho lúc mũi xe quay về phía máy quay không bị phình to và tràn khung
    return Math.max(2.75 / tanH, 1.75 / tanV + 2.6);
  };

  // một khung hình theo thời gian cảnh t (giây)
  const q = new THREE.Quaternion(), qI = new THREE.Quaternion(), tmp = new THREE.Vector3();
  function pose(t) {
    turn.rotation.y = Math.PI - 0.95 + t * 0.5;           // bắt đầu 3/4 đầu xe, quay dần sang hông
    const dist = frameDist() * (1.06 - 0.08 * smooth(clamp01(t / T.end)));
    const el = 0.2 - 0.06 * smooth(clamp01(t / T.end));
    camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist).add(target);
    camera.lookAt(target);

    for (const p of panels) {
      const t0 = p.land - T.flight;
      const k = (t - t0) / T.flight;                     // 0 → 1 trong lúc bay
      if (k <= 0) { p.mesh.visible = false; continue; }
      p.mesh.visible = true;
      if (k < 1) {
        // 0–0,72: bay vào, uốn dần theo thân xe; 0,72–1: ập vào
        const a = clamp01(k / 0.72), b = clamp01((k - 0.72) / 0.28);
        tmp.lerpVectors(p.from, p.hover, easeOut(a));
        p.mesh.position.copy(tmp).lerp(p.rest, easeIn(b));
        p.mesh.quaternion.slerpQuaternions(p.spin, qI, smooth(a));
        p.mesh.morphTargetInfluences[0] = 1 - smooth(clamp01((a - 0.2) / 0.7));
        p.u.uEdge.value = 1.0;
        p.u.uGlow.value = 1.0;
        p.u.uAlpha.value = smooth(clamp01(k / 0.15));
      } else {
        // chạm xe: mép loé sáng rồi tắt, phim trong dần như dán thật
        const s = t - p.land;
        p.mesh.position.copy(p.rest); p.mesh.quaternion.identity();
        p.mesh.morphTargetInfluences[0] = 0;
        p.u.uEdge.value = 1.8 * Math.exp(-s * 5) + 0.15 * Math.exp(-s * 1.2);
        p.u.uGlow.value = Math.exp(-s * 3);
        p.u.uAlpha.value = 0.12 + 0.88 * Math.exp(-s * 1.4);
      }
    }
    // phim dán xong: vệt sáng chạy mũi → đuôi, sơn bóng sâu lên
    const sw = (t - lastLand - 0.05) / T.sweep;
    paintU.uSweep.value = sw > 0 && sw < 1 ? sw : -1;
    paintU.uGloss.value = smooth(clamp01(sw));

    car.updateWorldMatrix(true, false);
    paintU.uCarInv.value.copy(car.matrixWorld).invert();
  }

  resize();
  pose(0);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);                         // dựng sẵn shader trước khi bấm START
  addEventListener('resize', resize);

  let raf = 0, done = null, t0 = 0;
  function frame(now) {
    const t = (now - t0) / 1000;
    pose(Math.min(t, T.end + 2));
    renderer.render(scene, camera);
    if (t >= T.end && done) { const d = done; done = null; d(); }
    raf = requestAnimationFrame(frame);
  }

  return {
    /** vẽ đúng khung hình ở giây t của cảnh (để xem thử từng nhịp) */
    seek(t) { pose(t); renderer.render(scene, camera); },
    /** chạy cảnh; xong khi phim đã dán và sơn bóng lên (khung hình vẫn chạy tới lúc dispose) */
    play() {
      return new Promise((res) => {
        done = res;
        t0 = performance.now();
        raf = requestAnimationFrame(frame);
        const skip = () => { if (done) { const d = done; done = null; d(); } };
        canvas.addEventListener('pointerdown', skip, { once: true });
      });
    },
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? [].concat(o.material) : [];
        mats.forEach((m) => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); });
      });
      scene.environment && scene.environment.dispose();
      scene.background && scene.background.dispose && scene.background.dispose();
      mirror.getRenderTarget && mirror.getRenderTarget().dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
