import * as THREE from 'three';
import gsap from 'gsap';
import { asset, hdrLoader, isTouch, lite } from '../studio.js';
import { loadCar, createUniforms } from '../car.js';
import { createKit } from './kit.js';
import { SF, patchShading, sfScope, addSfLights, createSfPost, bakeGroundAO } from './sflook.js';

const TAU = Math.PI * 2;

// The film going onto the car, lifted out of storedetailing's page (son-wowww, src/v3/stage.js): one full turn round
// the 911 with its PPF kit in the air, then the pieces settle onto the paint under a sweep of light and the paint goes
// deeper and glossier. Same car, kit, panorama, lights, shading and post-processing as the page (car.js, kit.js and
// sflook.js are the page's own files, unchanged), so the colours come out the same to the pixel. Every number below is
// the page's: change one and the picture no longer matches it.
const BG = 0x303030;
const HDRI = 'textures/trinitatis.hdr';
const CAR_T = new THREE.Vector3(0, 0.72, 0);
// the page's story seconds this piece covers: the turn (orbit) and the film settling (apply), up to the swirl test
const T = { orbit: 13.1, apply: 16.6, end: 18.5 };
export const SEGMENT = { start: T.orbit, end: T.end, duration: T.end - T.orbit };
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// sflook.js's patchShading rewrites three's shader chunks, once per page (a second pass would patch them twice); only
// the materials of this scene take Sketchfab's shading from them (sfScope), any other three scene keeps three's
let patched = false;

/**
 * canvas: the canvas to draw into (sized by CSS; the frame follows its size). shift: how far (fraction of the width)
 * the picture slides right, as the page does to leave a left column to its copy (0.11 there); 0 keeps the car centred.
 * Returns { ready, setTime(seconds in SEGMENT), setProgress(0..1), render(seconds), resize(), dispose() }: set the
 * time, then render a frame (seconds: a running clock, for the film's float and the grain).
 */
export function createPpfScene({ canvas, shift = 0 }) {
  // (no multisampling or depth on the canvas itself: only the post's last full-screen pass is drawn onto it, so they
  // would change no pixel and cost a phone tens of MB)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, depth: false, powerPreference: 'high-performance' });
  // the frame goes through half-float targets and the ground's occlusion bakes into float ones (sflook.js): without
  // them the stage shows its failure message instead
  if (!renderer.extensions.has('EXT_color_buffer_float')) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw new Error('ppf-scene: this GPU cannot render to float targets');
  }
  // resolution: the screen's own up to 1.75x, within a budget of pixels, lowered a step at a time on a device that
  // can't keep up (govern)
  // (lite, studio.js: 1.25x and 1.6 MP at most)
  const DPR_MAX = lite ? 1.25 : 1.75, PIXELS_MAX = lite ? 1.6e6 : 4.2e6;
  let dpr = 1, dprCap = DPR_MAX, dprFloor = 1;
  if (!patched) {
    patchShading();
    patched = true;
  }
  const sfPost = createSfPost(renderer);
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;             // (the car and its light never move: drawn once, when ready)

  const scene = new THREE.Scene();
  // the background: one sRGB texel, drawn rather than cleared to (a clear colour reaches the post a hair different)
  scene.background = new THREE.DataTexture(new Uint8Array([(BG >> 16) & 255, (BG >> 8) & 255, BG & 255, 255]), 1, 1);
  scene.background.colorSpace = THREE.SRGBColorSpace;
  scene.background.needsUpdate = true;
  scene.environmentIntensity = SF.envIntensity;
  scene.environmentRotation.y = SF.envRotation;
  scene.fog = new THREE.Fog(BG, 14, 34);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 120);

  const envReady = hdrLoader.loadAsync(asset(HDRI)).then((tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
  });

  // the ground's occlusion under the car, baked once it has loaded
  const carShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { map: { value: null }, uStrength: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform float uStrength; varying vec2 vUv; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, pow(1.0 - texture2D(map, vUv).r, 1.1) * uStrength); }',
  }));
  carShadow.rotation.x = -Math.PI / 2;
  scene.add(carShadow);
  const groundAO = (g) => {
    carShadow.material.uniforms.map.value = g.texture;
    carShadow.position.set(g.rect.x, 0.004, g.rect.y);
    carShadow.scale.set(g.rect.z, g.rect.w, 1);
  };
  addSfLights(scene, new THREE.Vector3(0, 0.65, 0));

  const uniforms = createUniforms();
  const kit = createKit();
  const noPlotter = { carriage: null, roll: null };
  let car = null, tl = null;
  const cam = { tx: 0, ty: 0, tz: 0, az: 0, el: 0, dist: 1, lens: 35 };
  const look = { gloss: 0, sweep: 0 };

  const ready = Promise.all([loadCar(uniforms), kit.ready, envReady]).then(async ([c]) => {
    car = c;
    scene.add(c.root);
    c.root.updateMatrixWorld(true);
    uniforms.uCarInv.value.copy(c.root.matrixWorld).invert();
    // the car casts its light's shadows on itself (not through its glass); the ground takes its baked occlusion
    c.root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !o.material.transparent;
      o.receiveShadow = true;
    });
    groundAO(bakeGroundAO(renderer, c.root, lite ? { size: 256, rays: 48, steps: 20 } : undefined));
    scene.add(kit.rig, kit.pieces);
    sfScope(scene);                                    // (a material added or cloned after this needs it again)
    buildTimeline();
    await warmUp();
  });

  // every material compiled for the post's linear target, the shadow map drawn once, then a frame at each stage so
  // meshes and textures are on the GPU before the first real one
  async function warmUp() {
    apply();
    kit.pieces.visible = true;
    renderer.setRenderTarget(sfPost.hdr);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    const tiny = new THREE.WebGLRenderTarget(1, 1);
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(tiny);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    tiny.dispose();
    for (const t of [13.5, 16.9, 17.6, T.orbit]) {
      setTime(t);
      render(t);
    }
    gov.sum = gov.n = 0;
  }

  // ---- sizing (as the page: the camera's lens keeps its framing on any frame shape)
  let W = 1, H = 1;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w;
    H = h;
    dprFloor = Math.min(1, Math.max(0.75, Math.sqrt(2.1e6 / (W * H))));
    dpr = Math.min(window.devicePixelRatio, Math.max(dprFloor, Math.min(dprCap, Math.max(1, Math.sqrt(PIXELS_MAX / (W * H))))));
    if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    renderer.getDrawingBufferSize(uniforms.uRes.value);
    sfPost.setSize(uniforms.uRes.value.x, uniforms.uRes.value.y, dpr);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  window.addEventListener('resize', resize);

  // ---- pointer parallax
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  const onLeave = () => { pointer.x = pointer.y = 0; };
  const host = canvas.parentElement;
  if (!isTouch) {
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
  }

  // ---- camera: a target + orbit (az, el, dist) + lens
  const fitFov = (lensMm) => {
    const A = W / H;
    const tanH = 18 / lensMm, tanV = (tanH * 9) / 16;
    let need = tanV;
    if (A < 16 / 9) {
      const keep = A >= 1 ? 1 : 0.64 + 0.36 * clamp01((A - 0.5) / 0.5);
      need = Math.max(tanV, (tanH * keep) / A);
    }
    return (2 * Math.atan(need) * 180) / Math.PI;
  };
  const eye = new THREE.Vector3(), target = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();

  function apply() {
    camera.fov = fitFov(cam.lens);
    const dist = cam.dist;
    target.set(cam.tx, cam.ty, cam.tz);
    eye.set(Math.sin(cam.az) * Math.cos(cam.el), Math.sin(cam.el), Math.cos(cam.az) * Math.cos(cam.el)).multiplyScalar(dist).add(target);
    camera.position.copy(eye);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    right.setFromMatrixColumn(camera.matrix, 0);
    up.setFromMatrixColumn(camera.matrix, 1);
    camera.position.addScaledVector(right, pointer.sx * dist * 0.03).addScaledVector(up, -pointer.sy * dist * 0.018);
    camera.lookAt(target);
    const s = shift * (1 + 1.2 * (1 - Math.min(1, W / H / (16 / 9))));
    if (Math.abs(s) > 0.0005) camera.setViewOffset(W, H, -s * W, 0, W, H);
    else if (camera.view) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    scene.fog.near = dist + 4;
    scene.fog.far = dist + 22;
    uniforms.uGloss.value = look.gloss;
    uniforms.uSweep.value = look.sweep;
  }

  // ---- the story: the page's own shots and timings
  const shotFrom = (e, t, lens, ref) => {
    const d = e.clone().sub(t);
    const dist = d.length();
    const el = Math.asin(d.y / dist);
    let az = Math.atan2(d.x, d.z);
    if (ref !== undefined) az += Math.round((ref - az) / TAU) * TAU;
    return { tx: t.x, ty: t.y, tz: t.z, az, el, dist, lens };
  };
  function buildTimeline() {
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const orbit0 = shotFrom(CAR_T.clone().add(v3(-1.4, 0.62, 1.5).setLength(9.6)), CAR_T, 32);
    const turned = orbit0.az + TAU;
    const applyShot = shotFrom(CAR_T.clone().add(v3(-6.3, 1.15, -7.9)), CAR_T, 34, turned);
    // where the page is as the turn starts: the kit cut, flown and in the air round the car, the paint still factory
    Object.assign(cam, orbit0);
    Object.assign(kit.state, { show: 0, cut: 1, push: 1, lift: 1, fly: 1, merge: 0, alpha: 1, edge: 1 });
    Object.assign(look, { gloss: 0, sweep: 0 });
    tl = gsap.timeline({ paused: true, defaults: { ease: 'power1.inOut' } });
    tl
      // one full turn round the car with the film in the air
      .to(cam, { az: turned, duration: 3.5, ease: 'sine.inOut' }, T.orbit)
      .to(cam, { el: orbit0.el + 0.12, duration: 1.75, ease: 'sine.inOut', yoyo: true, repeat: 1 }, T.orbit)
      // the film settles: under a sweep of light the paint goes deeper and glossier
      .to(cam, { ...applyShot, duration: 1.2 }, T.apply)
      .to(kit.state, { merge: 1, duration: 1.4 }, T.apply + 0.05)
      .fromTo(look, { sweep: 0 }, { sweep: 1, duration: 1.3, ease: 'none' }, T.apply + 0.45)
      .to(look, { gloss: 1, duration: 1.2 }, T.apply + 0.55)
      .to(kit.state, { edge: 0, alpha: 0, duration: 0.6 }, T.apply + 1.3)
      .to({}, { duration: 0.01 }, T.end - 0.01);
    tl.time(T.orbit);
  }

  const setTime = (t) => {
    if (tl) tl.time(Math.min(T.end, Math.max(T.orbit, t)));
  };
  const setProgress = (p) => setTime(T.orbit + clamp01(p) * SEGMENT.duration);

  // A device that can't keep up (frames slower than ~29 fps over 60 frames) drops resolution a step at a time
  const gov = { last: 0, sum: 0, n: 0 };
  const govern = () => {
    const now = performance.now(), dt = now - gov.last;
    gov.last = now;
    if (dt <= 0 || dt > 150) {
      gov.sum = gov.n = 0;
      return;
    }
    gov.sum += dt;
    if (++gov.n < 60) return;
    const avg = gov.sum / gov.n;
    gov.sum = gov.n = 0;
    if (avg > 34 && dpr > dprFloor + 0.01) {
      dprCap = Math.max(dprFloor, dpr - (avg > 50 ? 0.5 : 0.25));
      W = H = 0;
      resize();
    }
  };

  const render = (seconds) => {
    if (!car || !tl) return;
    govern();
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;
    uniforms.uTime.value = seconds;
    apply();
    kit.update(seconds, noPlotter, 0.0022);
    sfPost.render(scene, camera, performance.now() / 1000, true);
  };

  const dispose = () => {
    ro.disconnect();
    window.removeEventListener('resize', resize);
    host.removeEventListener('pointermove', onMove);
    host.removeEventListener('pointerleave', onLeave);
    tl?.kill();
    renderer.dispose();
    renderer.forceContextLoss();                       // (frees every target and texture of the context at once)
  };

  return { ready, setTime, setProgress, render, resize, dispose, debug: { scene, camera, renderer, cam, look, kit } };
}
