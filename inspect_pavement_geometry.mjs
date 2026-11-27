import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

global.self = global;
global.window = global;
class FakeImage {
  set src(v) {}
  get src() { return ''; }
  addEventListener(evt, cb) { if (evt === 'load') setTimeout(cb, 1); }
}
global.Image = FakeImage;

const loader = new GLTFLoader();
const buf = fs.readFileSync('public/city/city_3d_model.glb');
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

loader.parse(arrayBuffer, '', (gltf) => {
  const cityScene = gltf.scene;
  cityScene.updateMatrixWorld(true);

  let pavementMesh = null;
  cityScene.traverse(c => {
    if (c.isMesh && c.parent?.name.includes('Pavement')) pavementMesh = c;
  });

  const geom = pavementMesh.geometry;
  const pos = geom.attributes.position;
  const worldMatrix = pavementMesh.matrixWorld;

  console.log(`Pavement has ${pos.count} vertices.`);

  // Transform all vertices to world coordinates and sample
  const worldVerts = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    v.applyMatrix4(worldMatrix);
    worldVerts.push(new THREE.Vector3(v.x, v.y, v.z));
  }

  // Find min and max
  const box = new THREE.Box3().setFromPoints(worldVerts);
  console.log(`World Pavement Box: min=[${box.min.x.toFixed(1)}, ${box.min.y.toFixed(1)}, ${box.min.z.toFixed(1)}], max=[${box.max.x.toFixed(1)}, ${box.max.y.toFixed(1)}, ${box.max.z.toFixed(1)}]`);

  // Let's inspect vertices near player spawn (2.5, 4.5):
  const nearSpawn = worldVerts.filter(p => Math.hypot(p.x - 2.5, p.z - 4.5) < 15);
  console.log(`Pavement vertices within 15m of player spawn: ${nearSpawn.length}`);
  nearSpawn.slice(0, 15).forEach(p => console.log(`  (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`));

});
