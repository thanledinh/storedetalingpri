import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

// (in storedetalingpri there is no bundler: the files sit in web/assets/ppf911/, the Draco decoder comes from the CDN of
// the importmap's three)
const BASE = new URL('../assets/ppf911/', import.meta.url).href;

export const loadingManager = THREE.DefaultLoadingManager;

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/draco/gltf/');
export const gltfLoader = new GLTFLoader().setDRACOLoader(draco);
// Bump when re-exporting models or the kit from Blender, so browsers never serve a stale GLB (nor a cached kit glb
// with a newer patterns.json).
const ASSET_VERSION = 14;
export const asset = (p) => `${BASE}${p}?v=${ASSET_VERSION}`;
export const hdrLoader = new HDRLoader();

/** Soft radial gradient texture (white center → transparent edge), for shadows and fades. */
export function radialTexture(inner = 'rgba(0,0,0,1)', outer = 'rgba(0,0,0,0)', size = 256, stop = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, size * stop * 0.5, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Shared GLSL: distance to the nearest hex edge, 0 at cell centre → 1 on the edge. */
export const HEX_GLSL = /* glsl */ `
float hexEdge(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(g);
  float d = max(dot(q, normalize(s)), q.x);
  return smoothstep(0.43, 0.5, d);
}
`;

export const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// (storedetalingpri) a light frame for Android phones with little RAM, which may drop the WebGL context of a scene this
// heavy (the car vanishes, the page lives on): lower resolution, no MSAA (FXAA instead), a smaller shadow map and a
// lighter ground bake. Not on iPhone: it looked soft there, and the owner prefers sharp (the page rebuilds the car if
// iOS drops it anyway). ?lite=1 / ?lite=0 forces it on / off.
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const liteParam = new URLSearchParams(location.search).get('lite');
export const lite = liteParam ? liteParam === '1' : !isIOS && isTouch && (navigator.deviceMemory || 8) <= 4;
