import * as THREE from 'three';

/** A restrained sleeve reflection, separate from the original printed artwork. */
export function cardSheen() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTravel: { value: 0 }, uAim: { value: new THREE.Vector2() } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vEye;
      void main() {
        vUv = uv;
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vEye = -view.xyz;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform float uTravel;
      uniform vec2 uAim;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vEye;
      void main() {
        float facing = max(dot(normalize(vNormalView), normalize(vEye)), 0.0);
        float edge = pow(1.0 - facing, 2.0);
        float sweep = mod(uTravel * 1.7 + 0.35 + uAim.x * 0.2, 2.1) - 0.3;
        float band = 1.0 - smoothstep(0.025, 0.20, abs(vUv.x + vUv.y * 0.55 - sweep));
        float soft = 1.0 - smoothstep(0.1, 0.65, abs(vUv.x + vUv.y * 0.55 - sweep));
        vec3 warm = vec3(1.0, 0.89, 0.66);
        vec3 cool = vec3(0.68, 0.87, 1.0);
        vec3 tint = mix(warm, cool, smoothstep(0.1, 0.9, vUv.y + uAim.y * 0.1));
        gl_FragColor = vec4(tint, band * 0.14 + soft * 0.025 + edge * 0.08);
      }
    `,
  });
}
