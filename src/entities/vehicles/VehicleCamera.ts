import * as THREE from 'three';
import { InputManager } from '../../core/InputManager';
import { VehicleBase } from './VehicleBase';
import { EventBus } from '../../core/EventBus';

export class VehicleCamera {
  public camera: THREE.PerspectiveCamera;
  public distance: number = 3.8;
  public height: number = 1.35;
  public currentYaw: number = 0;
  public currentPitch: number = 0.12;
  private currentPosition: THREE.Vector3 = new THREE.Vector3();
  private isFirstFrame: boolean = true;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    EventBus.getInstance().on('PLAYER_ENTER_VEHICLE', ({ vehicle }: { vehicle: VehicleBase }) => {
      this.snapToVehicle(vehicle);
    });

    EventBus.getInstance().on('PLAYER_EXIT_VEHICLE', () => {
      this.isFirstFrame = true;
    });
  }

  public snapToVehicle(vehicle: VehicleBase): void {
    const vehicleYaw = vehicle.group.rotation.y;
    this.currentYaw = vehicleYaw;
    this.currentPitch = 0.12;

    const vehiclePos = vehicle.getPosition();
    const camX = vehiclePos.x - Math.sin(this.currentYaw) * this.distance;
    const camY = vehiclePos.y + this.height + Math.sin(this.currentPitch) * this.distance;
    const camZ = vehiclePos.z - Math.cos(this.currentYaw) * this.distance;

    this.currentPosition.set(camX, camY, camZ);
    this.camera.position.copy(this.currentPosition);

    const lookTarget = vehiclePos.clone().add(new THREE.Vector3(0, 0.60, 0));
    this.camera.lookAt(lookTarget);
    this.isFirstFrame = false;
  }

  public update(delta: number, input: InputManager, vehicle: VehicleBase): void {
    const vehiclePos = vehicle.getPosition();

    if (this.isFirstFrame) {
      this.snapToVehicle(vehicle);
    }

    // Mouse camera orbit adjustment while driving
    if (input.isMouseDown && (Math.abs(input.state.mouseDeltaX) > 0 || Math.abs(input.state.mouseDeltaY) > 0)) {
      this.currentYaw -= input.state.mouseDeltaX * 0.0025;
      this.currentPitch += input.state.mouseDeltaY * 0.0025;
      this.currentPitch = Math.max(-0.15, Math.min(Math.PI / 3.2, this.currentPitch));
    } else {
      // Naturally smoothly align behind vehicle
      const vehicleYaw = vehicle.group.rotation.y;
      const angleDiff = THREE.MathUtils.euclideanModulo(vehicleYaw - this.currentYaw + Math.PI, Math.PI * 2) - Math.PI;
      this.currentYaw += angleDiff * Math.min(delta * 5.0, 1);
    }

    // Dynamic FOV pull back subtly at high speed (kept between 60 - 66 degrees)
    const speedKmH = Math.abs(vehicle.speed);
    const targetFOV = 60 + Math.min(speedKmH / 18, 6);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 5);
    this.camera.updateProjectionMatrix();

    // Calculate camera position behind vehicle
    const camX = vehiclePos.x - Math.sin(this.currentYaw) * this.distance;
    const camY = vehiclePos.y + this.height + Math.sin(this.currentPitch) * this.distance;
    const camZ = vehiclePos.z - Math.cos(this.currentYaw) * this.distance;

    const targetPos = new THREE.Vector3(camX, camY, camZ);
    this.currentPosition.lerp(targetPos, Math.min(delta * 12, 1));
    this.camera.position.copy(this.currentPosition);

    // Look at vehicle center + slight elevation for perfect framing
    const lookTarget = vehiclePos.clone().add(new THREE.Vector3(0, 0.60, 0));
    this.camera.lookAt(lookTarget);
  }
}
