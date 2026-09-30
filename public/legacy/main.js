// ============================================================================
//  CKC JEWELLERS · AI CONCIERGE
//  A luxury, audio-reactive faceted-diamond entity.
//  Three.js · OrbitControls · EffectComposer · UnrealBloomPass · Web Audio API
//
//  The diamond is rendered with a custom self-illuminated crystal shader
//  (fresnel rim + facet shading) rather than glass transmission, so its
//  brightness is fully bounded and it renders reliably on any GPU.
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { TRANSCRIPTS, IDLE_TAGLINE } from './transcripts.js';

// The diamond now lives inside the left panel, so it sizes to that container.
const DIAMOND_SCALE = 1.12;   // base scale (audio/breathe modulate around this)
const TARGET_Y = -0.45;       // look-axis below the diamond → lifts it up-of-centre

// ----------------------------------------------------------------------------
//  Renderer / Scene / Camera
// ----------------------------------------------------------------------------
const container = document.getElementById('scene');
const sizeOf = () => ({
  w: container.clientWidth || window.innerWidth,
  h: container.clientHeight || window.innerHeight,
});

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080808);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);

// ----------------------------------------------------------------------------
//  Controls — gentle cinematic orbit, very light user interaction.
// ----------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.045;
controls.enablePan = false;
controls.enableZoom = false;        // fixed framing inside the panel
controls.autoRotate = true;
controls.autoRotateSpeed = 0.30;
controls.target.set(0, TARGET_Y, 0);

// Fit the camera so the diamond sits nicely within the (often narrow) panel.
function fitCamera() {
  const { w, h } = sizeOf();
  camera.aspect = w / h;
  const halfH = 0.96 * DIAMOND_SCALE + Math.abs(TARGET_Y);
  const halfW = 1.04 * DIAMOND_SCALE;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const distV = halfH / Math.tan(vfov / 2) / 0.72;            // vertical headroom
  const distH = halfW / (Math.tan(vfov / 2) * camera.aspect) / 0.78; // horizontal margin
  const dist = Math.min(Math.max(distV, distH, 5.0), 11.0);
  camera.position.set(0, TARGET_Y, dist);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (typeof composer !== 'undefined') { composer.setSize(w, h); bloom.setSize(w, h); }
}

// ----------------------------------------------------------------------------
//  The Diamond — a programmatically faceted brilliant cut.
// ----------------------------------------------------------------------------
function buildBrilliantDiamond({
  segments = 18,
  girdleRadius = 1.0,
  tableRadius = 0.52,
  crownHeight = 0.46,
  girdleHeight = 0.07,
  pavilionDepth = 1.32,
} = {}) {
  const pos = [];
  const TAU = Math.PI * 2;
  const ang = (i) => (i / segments) * TAU;

  const tableY = girdleHeight / 2 + crownHeight;
  const gTopY = girdleHeight / 2;
  const gBotY = -girdleHeight / 2;
  const culet = [0, -pavilionDepth, 0];
  const tableCenter = [0, tableY, 0];

  const G = [], Gb = [], T = [];
  for (let i = 0; i < segments; i++) {
    const a = ang(i);
    const c = Math.cos(a), s = Math.sin(a);
    G.push([c * girdleRadius, gTopY, s * girdleRadius]);
    Gb.push([c * girdleRadius, gBotY, s * girdleRadius]);
    T.push([c * tableRadius, tableY, s * tableRadius]);
  }

  const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);

  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    tri(tableCenter, T[j], T[i]);          // table (flat top)
    tri(G[i], T[i], T[j]);                 // crown facets
    tri(G[i], T[j], G[j]);
    tri(G[i], G[j], Gb[j]);                // girdle band
    tri(G[i], Gb[j], Gb[i]);
    tri(Gb[i], Gb[j], culet);              // pavilion facets → culet
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals(); // non-indexed → crisp faceted normals
  geo.center();
  return geo;
}

const diamondGeo = buildBrilliantDiamond();

// --- Custom crystal shader: facet shading + fresnel rim, fully bounded ---
const diamondUniforms = {
  uTime: { value: 0 },
  uLevel: { value: 0 },
  uBase: { value: new THREE.Color(0x1a2740) },   // deep sapphire body
  uGlow: { value: new THREE.Color(0xaad6ff) },   // blue-white rim
  uGold: { value: new THREE.Color(0xe7c585) },   // warm inner accent
};
const diamondMat = new THREE.ShaderMaterial({
  uniforms: diamondUniforms,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: true,
  vertexShader: /* glsl */`
    varying vec3 vN;
    varying vec3 vV;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime; uniform float uLevel;
    uniform vec3 uBase; uniform vec3 uGlow; uniform vec3 uGold;
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 N = normalize(vN);
      vec3 V = normalize(vV);
      // Two soft key directions so facets catch light as it rotates.
      vec3 L1 = normalize(vec3(0.55, 0.85, 0.6));
      vec3 L2 = normalize(vec3(-0.6, -0.25, 0.5));
      float d1 = max(dot(N, L1), 0.0);
      float d2 = max(dot(N, L2), 0.0);
      float facet = 0.22 + 0.62 * d1 + 0.32 * d2;

      // Crisp specular glints on individual facets.
      float spec = pow(max(dot(reflect(-L1, N), V), 0.0), 48.0);
      float spec2 = pow(max(dot(reflect(-L2, N), V), 0.0), 90.0);

      // Fresnel rim — brighter at glancing edges (transparent-edge feel).
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

      vec3 col = uBase * facet;
      col += uGold * pow(d2, 2.0) * 0.30;
      col += uGlow * fres * (0.60 + uLevel * 0.75);
      col += vec3(1.0) * spec * (0.50 + uLevel * 0.55);
      col += uGlow * spec2 * (0.40 + uLevel * 0.50);
      col *= (0.85 + uLevel * 0.35);

      float alpha = clamp(0.50 + fres * 0.5 + facet * 0.25, 0.0, 1.0);
      gl_FragColor = vec4(col, alpha);
    }`,
});

const diamond = new THREE.Mesh(diamondGeo, diamondMat);
diamond.scale.setScalar(DIAMOND_SCALE);

// Faint glowing facet edges accentuate the cut.
const edgeGeo = new THREE.EdgesGeometry(diamondGeo, 18);
const edgeMat = new THREE.LineBasicMaterial({
  color: 0xcfe6ff,
  transparent: true,
  opacity: 0.16,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const diamondEdges = new THREE.LineSegments(edgeGeo, edgeMat);
diamond.add(diamondEdges);

// The whole entity floats / breathes as one group.
const entity = new THREE.Group();
entity.add(diamond);
scene.add(entity);

// ----------------------------------------------------------------------------
//  Internal light caustics — a glowing core + drifting inner sparks.
// ----------------------------------------------------------------------------
const coreUniforms = {
  uTime: { value: 0 },
  uLevel: { value: 0 },
  uColor: { value: new THREE.Color(0x9fd0ff) },
};
const coreMat = new THREE.ShaderMaterial({
  uniforms: coreUniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide,
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime; uniform float uLevel; uniform vec3 uColor;
    varying vec3 vN; varying vec3 vV;
    void main(){
      float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.4);
      float pulse = 0.55 + 0.45 * sin(uTime * 1.4);
      float glow = fres * (0.38 + pulse * 0.40) + 0.08;
      glow *= (0.45 + uLevel * 0.9);
      gl_FragColor = vec4(uColor * glow, glow * 0.75);
    }`,
});
const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), coreMat);
diamond.add(core);

// Soft pinpoint at the heart → drives a gentle bloom kernel.
const heartMat = new THREE.MeshBasicMaterial({
  color: 0xcfe9ff, transparent: true, opacity: 0.55,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const heart = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), heartMat);
diamond.add(heart);

// Drifting inner caustic sparks (refracted light bouncing inside).
const sparkCount = 24;
const sparkPos = new Float32Array(sparkCount * 3);
const sparkPhase = new Float32Array(sparkCount);
for (let i = 0; i < sparkCount; i++) {
  const r = 0.16 + Math.random() * 0.5;
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(2 * Math.random() - 1);
  sparkPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
  sparkPos[i * 3 + 1] = r * Math.cos(ph);
  sparkPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  sparkPhase[i] = Math.random() * Math.PI * 2;
}
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
sparkGeo.setAttribute('aPhase', new THREE.BufferAttribute(sparkPhase, 1));
const sparkMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uLevel: { value: 0 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uTime; uniform float uLevel;
    attribute float aPhase; varying float vT;
    void main(){
      vec3 p = position;
      float t = uTime * 0.8 + aPhase;
      p += 0.06 * vec3(sin(t*1.3), cos(t*1.1), sin(t*0.9));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vT = 0.5 + 0.5 * sin(uTime * 3.0 + aPhase * 6.2831);
      gl_PointSize = (4.0 + 13.0 * vT * (0.5 + uLevel * 1.5)) * (3.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    varying float vT;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vec3(0.85, 0.94, 1.0), a * vT * 0.9);
    }`,
});
const sparks = new THREE.Points(sparkGeo, sparkMat);
diamond.add(sparks);

// ----------------------------------------------------------------------------
//  Floating golden particles + fine sparkles.
// ----------------------------------------------------------------------------
function makeParticleField(count, { rMin, rMax, color, baseSize }) {
  const positions = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const scale = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
    positions[i * 3 + 1] = r * Math.cos(ph) * 0.7;
    positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    phase[i] = Math.random() * Math.PI * 2;
    scale[i] = 0.5 + Math.random() * 0.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uSize: { value: baseSize },
      uColor: { value: new THREE.Color(color) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uLevel; uniform float uSize;
      attribute float aPhase; attribute float aScale;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        float t = uTime * 0.12 + aPhase;
        p.y += sin(t) * 0.34;
        p.x += cos(t * 0.8) * 0.22;
        p.z += sin(t * 0.6) * 0.22;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float twinkle = 0.55 + 0.45 * sin(uTime * 1.8 + aPhase * 6.2831);
        vAlpha = twinkle * (0.4 + uLevel * 0.85);
        float size = uSize * aScale * (1.0 + uLevel * 1.7) * (0.7 + twinkle * 0.6);
        gl_PointSize = size * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a = pow(a, 1.5);
        gl_FragColor = vec4(uColor, a * vAlpha);
      }`,
  });

  return new THREE.Points(geo, mat);
}

const goldField = makeParticleField(1300, { rMin: 1.9, rMax: 6.2, color: 0xe7c585, baseSize: 7.0 });
const sparkleField = makeParticleField(420, { rMin: 1.6, rMax: 5.4, color: 0xffffff, baseSize: 4.0 });
const particleGroup = new THREE.Group();
particleGroup.add(goldField, sparkleField);
scene.add(particleGroup);

// ----------------------------------------------------------------------------
//  Expanding energy rings — spawned on loud / percussive moments.
// ----------------------------------------------------------------------------
const RING_POOL = 6;
const rings = [];
for (let i = 0; i < RING_POOL; i++) {
  const geo = new THREE.RingGeometry(0.92, 1.0, 96);
  const mat = new THREE.MeshBasicMaterial({
    color: i % 2 === 0 ? 0xe7c585 : 0xbfe2ff,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  scene.add(mesh);
  rings.push({ mesh, alive: false, age: 0, life: 1.6, power: 0 });
}

function spawnRing(strength) {
  const slot = rings.find((r) => !r.alive);
  if (!slot) return;
  slot.alive = true;
  slot.age = 0;
  slot.life = 1.4 + Math.random() * 0.5;
  slot.power = strength;
  slot.mesh.visible = true;
  slot.mesh.quaternion.copy(camera.quaternion);
  slot.mesh.scale.setScalar(1.0);
}

function updateRings(dt) {
  for (const r of rings) {
    if (!r.alive) continue;
    r.age += dt;
    const k = r.age / r.life;
    if (k >= 1) { r.alive = false; r.mesh.visible = false; continue; }
    const s = 1.6 + k * (5.0 + r.power * 3.0);
    r.mesh.scale.setScalar(s);
    r.mesh.quaternion.copy(camera.quaternion);
    r.mesh.material.opacity = (1 - k) * (0.08 + r.power * 0.26) * Math.sin(k * Math.PI);
  }
}

// ----------------------------------------------------------------------------
//  Post-processing — UnrealBloom, tuned so only highlights bloom.
// ----------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(sizeOf().w, sizeOf().h),
  0.55, // strength (was washing out at 0.85 + huge lights)
  0.45, // radius
  0.55  // threshold — only bright rim/core/particles bloom
);
composer.addPass(bloom);

// Now that the composer exists, size everything to the left panel.
fitCamera();

// ----------------------------------------------------------------------------
//  Web Audio API — real spectrum analysis drives every reaction.
// ----------------------------------------------------------------------------
let audioCtx = null;
let analyser = null;
let freqData = null;
let timeData = null;
let currentAudio = null;

function ensureAudioGraph(audioEl) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.frequencyBinCount);
    analyser.connect(audioCtx.destination);
  }
  if (audioEl._srcNode) return;
  const node = audioCtx.createMediaElementSource(audioEl);
  node.connect(analyser);
  audioEl._srcNode = node;
}

const audioState = { level: 0, bass: 0, mid: 0, treble: 0, ringCooldown: 0 };

function sampleAudio(dt) {
  if (audioState.ringCooldown > 0) audioState.ringCooldown -= dt;

  if (!analyser || !currentAudio || currentAudio.paused) {
    const k = Math.min(1, dt * 2.4);
    audioState.level += (0 - audioState.level) * k;
    audioState.bass += (0 - audioState.bass) * k;
    audioState.mid += (0 - audioState.mid) * k;
    audioState.treble += (0 - audioState.treble) * k;
    return;
  }

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bins = freqData.length;
  const bandAvg = (a, b) => {
    let s = 0;
    const lo = Math.floor(bins * a), hi = Math.floor(bins * b);
    for (let i = lo; i < hi; i++) s += freqData[i];
    return s / Math.max(1, hi - lo) / 255;
  };

  const bass = bandAvg(0.0, 0.10);
  const mid = bandAvg(0.10, 0.42);
  const treble = bandAvg(0.42, 0.85);

  let rms = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    rms += v * v;
  }
  rms = Math.sqrt(rms / timeData.length);
  const target = Math.min(1, rms * 3.0);

  const lerp = (cur, tgt, up, down) => cur + (tgt - cur) * Math.min(1, dt * (tgt > cur ? up : down));
  audioState.level = lerp(audioState.level, target, 16, 5);
  audioState.bass = lerp(audioState.bass, bass, 18, 6);
  audioState.mid = lerp(audioState.mid, mid, 16, 6);
  audioState.treble = lerp(audioState.treble, treble, 18, 7);

  if (audioState.bass > 0.40 && bass > audioState.bass * 1.04 && audioState.ringCooldown <= 0) {
    spawnRing(audioState.bass);
    audioState.ringCooldown = 0.16;
  }
}

// ----------------------------------------------------------------------------
//  UI wiring — language toggle, tap-to-speak, and synced captions.
// ----------------------------------------------------------------------------
const langButtons = Array.from(document.querySelectorAll('.lang-btn'));
const tapSpeak = document.getElementById('tapSpeak');
const tapLabel = document.getElementById('tapLabel');
const micBtn = document.getElementById('micBtn');
const subline = document.getElementById('subline');

let currentLang = 'english';
const audioCache = new Map();

function getAudio(lang) {
  const src = TRANSCRIPTS[lang].audio;
  if (!audioCache.has(src)) {
    const el = new Audio(src);
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    audioCache.set(src, el);
  }
  return audioCache.get(src);
}

// Caption reveal: weight each line by its length so it advances with the voice.
function buildCaptionPlan(lang) {
  const lines = TRANSCRIPTS[lang].lines;
  const lens = lines.map((l) => Math.max(8, l.length));
  const total = lens.reduce((a, b) => a + b, 0);
  let acc = 0;
  return lines.map((text, i) => {
    const start = acc / total;
    acc += lens[i];
    return { text, start, end: acc / total };
  });
}
let captionPlan = buildCaptionPlan(currentLang);

function setCaption(text, live) {
  if (subline.textContent === text && subline.classList.contains('live') === live) return;
  subline.style.opacity = '0';
  subline.style.transform = 'translateY(6px)';
  setTimeout(() => {
    subline.textContent = text;
    subline.classList.toggle('live', live);
    subline.style.opacity = '1';
    subline.style.transform = 'translateY(0)';
  }, 160);
}

function updateCaption() {
  if (!currentAudio || currentAudio.paused) { setCaption(IDLE_TAGLINE, false); return; }
  const dur = currentAudio.duration || 1;
  const p = Math.min(0.999, currentAudio.currentTime / dur);
  const cur = captionPlan.find((c) => p >= c.start && p < c.end) || captionPlan[captionPlan.length - 1];
  setCaption(cur.text, true);
}

function setSpeakingUI(on) {
  tapSpeak.classList.toggle('speaking', on);
  tapLabel.textContent = on ? 'Speaking…' : 'Tap to speak';
}

function selectLang(lang, { play = false } = {}) {
  currentLang = lang;
  captionPlan = buildCaptionPlan(lang);
  langButtons.forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  if (play) startSpeaking();
  else if (!currentAudio || currentAudio.paused) setCaption(IDLE_TAGLINE, false);
  else { stopSpeaking(); }
}

function stopSpeaking() {
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
  setSpeakingUI(false);
  setCaption(IDLE_TAGLINE, false);
}

async function startSpeaking() {
  const audioEl = getAudio(currentLang);
  ensureAudioGraph(audioEl);
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  // Toggle off if this exact clip is already playing.
  if (currentAudio === audioEl && !audioEl.paused) { stopSpeaking(); return; }

  if (currentAudio && currentAudio !== audioEl) { currentAudio.pause(); currentAudio.currentTime = 0; }
  currentAudio = audioEl;
  setSpeakingUI(true);

  audioEl.ontimeupdate = updateCaption;
  audioEl.onended = () => { if (currentAudio === audioEl) { setSpeakingUI(false); setCaption(IDLE_TAGLINE, false); } };

  try {
    audioEl.currentTime = 0;
    await audioEl.play();
    updateCaption();
  } catch (err) {
    console.error('Playback failed:', err);
    setSpeakingUI(false);
    setCaption('Unable to play audio', false);
  }
}

langButtons.forEach((b) =>
  b.addEventListener('click', () => {
    const wasSpeaking = currentAudio && !currentAudio.paused;
    selectLang(b.dataset.lang, { play: wasSpeaking });
  })
);
tapSpeak.addEventListener('click', startSpeaking);
micBtn.addEventListener('click', startSpeaking);

// ----------------------------------------------------------------------------
//  Animation loop.
// ----------------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  sampleAudio(dt);
  const level = DBG.has('loud') ? 0.9 : audioState.level;
  const bass = DBG.has('loud') ? 0.7 : audioState.bass;

  // --- Idle motion: slow rotation, float, breathe, periodic pulse ---
  diamond.rotation.y += dt * (0.18 + level * 0.7);
  diamond.rotation.x = Math.sin(t * 0.22) * 0.10;

  entity.position.y = Math.sin(t * 0.55) * 0.10;
  const breathe = 1 + Math.sin(t * 0.9) * 0.018;
  const pulse = Math.pow(Math.max(0, Math.sin(t * 0.7)), 6) * 0.05;
  diamond.scale.setScalar(DIAMOND_SCALE * breathe * (1 + pulse) * (1 + level * 0.26 + bass * 0.08));

  // --- Diamond shader reacts to the voice ---
  diamondUniforms.uTime.value = t;
  diamondUniforms.uLevel.value = level;

  // --- Internal caustics ---
  coreUniforms.uTime.value = t;
  coreUniforms.uLevel.value = level;
  core.rotation.y -= dt * 0.25;
  core.rotation.z += dt * 0.12;
  sparkMat.uniforms.uTime.value = t;
  sparkMat.uniforms.uLevel.value = level;
  heart.scale.setScalar(0.7 + level * 0.9 + pulse * 2.2);
  heartMat.opacity = 0.22 + level * 0.30;

  // --- Particles drift always; surge while speaking ---
  goldField.material.uniforms.uTime.value = t;
  goldField.material.uniforms.uLevel.value = level;
  sparkleField.material.uniforms.uTime.value = t;
  sparkleField.material.uniforms.uLevel.value = level * 1.2;
  particleGroup.rotation.y += dt * (0.012 + level * 0.05);
  particleGroup.rotation.x = Math.sin(t * 0.1) * 0.04;

  // --- Rings ---
  updateRings(dt);

  // --- Bloom tracks loudness (bounded) ---
  bloom.strength = 0.45 + level * 0.45 + pulse * 0.5;

  controls.update();
  if (DBG.has('nobloom')) renderer.render(scene, camera);
  else composer.render();
}

// Debug flags via ?nobloom / ?noparticles / ?nocore (development only).
const DBG = new Set(location.search.replace('?', '').split('&'));
if (DBG.has('noparticles')) particleGroup.visible = false;
if (DBG.has('nocore')) { core.visible = false; heart.visible = false; sparks.visible = false; }

// ----------------------------------------------------------------------------
//  Resize handling — re-fit to the left panel.
// ----------------------------------------------------------------------------
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitCamera, 80);
});

// ----------------------------------------------------------------------------
//  Reveal once everything is ready.
// ----------------------------------------------------------------------------
const veil = document.getElementById('veil');
setCaption(IDLE_TAGLINE, false);
animate();
setTimeout(() => veil.classList.add('hidden'), 700);
