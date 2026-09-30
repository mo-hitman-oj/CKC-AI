// Shared atmosphere: a screen-space backdrop (warm glow that follows the
// entity + vignette) and a sparse field of drifting gold dust.
import * as THREE from 'three';

export function createBackdrop() {
  const uniforms = {
    uCenter: { value: new THREE.Vector2(0.5, 0.56) }, // uv, y up
    uAspect: { value: 16 / 9 },
    uRadius: { value: 0.42 },
    uGlow: { value: 0.0 },
    uTint: { value: new THREE.Color(0xd9a45a) },
    uTime: { value: 0 },
  };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec2 uCenter; uniform float uAspect; uniform float uRadius;
        uniform float uGlow; uniform vec3 uTint; uniform float uTime;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec3 base = vec3(0.030, 0.025, 0.022);
          vec2 d = vUv - uCenter; d.x *= uAspect;
          float r = length(d);
          // Soft warm pool of light behind the entity.
          float glow = exp(-pow(r / uRadius, 2.0) * 2.2);
          vec3 col = base + uTint * glow * (0.050 + uGlow * 0.045);
          // Faint secondary floor glow under it.
          vec2 f = vUv - vec2(uCenter.x, uCenter.y - 0.30); f.x *= uAspect * 0.55;
          col += uTint * exp(-dot(f, f) * 30.0) * 0.012;
          // Vignette.
          vec2 v = vUv - 0.5; v.x *= uAspect * 0.8;
          col *= mix(1.0, 0.55, smoothstep(0.35, 1.05, length(v)));
          // Dither to kill banding.
          col += (hash(vUv * 1000.0 + uTime) - 0.5) / 255.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, uniforms };
}

export function createDust(count = 460) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const scale = new Float32Array(count);
  const tint = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * 13;
    pos[i * 3 + 1] = (Math.random() * 2 - 1) * 7.5;
    pos[i * 3 + 2] = -8 + Math.random() * 11;
    phase[i] = Math.random() * Math.PI * 2;
    scale[i] = 0.35 + Math.pow(Math.random(), 3) * 1.4;
    tint[i] = Math.random() < 0.18 ? 1 : 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));

  const uniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uRightDim: { value: 0 },
    uPixel: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uLevel; uniform float uRightDim; uniform float uPixel;
      attribute float aPhase; attribute float aScale; attribute float aTint;
      varying float vA; varying float vTint;
      void main(){
        vec3 p = position;
        float t = uTime * (0.06 + uLevel * 0.05);
        p.y = mod(p.y + 7.5 + uTime * 0.09 * aScale + uLevel * 0.2, 15.0) - 7.5;
        p.x += sin(t * 2.0 + aPhase) * 0.35;
        p.z += cos(t * 1.6 + aPhase) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.5 + 0.5 * sin(uTime * (0.8 + aScale) + aPhase * 6.2831);
        float edge = smoothstep(7.5, 6.0, abs(p.y));
        vA = (0.18 + 0.55 * tw) * edge * (0.75 + uLevel * 0.6);
        // Keep the right-hand UI area calm.
        float ndcX = gl_Position.x / gl_Position.w;
        vA *= mix(1.0, 0.22, uRightDim * smoothstep(-0.25, 0.15, ndcX));
        vTint = aTint;
        gl_PointSize = aScale * (2.0 + tw * 2.5) * uPixel * (10.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vTint;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.6);
        vec3 c = mix(vec3(0.95, 0.74, 0.40), vec3(1.0, 0.96, 0.88), vTint);
        gl_FragColor = vec4(c, a * vA);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, uniforms };
}
