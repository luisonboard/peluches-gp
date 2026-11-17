// Escena, luces y renderizador.
import * as THREE from 'three';
import type { Quality } from '../core/quality';
import type { TrackLook } from '../world/tracks';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Dirección hacia el sol (desde la ventana). */
  sunDir: THREE.Vector3;
}

export function createStage(container: HTMLElement, q: Quality): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = q.shadowMap > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0xffffff, 1, 2);

  const hemi = new THREE.HemisphereLight();
  scene.add(hemi);
  const sun = new THREE.DirectionalLight();
  const sunDir = new THREE.Vector3(0, 1, 0);
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
  return { renderer, scene, sun, hemi, sunDir };
}

/** Cielo, niebla y luces de la pista (se llama al cargar cada pista). */
export function applyLook(stage: Stage, look: TrackLook): void {
  const { scene, hemi, sun, renderer } = stage;
  (scene.background as THREE.Color).setHex(look.sky);
  const fog = scene.fog as THREE.Fog;
  fog.color.setHex(look.sky);
  [fog.near, fog.far] = look.fog;
  hemi.color.setHex(look.hemi.sky);
  hemi.groundColor.setHex(look.hemi.ground);
  hemi.intensity = look.hemi.intensity;
  sun.color.setHex(look.sun.color);
  sun.intensity = look.sun.intensity;
  stage.sunDir.set(...look.sun.dir).normalize();
  renderer.toneMappingExposure = look.exposure;
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
