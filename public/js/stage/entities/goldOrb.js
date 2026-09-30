// ============================================================================
//  Molten Gold Orb — liquid-metal sphere whose surface flows like molten gold
//  and ripples outward on every spoken word. A fine jeweller's ring of
//  diamond glints orbits it.
// ============================================================================
import * as THREE from 'three';
import { SIMPLEX3D } from '../lib/noise.js';

const MAX_RIPPLES = 6;

export function create(ctx) {
  const root = new THREE.Group();

  // --------------------------------------------------------------------------
  //  The orb
  // --------------------------------------------------------------------------
  const u = {
    uTime: { value: 0 },
    uAmp: { value: 0.03 },
    uFreq: { value: 1.25 },
    uFlow: { value: 0.16 },
    uDetail: { value: 0 },
    uRip: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 1, 99)) },
    uRipS: { value: new Float32Array(MAX_RIPPLES) },
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffd27f'),
    metalness: 1.0,
    roughness: 0.1,
    clearcoat: 0.55,
    clearcoatRoughness: 0.06,
    envMap: ctx.env.pmrem,
    envMapIntensity: 1.25,
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uFlow; uniform float uDetail;
        uniform vec4 uRip[${MAX_RIPPLES}];
        uniform float uRipS[${MAX_RIPPLES}];
        varying float vDisp;
        ${SIMPLEX3D}
        float dispAt(vec3 n){
          float t = uTime;
          vec3 q = n * uFreq + vec3(0.0, t * uFlow, t * uFlow * 0.6);
          // Domain-warped noise → slow, viscous, folding flow.
          float w = snoise(q * 0.6 + vec3(t * 0.05));
          float d = snoise(q * 0.85 + w * 0.45) * uAmp;
          d += snoise(n * uFreq * 1.9 - vec3(t * uFlow * 1.6)) * uAmp * (0.08 + uDetail * 0.22);
          // Word ripples: a wave packet travelling across the surface.
          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            float s = uRipS[i];
            if (s > 0.001) {
              float a = uRip[i].w;
              float th = acos(clamp(dot(n, uRip[i].xyz), -1.0, 1.0));
              float x = th - a * 2.4;
              d += s * 0.032 * exp(-a * 2.6) * cos(x * 7.0) * exp(-x * x * 6.0);
              d += s * 0.075 * exp(-a * 9.0) * exp(-th * th * 3.5);
            }
          }
          return d;
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 n0 = normalize(position);
        vec3 tA = normalize(cross(n0, abs(n0.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 tB = cross(n0, tA);
        const float E = 0.012;
        float d0 = dispAt(n0);
        vec3 nA = normalize(n0 + tA * E);
        vec3 nB = normalize(n0 + tB * E);
        vec3 p0 = n0 * (1.0 + d0);
        vec3 pA = nA * (1.0 + dispAt(nA));
        vec3 pB = nB * (1.0 + dispAt(nB));
        vec3 objectNormal = normalize(cross(pA - p0, pB - p0));
        vDisp = d0;
      `)
      .replace('#include <begin_vertex>', 'vec3 transformed = p0;');

    // Molten depth: crevices a touch deeper/redder, crests a touch paler.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vDisp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float k = clamp(vDisp * 9.0, -1.0, 1.0);
        diffuseColor.rgb *= mix(vec3(0.90, 0.80, 0.66), vec3(1.04, 1.02, 0.97), k * 0.5 + 0.5);
      `);
  };

  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 64), mat);
  root.add(orb);

  // --------------------------------------------------------------------------
  //  Warm aura behind the orb (soft sprite; stays under the bloom threshold).
  // --------------------------------------------------------------------------
  const auraTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0.0, 'rgba(255,205,130,0.55)');
    grd.addColorStop(0.35, 'rgba(240,170,80,0.22)');
    grd.addColorStop(0.7, 'rgba(200,130,50,0.05)');
    grd.addColorStop(1.0, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: auraTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.2,
  }));
  aura.scale.setScalar(4.2);
  aura.position.z = -1.2;
  aura.renderOrder = -1;
  root.add(aura);

  // --------------------------------------------------------------------------
  //  Jeweller's ring: a hair-thin gold band with orbiting diamond glints.
  // --------------------------------------------------------------------------
  const ringPivot = new THREE.Group();
  ringPivot.rotation.set(1.18, 0.0, -0.32);
  root.add(ringPivot);

  const ringSpin = new THREE.Group();
  ringPivot.add(ringSpin);

  const RING_R = 1.46;
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(RING_R, 0.0065, 12, 256),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffd27a'), metalness: 1, roughness: 0.18,
      envMap: ctx.env.pmrem, envMapIntensity: 1.6,
    })
  );
  ringSpin.add(band);

  const GLINTS = 110;
  const gPos = new Float32Array(GLINTS * 3);
  const gPhase = new Float32Array(GLINTS);
  const gSize = new Float32Array(GLINTS);
  for (let i = 0; i < GLINTS; i++) {
    const a = (i / GLINTS) * Math.PI * 2 + Math.random() * 0.05;
    const r = RING_R + (Math.random() - 0.5) * 0.11;
    gPos[i * 3] = Math.cos(a) * r;
    gPos[i * 3 + 1] = Math.sin(a) * r;
    gPos[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    gPhase[i] = Math.random() * Math.PI * 2;
    gSize[i] = Math.random() < 0.12 ? 1.0 : 0.25 + Math.random() * 0.35;
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('aPhase', new THREE.BufferAttribute(gPhase, 1));
  gGeo.setAttribute('aSize', new THREE.BufferAttribute(gSize, 1));
  const gU = {
    uTime: { value: 0 }, uLevel: { value: 0 }, uFlash: { value: 0 },
    uPixel: { value: 1 }, uScale: { value: 1 },
  };
  const glints = new THREE.Points(gGeo, new THREE.ShaderMaterial({
    uniforms: gU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uLevel; uniform float uFlash; uniform float uPixel; uniform float uScale;
      attribute float aPhase; attribute float aSize;
      varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = pow(0.5 + 0.5 * sin(uTime * (1.2 + aSize * 2.0) + aPhase * 6.2831), 6.0);
        vA = (0.22 + tw * 0.9 + uFlash * aSize * 0.8) * (0.8 + uLevel * 0.3);
        gl_PointSize = uPixel * uScale * (3.0 + aSize * (10.0 + 22.0 * tw + uFlash * 14.0)) * (12.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float core = smoothstep(0.16, 0.0, d);
        // Four-point star flare.
        float cross = max(smoothstep(0.035, 0.0, abs(p.x)) , smoothstep(0.035, 0.0, abs(p.y)));
        cross *= smoothstep(0.5, 0.0, d);
        float a = core + cross * 0.75;
        gl_FragColor = vec4(mix(vec3(1.0, 0.86, 0.6), vec3(1.0), core), a * vA);
      }`,
  }));
  ringSpin.add(glints);

  // --------------------------------------------------------------------------
  //  Motion state
  // --------------------------------------------------------------------------
  const ripples = Array.from({ length: MAX_RIPPLES }, () => ({ age: 99, s: 0, dir: new THREE.Vector3(0, 0, 1) }));
  let ripIdx = 0;
  let springX = 0, springV = 0;
  let flash = 0;
  let spin = 0;
  const tmp = new THREE.Vector3();

  function spawnRipple(strength) {
    const r = ripples[ripIdx];
    ripIdx = (ripIdx + 1) % MAX_RIPPLES;
    // Bias origins toward the camera-facing hemisphere so every word is seen.
    tmp.set((Math.random() - 0.5) * 1.3, (Math.random() - 0.5) * 1.1, 0.85 + Math.random() * 0.4).normalize();
    r.dir.copy(tmp);
    r.age = 0;
    r.s = strength;
  }

  function update(dt, t, s) {
    const speak = s.speak, listen = s.listen, think = s.think;

    if (s.impulse > 0) {
      spawnRipple(Math.min(1.2, 0.35 + s.impulse));
      springV += 1.25 * s.impulse;
      flash = Math.max(flash, s.impulse);
    }
    // Spring bounce (stiff, lightly damped → a crisp, jewel-like "tick").
    const k = 210, c = 13;
    springV += (-k * springX - c * springV) * dt;
    springX += springV * dt;
    flash *= Math.exp(-dt * 5.5);

    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = ripples[i];
      r.age += dt;
      if (r.age > 2.2) r.s = 0;
      u.uRip.value[i].set(r.dir.x, r.dir.y, r.dir.z, r.age);
      u.uRipS.value[i] = r.s;
    }

    u.uTime.value = t;
    // Idle: slow viscous flow. Speaking: livelier, louder = deeper waves.
    u.uAmp.value = 0.026 + s.level * 0.045 + s.bass * 0.02 + think * 0.015 + listen * s.level * 0.03;
    u.uFreq.value = 1.0 + s.treble * 0.25 + think * 0.4 + listen * 0.2;
    u.uFlow.value = 0.15 + speak * 0.10 + think * 0.30 + listen * 0.12;
    u.uDetail.value = Math.min(1, s.mid * 1.2 + think * 0.4);

    const breathe = 1 + Math.sin(t * 0.9) * 0.012;
    const tight = 1 - listen * 0.04;
    orb.scale.setScalar(breathe * tight * (1 + springX + s.level * 0.05));
    orb.rotation.y = t * 0.05;

    mat.envMapIntensity = 1.15 + flash * 0.35 + listen * 0.2 + s.level * 0.1;
    mat.roughness = 0.1 - listen * 0.03;

    aura.material.opacity = 0.15 + s.level * 0.1 + flash * 0.08 + listen * 0.08;
    aura.scale.setScalar(4.2 * (1 + s.level * 0.12));

    // Ring: slow orbit, faster while thinking, flares on words.
    spin += dt * (0.12 + think * 0.9 + speak * 0.1 + s.level * 0.35);
    ringSpin.rotation.z = spin;
    ringPivot.rotation.x = 1.18 + Math.sin(t * 0.21) * 0.06;
    ringPivot.rotation.y = Math.sin(t * 0.17) * 0.08;
    band.scale.setScalar(1 + springX * 0.5);
    gU.uTime.value = t;
    gU.uLevel.value = s.level;
    gU.uFlash.value = flash;
    gU.uPixel.value = ctx.pixelRatio();
    gU.uScale.value = ctx.viewScale();
  }

  function dispose() {
    orb.geometry.dispose(); mat.dispose();
    band.geometry.dispose(); band.material.dispose();
    gGeo.dispose(); glints.material.dispose();
    auraTex.dispose(); aura.material.dispose();
  }

  return { object: root, update, dispose, bloom: { threshold: 0.82, strength: 0.45 } };
}
