import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from './PhysicsWorld';

export class ColliderBuilder {
  /**
   * Automatically extracts trimesh physics colliders from a THREE.Object3D hierarchy (e.g. city GLB).
   * Supports filtering by name/size to keep physics fast and responsive.
   */
  public static createTrimeshFromMesh(
    mesh: THREE.Mesh,
    physicsWorld: PhysicsWorld
  ): RAPIER.Collider | null {
    if (!physicsWorld.isInitialized) return null;
    const geometry = mesh.geometry;
    if (!geometry) return null;

    // Ensure non-indexed geometries get converted or indexed properly
    let posAttr = geometry.attributes.position;
    if (!posAttr) return null;

    // Apply world transform
    mesh.updateWorldMatrix(true, false);
    const worldMatrix = mesh.matrixWorld;

    // Extract transformed vertices
    const vertexCount = posAttr.count;
    const vertices = new Float32Array(vertexCount * 3);
    const tempVec = new THREE.Vector3();

    for (let i = 0; i < vertexCount; i++) {
      tempVec.fromBufferAttribute(posAttr, i);
      tempVec.applyMatrix4(worldMatrix);
      vertices[i * 3 + 0] = tempVec.x;
      vertices[i * 3 + 1] = tempVec.y;
      vertices[i * 3 + 2] = tempVec.z;
    }

    let indices: Uint32Array;
    if (geometry.index) {
      indices = new Uint32Array(geometry.index.array);
    } else {
      indices = new Uint32Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        indices[i] = i;
      }
    }

    try {
      const rigidBodyDesc = physicsWorld.rapier.RigidBodyDesc.fixed();
      const rigidBody = physicsWorld.world.createRigidBody(rigidBodyDesc);
      const colliderDesc = physicsWorld.rapier.ColliderDesc.trimesh(vertices, indices)
        .setFriction(0.8)
        .setRestitution(0.1);
      return physicsWorld.world.createCollider(colliderDesc, rigidBody);
    } catch (e) {
      console.warn('Could not create trimesh collider for mesh:', mesh.name, e);
      return null;
    }
  }

  /**
   * Generates bounding box colliders for city blocks/buildings for superior performance.
   */
  public static createBoxCollider(
    box: THREE.Box3,
    physicsWorld: PhysicsWorld
  ): RAPIER.Collider | null {
    if (!physicsWorld.isInitialized) return null;
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const bodyDesc = physicsWorld.rapier.RigidBodyDesc.fixed().setTranslation(
      center.x,
      center.y,
      center.z
    );
    const body = physicsWorld.world.createRigidBody(bodyDesc);
    const colliderDesc = physicsWorld.rapier.ColliderDesc.cuboid(
      Math.max(size.x / 2, 0.1),
      Math.max(size.y / 2, 0.1),
      Math.max(size.z / 2, 0.1)
    );
    return physicsWorld.world.createCollider(colliderDesc, body);
  }
}
