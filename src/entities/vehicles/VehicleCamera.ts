import * as THREE from 'three';
import { InputManager } from '../../core/InputManager';
import { VehicleBase } from './VehicleBase';

export class VehicleCamera {
  public camera: THREE.PerspectiveCamera;
  public distance: number = 7.5;
  public height: number = 2.4;
  public currentYaw: number = 0;
  public currentPitch: number = 0.18;
  private currentPosition: THREE.Vector3 = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  public update(delta: number, input: InputManager, vehicle: VehicleBase): void {
    const vehiclePos = vehicle.getPosition();

    // Mouse camera orbit adjustment while driving
    if (input.isMouseDown && (Math.abs(input.state.mouseDeltaX) > 0 || Math.abs(input.state.mouseDeltaY) > 0)) {
      this.currentYaw -= input.state.mouseDeltaX * 0.0025;
      this.currentPitch += input.state.mouseDeltaY * 0.0025;
      this.currentPitch = Math.max(-0.2, Math.min(Math.PI / 3, this.currentPitch));
    } else {
      // Naturally smoothly align behind vehicle
      const vehicleYaw = vehicle.group.rotation.y;
      const angleDiff = THREE.MathUtils.euclideanModulo(vehicleYaw - this.currentYaw + Math.PI, Math.PI * 2) - Math.PI;
      this.currentYaw += angleDiff * Math.min(delta * 4, 1);
    }

    // Dynamic FOV pull back at high speed
    const speedKmH = vehicle.speed;
    const targetFOV = 65 + Math.min(speedKmH / 6, 25);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 6);
    this.camera.updateProjectionMatrix();

    // Calculate camera position behind vehicle
    const camX = vehiclePos.x - Math.sin(this.currentYaw) * this.distance;
    const camY = vehiclePos.y + this.height + Math.sin(this.currentPitch) * this.distance;
    const camZ = vehiclePos.z - Math.cos(this.currentYaw) * this.distance;

    const targetPos = new THREE.Vector3(camX, camY, camZ);
    this.currentPosition.lerp(targetPos, Math.min(delta * 10, 1));
    this.camera.position.copy(this.currentPosition);

    // Look at vehicle center + slight height
    const lookTarget = vehiclePos.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.camera.lookAt(lookTarget);
  }
}
