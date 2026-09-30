// ============================================================================
//  Crystal — a round brilliant-cut diamond (57 facets approximated with
//  table, star, bezel, upper/lower girdle and pavilion mains). Rendered with a
//  custom gem shader: fresnel reflection + per-channel refraction (dispersion
//  → rainbow "fire") + a faked internal bounce, all sampling the bright studio
//  cube map. Physical transmission would only refract the dark backdrop, so
//  this is what makes it sparkle on black.
// ============================================================================
import * as THREE from 'three';

function buildBrilliant() {
  const N = 8;
  const TAU = Math.PI * 2;
  const P = (r, a, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);

  const tableR = 0.56, tableY = 0.34;
  const bezelTipR = 0.80, bezelTipY = 0.19;
  const girdleTop = 0.022, girdleBot = -0.022;
  const lowerR = 0.52, lowerY = -0.46;
  const culet = new THREE.Vector3(0, -0.88, 0);
  const tableC = new THREE.Vector3(0, tableY, 0);

  const T = [], B = [], GT = [], GB = [], M = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU;
    T.push(P(tableR, a, tableY));
    B.push(P(bezelTipR, a + TAU / (2 * N), bezelTipY));
    M.push(P(lowerR, a + TAU / (2 * N), lowerY));
  }
  for (let j = 0; j < 2 * N; j++) {
    const a = (j / (2 * N)) * TAU;
    GT.push(P(1, a, girdleTop));
    GB.push(P(1, a, girdleBot));
  }
  const g = (arr, j) => arr[((j % arr.length) + arr.length) % arr.length];

  const pos = [];
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

  for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N;
    tri(tableC, T[k1], T[k]);                         // table
    tri(T[k], T[k1], B[k]);                           // star facet
    tri(T[k], g(B, k - 1), g(GT, 2 * k));             // bezel (kite) — two halves
    tri(T[k], g(GT, 2 * k), B[k]);
    tri(B[k], g(GT, 2 * k), g(GT, 2 * k + 1));        // upper girdle halves
    tri(B[k], g(GT, 2 * k + 1), g(GT, 2 * k + 2));
    tri(M[k], g(GB, 2 * k + 1), g(GB, 2 * k));        // lower girdle halves
    tri(M[k], g(GB, 2 * k + 2), g(GB, 2 * k + 1));
    tri(g(GB, 2 * k), g(M, k - 1), culet);            // pavilion mains
    tri(g(GB, 2 * k), culet, M[k]);
  }
  for (let j = 0; j < 2 * N; j++) {                   // girdle band
    const a = GT[j], b = g(GT, j + 1), c = g(GB, j + 1), d = GB[j];
    tri(a, c, b); tri(a, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // Make winding consistent (outward), whatever order the tris were authored.
  const p = geo.attributes.position;
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const n = new THREE.Vector3(), cen = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    va.fromBufferAttribute(p, i); vb.fromBufferAttribute(p, i + 1); vc.fromBufferAttribute(p, i + 2);
    n.subVectors(vc, vb).cross(new THREE.Vector3().subVectors(va, vb));
    cen.copy(va).add(vb).add(vc).divideScalar(3).sub(new THREE.Vector3(0, -0.2, 0));
    if (n.dot(cen) < 0) { p.setXYZ(i + 1, vc.x, vc.y, vc.z); p.setXYZ(i + 2, vb.x, vb.y, vb.z); }
  }
  geo.computeVertexNormals();
  geo.translate(0, 0.25, 0);
  return geo;
}

export function create(ctx) {
  const root = new THREE.Group();
  const geo = buildBrilliant();

  const uniforms = {
    uEnv: { value: ctx.env.cube },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uLevel: { value: 0 },
    uListen: { value: 0 },
    uRot: { value: new THREE.Matrix3() },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vWN; varying vec3 vWP; varying vec3 vOP;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        vOP = position;
        vWN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform samplerCube uEnv; uniform float uTime; uniform float uFlash; uniform float uLevel; uniform float uListen;
      uniform mat3 uRot;
      varying vec3 vWN; varying vec3 vWP; varying vec3 vOP;
      const float PI = 3.14159265;

      // Virtual point lights → crisp sparkle lobes on top of the studio map.
      vec3 lights(vec3 d){
        vec3 c = vec3(0.0);
        c += vec3(1.0, 0.97, 0.92) * pow(max(dot(d, normalize(vec3( 0.35, 0.90,  0.25))), 0.0), 60.0) * 6.0;
        c += vec3(0.92, 0.96, 1.0) * pow(max(dot(d, normalize(vec3(-0.70, 0.40,  0.55))), 0.0), 80.0) * 5.0;
        c += vec3(1.0, 0.90, 0.75) * pow(max(dot(d, normalize(vec3( 0.80, 0.10,  0.60))), 0.0), 90.0) * 5.0;
        c += vec3(1.0) * pow(max(dot(d, normalize(vec3(-0.20, 0.60,  0.95))), 0.0), 120.0) * 7.0;
        c += vec3(0.95, 0.97, 1.0) * pow(max(dot(d, normalize(vec3( 0.05, 0.25,  1.00))), 0.0), 30.0) * 1.2;
        return c;
      }
      vec3 env(vec3 d){ return textureCube(uEnv, d).rgb * 1.6 + lights(d); }

      // Outward normal of the pavilion main facing azimuth phi (object space).
      vec3 pav(float phi){
        float seg = 2.0 * PI / 8.0;
        float q = (floor(phi / seg) + 0.5) * seg;
        const float s41 = 0.656, c41 = 0.755;
        return normalize(vec3(cos(q) * s41, -c41, sin(q) * s41));
      }

      float trace(vec3 I, vec3 N, float ior, int ch){
        vec3 up = normalize(uRot * vec3(0.0, 1.0, 0.0));
        vec3 r1 = refract(I, N, 1.0 / ior);
        float phi = atan(vOP.z, vOP.x) + PI;
        vec3 r2 = reflect(r1, normalize(uRot * pav(phi)));
        vec3 r3 = reflect(r2, normalize(uRot * pav(phi + PI + 0.35)));
        vec3 outN = dot(r3, up) > 0.0 ? up : -up;
        vec3 ex = refract(r3, -outN, ior);
        float w = 1.0;
        if (dot(ex, ex) < 0.01) { ex = reflect(r3, -outN); w = 0.55; }
        vec3 s = env(normalize(ex)) * w;
        return ch == 0 ? s.r : (ch == 1 ? s.g : s.b);
      }

      void main(){
        vec3 N = normalize(vWN);
        vec3 V = normalize(cameraPosition - vWP);
        vec3 I = -V;
        float ndv = max(dot(N, V), 0.0);
        float F = 0.17 + 0.83 * pow(1.0 - ndv, 5.0);

        // Dispersion: a separate path per colour channel → spectral fire.
        vec3 col = vec3(
          trace(I, N, 2.33, 0),
          trace(I, N, 2.42, 1),
          trace(I, N, 2.52, 2)
        );
        col = pow(col, vec3(1.25)) * (1.05 + uFlash * 1.1 + uLevel * 0.35);
        vec3 refl = env(reflect(I, N));
        vec3 c = mix(col, refl, F);
        // Clear, faintly cool body so the stone always reads as a gem.
        c += vec3(0.05, 0.06, 0.08) * (1.0 + uListen * 0.8);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const gem = new THREE.Mesh(geo, mat);
  gem.scale.setScalar(0.98);
  root.add(gem);

  // Star glints scattered over the crown — flare on each word.
  const crownPts = [];
  const pa = geo.attributes.position;
  const seen = new Set();
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (y > 0.2 && !seen.has(key)) { seen.add(key); crownPts.push(x * 1.01, y * 1.01, z * 1.01); }
  }
  const GN = crownPts.length / 3;
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.Float32BufferAttribute(crownPts, 3));
  gGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(Array.from({ length: GN }, () => Math.random() * 6.283), 1));
  const gU = { uTime: { value: 0 }, uFlash: { value: 0 }, uPixel: { value: 1 } };
  const glints = new THREE.Points(gGeo, new THREE.ShaderMaterial({
    uniforms: gU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uFlash; uniform float uPixel;
      attribute float aPhase; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = pow(0.5 + 0.5 * sin(uTime * 1.7 + aPhase * 5.0), 14.0);
        float fl = uFlash * step(0.55, fract(aPhase * 3.17));
        vA = tw * 0.9 + fl;
        gl_PointSize = uPixel * (4.0 + 34.0 * max(tw, fl)) * (12.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float d = length(p);
        float core = smoothstep(0.12, 0.0, d);
        float cross = max(smoothstep(0.03, 0.0, abs(p.x)), smoothstep(0.03, 0.0, abs(p.y))) * smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.95), (core + cross * 0.8) * vA);
      }`,
  }));
  glints.renderOrder = 2;

  // Hairline facet edges, very faint.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 10),
    new THREE.LineBasicMaterial({ color: 0xdfeaff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  gem.add(edges);
  gem.add(glints);

  // Soft cool aura behind.
  const auraTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(210,225,255,0.40)');
    grd.addColorStop(0.4, 'rgba(180,200,255,0.12)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.18 }));
  aura.scale.setScalar(3.8);
  aura.position.z = -1.2;
  root.add(aura);

  let springX = 0, springV = 0, flash = 0, spinV = 0, rotY = 0;

  function update(dt, t, s) {
    if (s.impulse > 0) {
      springV += 1.0 * s.impulse;
      flash = Math.max(flash, s.impulse);
      spinV += 0.9 * s.impulse;
    }
    springV += (-200 * springX - 12 * springV) * dt;
    springX += springV * dt;
    flash *= Math.exp(-dt * 6);
    spinV *= Math.exp(-dt * 2.2);

    rotY += dt * (0.22 + s.think * 0.9 + s.level * 0.4) + spinV * dt;
    gem.rotation.y = rotY;
    gem.rotation.x = 0.28 + Math.sin(t * 0.3) * 0.08;
    gem.rotation.z = Math.sin(t * 0.23) * 0.05;
    gem.scale.setScalar(0.98 * (1 + springX + s.level * 0.05 + Math.sin(t * 0.9) * 0.01) * (1 - s.listen * 0.03));

    gem.updateMatrixWorld();
    uniforms.uRot.value.setFromMatrix4(gem.matrixWorld);
    uniforms.uTime.value = t;
    gU.uTime.value = t;
    gU.uFlash.value = flash;
    gU.uPixel.value = ctx.pixelRatio() * ctx.viewScale();
    uniforms.uFlash.value = flash;
    uniforms.uLevel.value = s.level;
    uniforms.uListen.value = s.listen;
    edges.material.opacity = 0.07 + flash * 0.15 + s.listen * 0.06;
    aura.material.opacity = 0.14 + s.level * 0.2 + flash * 0.12 + s.listen * 0.08;
  }

  function dispose() {
    geo.dispose(); mat.dispose(); gGeo.dispose(); glints.material.dispose(); edges.geometry.dispose(); edges.material.dispose();
    auraTex.dispose(); aura.material.dispose();
  }

  return { object: root, update, dispose, bloom: { threshold: 0.95, strength: 0.35 } };
}
