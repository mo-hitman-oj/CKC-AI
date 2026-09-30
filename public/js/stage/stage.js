// ============================================================================
//  CKC Concierge · 3D Stage
//  Owns the renderer, studio lighting, backdrop, gold dust, bloom and the
//  active "entity". The app drives it with:
//    setEntity('gold'|'crystal'|'classic')  setLayout('center'|'left')
//    setSignal({level,bass,mid,treble})     pulse(strength)   setMode(mode)
// ============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createStudioEnvironment } from './lib/env.js';
import { createBackdrop, createDust } from './lib/atmosphere.js';
import * as goldOrb from './entities/goldOrb.js';
import * as crystal from './entities/crystal.js';
import * as classic from './entities/classic.js';

const ENTITIES = { gold: goldOrb, crystal, classic };

// On-screen placement, as fractions of the viewport (x from left, y from top).
// `s` is size relative to the centre layout (entity Ø ≈ 42% of viewport height).
const LAYOUTS = {
  center: { x: 0.50, y: 0.44, s: 1.0, dim: 0 },
  left: { x: 0.24, y: 0.46, s: 0.85, dim: 1 },
};
const LAYOUT_SECONDS = 1.1;
const FOV = 30;
const CAM_Z = 12;
const VIEW_H = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2)); // world height at z=0
const BASE_RADIUS = 0.21 * VIEW_H; // world radius of a unit entity in 'center'

const easeInOutCubic = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOutBack = (k) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const easeInCubic = (k) => k * k * k;

export function createStage(container, { entity = 'gold' } = {}) {
  const flags = new Set(location.search.replace('?', '').split('&').map((f) => f.split('=')[0]));

  // --------------------------------------------------------------------------
  //  Renderer / camera / scene
  // --------------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060a);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  camera.lookAt(0, 0, 0);

  const env = createStudioEnvironment(renderer);

  const backdrop = createBackdrop();
  scene.add(backdrop.mesh);
  const dust = createDust(flags.has('nodust') ? 0 : 460);
  scene.add(dust.points);

  // The holder is what gets positioned/scaled; entities live inside it.
  const holder = new THREE.Group();
  scene.add(holder);

  // --------------------------------------------------------------------------
  //  Post-processing
  // --------------------------------------------------------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const useBloom = !flags.has('nobloom');

  // --------------------------------------------------------------------------
  //  Layout (camera view-offset keeps the entity on-axis → no perspective skew)
  // --------------------------------------------------------------------------
  let size = { w: 1, h: 1 };
  let layoutName = 'center';
  const lay = { from: { ...LAYOUTS.center }, to: { ...LAYOUTS.center }, t: 1, cur: { ...LAYOUTS.center } };

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    size = { w, h };
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    backdrop.uniforms.uAspect.value = w / h;
    applyLayout();
  }

  function applyLayout() {
    const { w, h } = size;
    const c = lay.cur;
    camera.setViewOffset(w, h, (0.5 - c.x) * w, (0.5 - c.y) * h, w, h);
    camera.updateProjectionMatrix();
    backdrop.uniforms.uCenter.value.set(c.x, 1 - c.y);
    backdrop.uniforms.uRadius.value = 0.40 * c.s;
    dust.uniforms.uRightDim.value = c.dim;
  }

  const ctx = {
    THREE, renderer, camera, env,
    pixelRatio: () => renderer.getPixelRatio(),
    viewScale: () => (size.h / 900) * lay.cur.s,
  };

  // --------------------------------------------------------------------------
  //  Entities + swap transition
  // --------------------------------------------------------------------------
  const cache = {};
  const getEntity = (name) => {
    if (!cache[name]) {
      const mod = ENTITIES[name] || ENTITIES.gold;
      cache[name] = mod.create(ctx);
    }
    return cache[name];
  };

  let current = null;
  let currentName = null;
  let swap = null; // { phase: 'out'|'in', t, next }
  let appear = 0;  // 0..1 scale factor applied by the swap

  function mount(name) {
    if (current) holder.remove(current.object);
    current = getEntity(name);
    currentName = name;
    holder.add(current.object);
  }

  // --------------------------------------------------------------------------
  //  Signal / pulse / mode envelopes
  // --------------------------------------------------------------------------
  const sig = { level: 0, bass: 0, mid: 0, treble: 0 };
  const target = { level: 0, bass: 0, mid: 0, treble: 0 };
  let lastSignal = -1;
  let pulseEnv = 0;
  let pendingImpulse = 0;
  let mode = 'idle';
  let modeT = 0;
  const w = { listen: 0, think: 0, speak: 0 };

  const clock = new THREE.Clock();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    modeT += dt;

    // Layout tween.
    if (lay.t < 1) {
      lay.t = Math.min(1, lay.t + dt / LAYOUT_SECONDS);
      const k = easeInOutCubic(lay.t);
      for (const key of ['x', 'y', 's', 'dim']) lay.cur[key] = lay.from[key] + (lay.to[key] - lay.from[key]) * k;
      applyLayout();
    }

    // Envelopes: fast attack, slower release; drop to 0 if the app stops feeding.
    if (t - lastSignal > 0.15) { target.level = target.bass = target.mid = target.treble = 0; }
    for (const key in sig) {
      const up = target[key] > sig[key];
      sig[key] += (target[key] - sig[key]) * Math.min(1, dt * (up ? 18 : 5));
    }
    pulseEnv *= Math.exp(-dt * 5);
    const impulse = pendingImpulse;
    pendingImpulse = 0;

    const lerpW = (cur, on) => cur + ((on ? 1 : 0) - cur) * Math.min(1, dt * 4);
    w.listen = lerpW(w.listen, mode === 'listening');
    w.think = lerpW(w.think, mode === 'thinking');
    w.speak = lerpW(w.speak, mode === 'speaking');

    // Entity swap.
    if (swap) {
      swap.t += dt;
      if (swap.phase === 'out') {
        const k = Math.min(1, swap.t / 0.32);
        appear = 1 - easeInCubic(k);
        if (k >= 1) { mount(swap.next); swap = { phase: 'in', t: 0 }; }
      } else {
        const k = Math.min(1, swap.t / 0.75);
        appear = Math.max(0.0001, easeOutBack(k));
        if (k >= 1) { swap = null; appear = 1; }
      }
    }

    // Place the entity: centred in world, the camera offset does the rest.
    const radius = BASE_RADIUS * lay.cur.s;
    holder.position.set(0, Math.sin(t * 0.55) * 0.05 * radius, 0);
    holder.scale.setScalar(radius * Math.max(0.0001, appear));

    const s = {
      level: sig.level, bass: sig.bass, mid: sig.mid, treble: sig.treble,
      pulse: pulseEnv, impulse,
      mode, modeT, listen: w.listen, think: w.think, speak: w.speak,
    };
    if (current) current.update(dt, t, s);

    backdrop.uniforms.uTime.value = t;
    backdrop.uniforms.uGlow.value = sig.level * 0.8 + pulseEnv * 0.4 + w.listen * 0.3;
    dust.uniforms.uTime.value = t;
    dust.uniforms.uLevel.value = sig.level;
    dust.uniforms.uPixel.value = renderer.getPixelRatio() * (size.h / 900);

    const swapFlash = swap && swap.phase === 'in' ? Math.max(0, 1 - swap.t / 0.6) * 0.5 : 0;
    const bp = (current && current.bloom) || { threshold: 0.82, strength: 0.45 };
    bloom.threshold = bp.threshold;
    bloom.strength = bp.strength + sig.level * 0.12 + pulseEnv * 0.15 + swapFlash;

    if (useBloom) composer.render();
    else renderer.render(scene, camera);
  }

  // --------------------------------------------------------------------------
  //  Public API
  // --------------------------------------------------------------------------
  const api = {
    setEntity(name) {
      if (!ENTITIES[name]) name = 'gold';
      if (name === currentName && !swap) return;
      if (swap && swap.next === name) return;
      getEntity(name); // compile ahead of the swap
      swap = { phase: 'out', t: 0, next: name };
    },
    setLayout(name, { instant = false } = {}) {
      const L = LAYOUTS[name];
      if (!L) return;
      layoutName = name;
      lay.from = { ...lay.cur };
      lay.to = { ...L };
      lay.t = 0;
      if (instant) { lay.t = 1; lay.cur = { ...L }; applyLayout(); }
    },
    setSignal({ level = 0, bass = 0, mid = 0, treble = 0 } = {}) {
      target.level = Math.min(1, Math.max(0, level));
      target.bass = Math.min(1, Math.max(0, bass));
      target.mid = Math.min(1, Math.max(0, mid));
      target.treble = Math.min(1, Math.max(0, treble));
      lastSignal = clock.elapsedTime;
    },
    pulse(strength = 0.5) {
      const s = Math.min(1, Math.max(0, strength));
      pulseEnv = Math.max(pulseEnv, s);
      pendingImpulse = Math.max(pendingImpulse, s);
    },
    setMode(m) {
      if (m === mode) return;
      mode = m;
      modeT = 0;
    },
    get entity() { return currentName; },
    get layout() { return layoutName; },
    _debug: () => ({ cur: { ...lay.cur }, t: lay.t, size, swap, appear }),
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      Object.values(cache).forEach((e) => e.dispose());
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };

  mount(ENTITIES[entity] ? entity : 'gold');
  appear = 1;

  // Warm up the other entities' shaders in the background so a later
  // setEntity() swap is instant instead of hitching on shader compilation.
  setTimeout(() => {
    for (const name of Object.keys(ENTITIES)) {
      if (name === currentName) continue;
      const e = getEntity(name);
      if (e.object.parent) continue;
      const tmp = new THREE.Scene();
      tmp.add(e.object);
      const done = () => tmp.remove(e.object);
      if (renderer.compileAsync) renderer.compileAsync(tmp, camera).then(done, done);
      else { renderer.compile(tmp, camera); done(); }
    }
  }, 1200);
  window.addEventListener('resize', resize);
  resize();
  frame();
  return api;
}
