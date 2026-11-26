import * as THREE from 'three';
import { VehicleBase } from './VehicleBase';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { InputManager } from '../../core/InputManager';
import { EventBus } from '../../core/EventBus';

export class Boat extends VehicleBase {
  private propeller?: THREE.Mesh;
  private currentYaw: number = 0;
  private currentSpeedMs: number = 0;
  private waterLevel: number = 0;

  constructor(physicsWorld: PhysicsWorld, initialPosition: THREE.Vector3) {
    super(physicsWorld, initialPosition, 'boat', 'Speeder Motorboat');
    this.maxSpeed = 110;
    this.acceleration = 18;
    this.waterLevel = initialPosition.y;
    this.driverSeatOffset.set(0, 0.4, 0);
    this.exitOffset.set(-1.8, 0, 0);

    this.buildModel();
    this.setupPhysics();
  }

  public buildModel(): void {
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x0066cc, roughness: 0.2, metalness: 0.6 }); // Marine Blue
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x113355, transparent: true, opacity: 0.6, roughness: 0.1 });

    // V-shaped Speedboat Hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 5.2), hullMat);
    hull.position.y = 0.45;
    hull.castShadow = true;
    this.group.add(hull);

    // Deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 4.8), deckMat);
    deck.position.set(0, 0.9, 0);
    this.group.add(deck);

    // Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.15), glassMat);
    windshield.position.set(0, 1.2, 0.8);
    this.group.add(windshield);

    // Outboard Motor
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    motor.position.set(0, 0.5, -2.7);
    this.group.add(motor);

    this.group.position.copy(this.initialPosition);
  }

  private setupPhysics(): void {
    const bodyDesc = this.physicsWorld.rapier.RigidBodyDesc.dynamic()
      .setTranslation(this.initialPosition.x, this.initialPosition.y, this.initialPosition.z)
      .setLinearDamping(1.2)
      .setAngularDamping(3.0)
      .setCanSleep(false);

    this.rigidBody = this.physicsWorld.world.createRigidBody(bodyDesc);
    const colliderDesc = this.physicsWorld.rapier.ColliderDesc.cuboid(1.1, 0.5, 2.6);
    this.collider = this.physicsWorld.world.createCollider(colliderDesc, this.rigidBody);
  }

  public update(delta: number, input: InputManager): void {
    if (!this.rigidBody) return;

    if (this.isOccupied) {
      const inputState = input.state;
      const throttle = inputState.forward ? 1 : inputState.backward ? -0.4 : 0;
      const steer = inputState.left ? 1 : inputState.right ? -1 : 0;

      const speedFactor = Math.min(Math.abs(this.currentSpeedMs) / 8, 1.0);
      if (throttle !== 0 || Math.abs(this.currentSpeedMs) > 0.5) {
        this.currentYaw += steer * (this.currentSpeedMs >= 0 ? 1 : -1) * speedFactor * delta * 2.5;
      }

      if (throttle > 0) {
        this.currentSpeedMs = Math.min(this.currentSpeedMs + this.acceleration * delta, this.maxSpeed / 3.6);
      } else if (throttle < 0) {
        this.currentSpeedMs = Math.max(this.currentSpeedMs - this.acceleration * delta, -8);
      } else {
        this.currentSpeedMs = THREE.MathUtils.lerp(this.currentSpeedMs, 0, delta * 1.5);
      }

      // Water buoyancy: keep boat floating at water surface
      const currentPos = this.rigidBody.translation();
      const buoyancyForce = (this.waterLevel - currentPos.y) * 15.0;

      const forwardDir = new THREE.Vector3(Math.sin(this.currentYaw), 0, Math.cos(this.currentYaw));
      this.rigidBody.setLinvel(
        {
          x: forwardDir.x * this.currentSpeedMs,
          y: buoyancyForce,
          z: forwardDir.z * this.currentSpeedMs,
        },
        true
      );

      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.currentYaw);
      this.rigidBody.setRotation(q, true);

      this.speed = Math.abs(Math.round(this.currentSpeedMs * 3.6));
      EventBus.getInstance().emit('SPEED_CHANGE', { speed: this.speed, maxSpeed: this.maxSpeed });
    }

    const t = this.rigidBody.translation();
    const r = this.rigidBody.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
  }
}
