// ============================================================================
//  Classic — faithful port of the original sapphire-tinted faceted diamond
//  (self-illuminated crystal shader, glowing edges, inner caustic core,
//  drifting sparks, expanding energy rings), wired to the stage interface.
// ============================================================================
import * as THREE from 'three';

function buildBrilliantDiamond({
  segments = 18, girdleRadius = 1.0, tableRadius = 0.52, crownHeight = 0.46,
  girdleHeight = 0.07, pavilionDepth = 1.32,
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
    const a = ang(i), c = Math.cos(a), s = Math.sin(a);
    G.push([c * girdleRadius, gTopY, s * girdleRadius]);
    Gb.push([c * girdleRadius, gBotY, s * girdleRadius]);
    T.push([c * tableRadius, tableY, s * tableRadius]);
  }
  const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    tri(tableCenter, T[j], T[i]);
    tri(G[i], T[i], T[j]);
    tri(G[i], T[j], G[j]);
    tri(G[i], G[j], Gb[j]);
    tri(G[i], Gb[j], Gb[i]);
    tri(Gb[i], Gb[j], culet);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

export function create(ctx) {
  const root = new THREE.Group();
  const SCALE = 0.92;

  const diamondGeo = buildBrilliantDiamond();
  const diamondUniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uBase: { value: new THREE.Color(0x1a2740) },
    uGlow: { value: new THREE.Color(0xaad6ff) },
    uGold: { value: new THREE.Color(0xe7c585) },
  };
  const diamondMat = new THREE.ShaderMaterial({
    uniforms: diamondUniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
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
        vec3 L1 = normalize(vec3(0.55, 0.85, 0.6));
        vec3 L2 = normalize(vec3(-0.6, -0.25, 0.5));
        float d1 = max(dot(N, L1), 0.0);
        float d2 = max(dot(N, L2), 0.0);
        float facet = 0.22 + 0.62 * d1 + 0.32 * d2;
        float spec = pow(max(dot(reflect(-L1, N), V), 0.0), 48.0);
        float spec2 = pow(max(dot(reflect(-L2, N), V), 0.0), 90.0);
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
  diamond.scale.setScalar(SCALE);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xcfe6ff, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const edgeGeo = new THREE.EdgesGeometry(diamondGeo, 18);
  diamond.add(new THREE.LineSegments(edgeGeo, edgeMat));
  root.add(diamond);

  // Inner caustic core.
  const coreUniforms = { uTime: { value: 0 }, uLevel: { value: 0 }, uColor: { value: new THREE.Color(0x9fd0ff) } };
  const coreMat = new THREE.ShaderMaterial({
    uniforms: coreUniforms, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.BackSide,
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

  const heartMat = new THREE.MeshBasicMaterial({
    color: 0xcfe9ff, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), heartMat);
  diamond.add(heart);

  // Inner sparks.
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
    uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uPixel: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uLevel; uniform float uPixel;
      attribute float aPhase; varying float vT;
      void main(){
        vec3 p = position;
        float t = uTime * 0.8 + aPhase;
        p += 0.06 * vec3(sin(t*1.3), cos(t*1.1), sin(t*0.9));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vT = 0.5 + 0.5 * sin(uTime * 3.0 + aPhase * 6.2831);
        gl_PointSize = uPixel * (4.0 + 13.0 * vT * (0.5 + uLevel * 1.5)) * (12.0 / -mv.z);
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

  // Expanding energy rings on word onsets / bass hits.
  const rings = [];
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xe7c585 : 0xbfe2ff, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 96), mat);
    mesh.visible = false;
    root.add(mesh);
    rings.push({ mesh, alive: false, age: 0, life: 1.6, power: 0 });
  }
  const spawnRing = (strength) => {
    const slot = rings.find((r) => !r.alive);
    if (!slot) return;
    Object.assign(slot, { alive: true, age: 0, life: 1.4 + Math.random() * 0.5, power: strength });
    slot.mesh.visible = true;
  };

  let springX = 0, springV = 0, ringCooldown = 0;

  function update(dt, t, s) {
    const level = s.level, bass = s.bass;
    if (s.impulse > 0) {
      springV += 0.9 * s.impulse;
      if (s.impulse > 0.6) spawnRing(s.impulse * 0.8);
    }
    ringCooldown -= dt;
    if (bass > 0.4 && ringCooldown <= 0) { spawnRing(bass); ringCooldown = 0.3; }
    springV += (-190 * springX - 12 * springV) * dt;
    springX += springV * dt;

    diamond.rotation.y += dt * (0.18 + level * 0.7 + s.think * 0.8);
    diamond.rotation.x = Math.sin(t * 0.22) * 0.10;
    const breathe = 1 + Math.sin(t * 0.9) * 0.018;
    const idlePulse = Math.pow(Math.max(0, Math.sin(t * 0.7)), 6) * 0.05;
    diamond.scale.setScalar(SCALE * breathe * (1 + idlePulse + springX) * (1 + level * 0.2 + bass * 0.06));

    diamondUniforms.uTime.value = t;
    diamondUniforms.uLevel.value = Math.min(1, level + s.pulse * 0.4 + s.listen * 0.25);
    coreUniforms.uTime.value = t;
    coreUniforms.uLevel.value = level + s.listen * 0.3;
    core.rotation.y -= dt * 0.25;
    core.rotation.z += dt * 0.12;
    sparkMat.uniforms.uTime.value = t;
    sparkMat.uniforms.uLevel.value = level;
    sparkMat.uniforms.uPixel.value = ctx.pixelRatio() * ctx.viewScale();
    heart.scale.setScalar(0.7 + level * 0.9 + idlePulse * 2.2 + s.pulse * 0.8);
    heartMat.opacity = 0.22 + level * 0.30;

    const q = ctx.camera.quaternion;
    for (const r of rings) {
      if (!r.alive) continue;
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) { r.alive = false; r.mesh.visible = false; continue; }
      r.mesh.scale.setScalar(1.3 + k * (2.6 + r.power * 1.6));
      r.mesh.quaternion.copy(q);
      r.mesh.material.opacity = (1 - k) * (0.08 + r.power * 0.26) * Math.sin(k * Math.PI);
    }
  }

  function dispose() {
    diamondGeo.dispose(); diamondMat.dispose(); edgeGeo.dispose(); edgeMat.dispose();
    core.geometry.dispose(); coreMat.dispose(); heart.geometry.dispose(); heartMat.dispose();
    sparkGeo.dispose(); sparkMat.dispose();
    rings.forEach((r) => { r.mesh.geometry.dispose(); r.mesh.material.dispose(); });
  }

  return { object: root, update, dispose, bloom: { threshold: 0.55, strength: 0.45 } };
}
