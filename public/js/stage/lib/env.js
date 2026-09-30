// A warm, high-contrast "jewellery studio" environment: mostly dark, lit by
// a handful of HDR softboxes and strip lights. Metals and gems read their
// luxury from these sharp reflections, so this is shared by every entity.
import * as THREE from 'three';

function buildStudioScene() {
  const s = new THREE.Scene();

  // Dark gradient dome (slightly warmer and lighter overhead).
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vP;
        void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        varying vec3 vP;
        void main(){
          float y = vP.y;
          vec3 floorC = vec3(0.020, 0.012, 0.006);
          vec3 horizon = vec3(0.060, 0.040, 0.022);
          vec3 sky = vec3(0.030, 0.026, 0.024);
          vec3 c = y < 0.0 ? mix(horizon, floorC, smoothstep(0.0, -0.6, y))
                           : mix(horizon, sky, smoothstep(0.0, 0.7, y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  s.add(dome);

  const panel = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(...look);
    s.add(m);
    return m;
  };

  const O = [0, 0, 0];
  // Big overhead key softbox.
  panel(22, 2.4, 0xfff1dc, 3.4, [0, 18, 3], O);
  panel(18, 1.2, 0xffe6c0, 2.4, [0, 14, -8], O);
  // Tall cool-white strip, camera-left.
  panel(2.2, 20, 0xf4f7ff, 5.0, [-14, 2, 8], O);
  // Warm strip, camera-right.
  panel(1.6, 18, 0xffd49a, 4.0, [15, 0, 5], O);
  // Back rim lights (give the silhouette a hot edge).
  panel(10, 2.0, 0xffe2b0, 3.0, [-6, 6, -16], O);
  panel(3.0, 12, 0xffc98a, 2.2, [10, -2, -14], O);
  // Small, very bright "sparkle" cards for glints.
  panel(1.2, 1.2, 0xffffff, 12.0, [6, 9, 12], O);
  panel(0.9, 0.9, 0xffffff, 10.0, [-8, -5, 12], O);
  panel(0.8, 0.8, 0xfff0d0, 9.0, [3, -9, 9], O);
  // Gentle warm floor bounce.
  panel(30, 30, 0x3a2410, 0.45, [0, -14, 0], O);
  panel(14, 0.9, 0xffd9a0, 2.2, [0, -11, 9], O);

  return s;
}

export function createStudioEnvironment(renderer) {
  const studio = buildStudioScene();

  // Pre-filtered (PMREM) map for physically based materials.
  const pmremGen = new THREE.PMREMGenerator(renderer);
  const pmrem = pmremGen.fromScene(studio, 0.0, 0.1, 100).texture;
  pmremGen.dispose();

  // Sharp cube map for the custom refraction shader (gem fire).
  const cubeRT = new THREE.WebGLCubeRenderTarget(512, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
  studio.add(cubeCam);
  cubeCam.update(renderer, studio);

  studio.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });

  return {
    pmrem,
    cube: cubeRT.texture,
    dispose() { pmrem.dispose(); cubeRT.dispose(); },
  };
}
