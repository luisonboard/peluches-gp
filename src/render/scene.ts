// Escena, luces y renderizador.
import * as THREE from 'three';
import type { Quality } from '../core/quality';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  /** Dirección hacia el sol (desde la ventana). */
  sunDir: THREE.Vector3;
}

export function createStage(container: HTMLElement, q: Quality): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = q.shadowMap > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const wallTint = 0x8590cc;
  scene.background = new THREE.Color(wallTint);
  scene.fog = new THREE.Fog(wallTint, 260, 760);

  const hemi = new THREE.HemisphereLight(0xe4ecff, 0x9a6438, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
  const sunDir = new THREE.Vector3(0.25, 1, 0.6).normalize();
  sun.castShadow = q.shadowMap > 0;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    const c = sun.shadow.camera;
    c.left = c.bottom = -48;
    c.right = c.top = 48;
    c.near = 1;
    c.far = 400;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
  }
  scene.add(sun, sun.target);
  return { renderer, scene, sun, sunDir };
}

/** La luz del sol sigue al foco de la cámara para que la sombra tenga resolución donde se mira. */
export function followSun(stage: Stage, x: number, y: number, z: number): void {
  const { sun, sunDir } = stage;
  // Ajuste a texel para que las sombras no "naden" al moverse.
  const step = 1;
  const fx = Math.round(x / step) * step;
  const fz = Math.round(z / step) * step;
  sun.target.position.set(fx, y, fz);
  sun.position.set(fx + sunDir.x * 150, y + sunDir.y * 150, fz + sunDir.z * 150);
}
