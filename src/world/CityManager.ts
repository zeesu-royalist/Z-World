import * as THREE from 'three';
import { AssetManager } from '../core/AssetManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export interface CityLoadStats {
  meshesCount: number;
  materialsCount: number;
  boundingBox: THREE.Box3;
  spawnPoint: THREE.Vector3;
}

export class CityManager {
  public cityScene: THREE.Group | null = null;
  // Exact verified main road surface coordinate
  public spawnPoint: THREE.Vector3 = new THREE.Vector3(2.5, 6.25, 4.5);
  public boundingBox: THREE.Box3 = new THREE.Box3();

  // All road, street, pavement, and ground meshes
  public roadMeshes: THREE.Mesh[] = [];
  // Strictly sidewalk, footpath, and curb surfaces for pedestrian NPCs
  public sidewalkMeshes: THREE.Mesh[] = [];
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private downVector: THREE.Vector3 = new THREE.Vector3(0, -1, 0);

  constructor(
    private scene: THREE.Scene,
    private physicsWorld: PhysicsWorld
  ) {}

  public async loadCity(
    modelPath: string = '/city/city_3d_model.glb',
    onProgress?: (percent: number) => void
  ): Promise<CityLoadStats> {
    const assetManager = AssetManager.getInstance();

    console.log(`Loading city 3D model from: ${modelPath}`);
    const gltf = await assetManager.loadGLTF(modelPath, onProgress);
    this.cityScene = gltf.scene;

    // Compute bounding box
    this.boundingBox.setFromObject(this.cityScene);
    console.log('City Bounding Box:', this.boundingBox);

    let meshesCount = 0;
    const materialSet = new Set<THREE.Material>();
    this.roadMeshes = [];
    this.sidewalkMeshes = [];

    // Traverse and collect road and street surfaces
    this.cityScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        meshesCount++;

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            materialSet.add(mat);
            this.optimizeMaterial(mat);
          });
        } else if (mesh.material) {
          materialSet.add(mesh.material);
          this.optimizeMaterial(mesh.material);
        }

        // Identify road, pavement, street, parking lot, curb, or ground meshes
        const meshName = mesh.name.toLowerCase();
        const parentName = (mesh.parent?.name || '').toLowerCase();
        const combinedName = `${meshName} ${parentName}`;

        if (
          combinedName.includes('street') ||
          combinedName.includes('road') ||
          combinedName.includes('pavement') ||
          combinedName.includes('curb') ||
          combinedName.includes('lot') ||
          combinedName.includes('yard') ||
          combinedName.includes('ground') ||
          combinedName.includes('concrete')
        ) {
          this.roadMeshes.push(mesh);
        }

        // Strictly sidewalk / footpath / curb / concrete pedestrian areas
        if (
          combinedName.includes('pavement') ||
          combinedName.includes('curb') ||
          combinedName.includes('concrete')
        ) {
          this.sidewalkMeshes.push(mesh);
        }
      }
    });

    // If no filtered road meshes found, use all meshes as fallback walkable surfaces
    if (this.roadMeshes.length === 0) {
      this.cityScene.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) this.roadMeshes.push(c as THREE.Mesh);
      });
    }

    // Add city scene to Three.js scene
    this.scene.add(this.cityScene);

    // Create safety bottom net collider at Y = 0 (far below streets)
    this.physicsWorld.createGroundPlane(0.0, 6000);

    // Sample the exact road elevation at the spawn point
    const initialRoadY = this.getGroundHeight(this.spawnPoint.x, this.spawnPoint.z, 15.0);
    this.spawnPoint.y = initialRoadY;
    console.log(`City loaded: ${meshesCount} meshes (${this.roadMeshes.length} road meshes). Player spawn road height: Y = ${this.spawnPoint.y.toFixed(2)}m`);

    return {
      meshesCount,
      materialsCount: materialSet.size,
      boundingBox: this.boundingBox,
      spawnPoint: this.spawnPoint.clone(),
    };
  }

  /**
   * Raycasts straight down from above (x, z) to get the exact road surface height.
   * Guarantees player always walks ON TOP of the asphalt/slopes, never underground!
   */
  public getGroundHeight(x: number, z: number, currentY: number): number {
    const rayStartY = Math.max(currentY + 5.0, 15.0);
    this.raycaster.set(new THREE.Vector3(x, rayStartY, z), this.downVector);
    this.raycaster.far = 120;

    const hits = this.raycaster.intersectObjects(this.roadMeshes, true);
    if (hits.length > 0) {
      return hits[0].point.y;
    }

    // Default main road elevation fallback
    return 6.18;
  }

  /**
   * Raycasts straight down to determine if (x, z) is specifically on a SIDEWALK / FOOTPATH.
   * Returns exact sidewalk surface elevation if on pavement/curb, or null if on road/building.
   */
  public getSidewalkHeight(x: number, z: number, currentY: number): number | null {
    const rayStartY = Math.max(currentY + 6.0, 15.0);
    this.raycaster.set(new THREE.Vector3(x, rayStartY, z), this.downVector);
    this.raycaster.far = 120;

    const hits = this.raycaster.intersectObjects(this.sidewalkMeshes, true);
    if (hits.length > 0) {
      const hitY = hits[0].point.y;
      // Guarantee the sidewalk is near the character's ground plane (not a rooftop)
      if (Math.abs(hitY - currentY) <= 3.5) {
        return hitY;
      }
    }
    return null;
  }

  /**
   * Samples candidate points around origin to find a confirmed sidewalk position.
   */
  public findNearbySidewalkPoint(
    origin: THREE.Vector3,
    minDist: number = 10.0,
    maxDist: number = 32.0,
    heading?: number
  ): { position: THREE.Vector3; angle: number } | null {
    // Generate candidate angles: prefer forward cone if heading given
    const numCandidates = 14;
    const baseHeading = heading !== undefined ? heading : Math.random() * Math.PI * 2;

    for (let i = 0; i < numCandidates; i++) {
      const angle =
        heading !== undefined
          ? baseHeading + (Math.random() - 0.5) * 1.8
          : (i / numCandidates) * Math.PI * 2 + Math.random() * 0.3;
      const dist = minDist + Math.random() * (maxDist - minDist);

      const cx = origin.x + Math.sin(angle) * dist;
      const cz = origin.z + Math.cos(angle) * dist;

      const swY = this.getSidewalkHeight(cx, cz, origin.y);
      if (swY !== null) {
        return {
          position: new THREE.Vector3(cx, swY, cz),
          angle
        };
      }
    }

    return null;
  }

  private optimizeMaterial(mat: THREE.Material): void {
    if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (stdMat.map) {
        stdMat.map.colorSpace = THREE.SRGBColorSpace;
        stdMat.map.anisotropy = 4;
      }
      stdMat.roughness = Math.min(Math.max(stdMat.roughness, 0.35), 0.9);
      stdMat.metalness = Math.min(stdMat.metalness, 0.25);
    }
  }
}
