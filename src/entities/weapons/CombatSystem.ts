import * as THREE from 'three';

export interface HitResult {
  hit: boolean;
  point?: THREE.Vector3;
  normal?: THREE.Vector3;
  object?: THREE.Object3D;
  distance?: number;
}

export class CombatSystem {
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private particleGroup: THREE.Group = new THREE.Group();

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.scene.add(this.particleGroup);
  }

  public fireRaycast(range: number = 300): HitResult {
    // Screen-center raycast (crosshair position)
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = range;

    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    // Filter out helper or invisible objects
    for (const hit of intersects) {
      if (hit.object.type === 'Mesh' && hit.object.visible) {
        // Create bullet tracer and impact sparks
        this.createBulletTracer(this.camera.position, hit.point);
        this.createImpactSparks(hit.point, hit.face?.normal || new THREE.Vector3(0, 1, 0));

        return {
          hit: true,
          point: hit.point,
          normal: hit.face?.normal,
          object: hit.object,
          distance: hit.distance,
        };
      }
    }

    // Raycast hit nothing - tracer goes to max distance
    const rayEnd = this.camera.position.clone().add(
      this.raycaster.ray.direction.clone().multiplyScalar(range)
    );
    this.createBulletTracer(this.camera.position, rayEnd);

    return { hit: false };
  }

  private createBulletTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    const points = [
      start.clone().add(new THREE.Vector3(0.2, -0.2, 0)),
      end
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xffea78, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geom, mat);
    this.scene.add(line);

    setTimeout(() => {
      this.scene.remove(line);
      geom.dispose();
      mat.dispose();
    }, 45);
  }

  private createImpactSparks(position: THREE.Vector3, normal: THREE.Vector3): void {
    const count = 8;
    const sparkGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Random spark velocity along normal
      const vel = normal.clone().multiplyScalar(3 + Math.random() * 5);
      vel.x += (Math.random() - 0.5) * 4;
      vel.y += (Math.random() - 0.5) * 4;
      vel.z += (Math.random() - 0.5) * 4;
      velocities.push(vel);
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffaa22,
      size: 0.15,
      transparent: true,
      opacity: 1.0,
    });

    const sparks = new THREE.Points(sparkGeo, sparkMat);
    this.particleGroup.add(sparks);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.05;
      const posArr = sparkGeo.attributes.position.array as Float32Array;

      for (let i = 0; i < count; i++) {
        posArr[i * 3 + 0] += velocities[i].x * 0.02;
        posArr[i * 3 + 1] += (velocities[i].y - 9.8 * progress) * 0.02;
        posArr[i * 3 + 2] += velocities[i].z * 0.02;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = 1 - progress;

      if (progress >= 1) {
        clearInterval(interval);
        this.particleGroup.remove(sparks);
        sparkGeo.dispose();
        sparkMat.dispose();
      }
    }, 20);
  }
}
