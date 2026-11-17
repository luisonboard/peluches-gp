// Libera la memoria de GPU de un grupo que ya no se usa (al cambiar de pista).
// Lo compartido (texturas de `makeTextures`, cachés de karts y peluches) lleva `userData.shared` y no se libera.
import * as THREE from 'three';

export function disposeTree(root: THREE.Object3D): void {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !m.geometry.userData.shared) geos.add(m.geometry);
    if (m.material) for (const x of Array.isArray(m.material) ? m.material : [m.material]) if (!x.userData.shared) mats.add(x);
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
  });
  root.removeFromParent();
  for (const g of geos) g.dispose();
  for (const mat of mats) {
    for (const v of Object.values(mat)) {
      if (v instanceof THREE.Texture && !v.userData.shared) v.dispose();
    }
    mat.dispose();
  }
}
