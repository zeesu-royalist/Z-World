import * as THREE from 'three';
import { VehicleBase } from './VehicleBase';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { InputManager } from '../../core/InputManager';
import { EventBus } from '../../core/EventBus';

export class Motorcycle extends VehicleBase {
  private frontWheel?: THREE.Mesh;
  private rearWheel?: THREE.Mesh;
  private currentYaw: number = 0;
  private leanAngle: number = 0;
  private currentSpeedMs: number = 0;

  constructor(physicsWorld: PhysicsWorld, initialPosition: THREE.Vector3) {
    super(physicsWorld, initialPosition, 'bike', 'Pegassi Bati 801');
    this.maxSpeed = 210;
    this.acceleration = 45;
    this.driverSeatOffset.set(0, 0.45, 0);
    this.exitOffset.set(-1.2, 0, 0);

    this.buildModel();
    this.setupPhysics();
  }

  public buildModel(): void {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x00cc44, roughness: 0.2, metalness: 0.8 }); // Kawasaki Lime Green
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    // Main frame / tank
    const tankGeo = new THREE.BoxGeometry(0.5, 0.4, 1.2);
    const tank = new THREE.Mesh(tankGeo, frameMat);
    tank.position.set(0, 0.7, 0);
    tank.castShadow = true;
    this.group.add(tank);

    // Engine block
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.6), metalMat);
    engine.position.set(0, 0.4, -0.1);
    this.group.add(engine);

    // Handlebars
    const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), metalMat);
    handleBar.position.set(0, 0.95, 0.45);
    this.group.add(handleBar);

    // Front & Rear Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.16, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    this.frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.frontWheel.position.set(0, 0.35, 0.85);
    this.frontWheel.castShadow = true;
    this.group.add(this.frontWheel);

    this.rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.rearWheel.position.set(0, 0.35, -0.75);
    this.rearWheel.castShadow = true;
    this.group.add(this.rearWheel);

    this.group.position.copy(this.initialPosition);
  }

  private setupPhysics(): void {
    const bodyDesc = this.physicsWorld.rapier.RigidBodyDesc.dynamic()
      .setTranslation(this.initialPosition.x, this.initialPosition.y + 0.4, this.initialPosition.z)
      .setLinearDamping(0.8)
      .setAngularDamping(3.0)
      .setCanSleep(false);

    this.rigidBody = this.physicsWorld.world.createRigidBody(bodyDesc);
    const colliderDesc = this.physicsWorld.rapier.ColliderDesc.cuboid(0.3, 0.45, 1.1)
      .setFriction(0.7);
    this.collider = this.physicsWorld.world.createCollider(colliderDesc, this.rigidBody);
  }

  public update(delta: number, input: InputManager): void {
    if (!this.rigidBody) return;

    if (this.isOccupied) {
      const inputState = input.state;
      const accel = inputState.forward ? 1 : inputState.backward ? -0.4 : 0;
      const steer = inputState.left ? 1 : inputState.right ? -1 : 0;

      // Motorcycle dynamic lean physics
      const targetLean = -steer * Math.min(Math.abs(this.currentSpeedMs) / 12, 0.45);
      this.leanAngle = THREE.MathUtils.lerp(this.leanAngle, targetLean, delta * 8);

      const speedFactor = Math.min(Math.abs(this.currentSpeedMs) / 10, 1.0);
      if (accel !== 0 || Math.abs(this.currentSpeedMs) > 0.5) {
        this.currentYaw += steer * (this.currentSpeedMs >= 0 ? 1 : -1) * speedFactor * delta * 3.2;
      }

      if (accel > 0) {
        this.currentSpeedMs = Math.min(this.currentSpeedMs + this.acceleration * delta, this.maxSpeed / 3.6);
      } else if (accel < 0) {
        this.currentSpeedMs = Math.max(this.currentSpeedMs - this.acceleration * 0.8 * delta, -12);
      } else {
        this.currentSpeedMs = THREE.MathUtils.lerp(this.currentSpeedMs, 0, delta * 1.8);
      }

      const forwardDir = new THREE.Vector3(Math.sin(this.currentYaw), 0, Math.cos(this.currentYaw));
      const currentVel = this.rigidBody.linvel();
      this.rigidBody.setLinvel(
        { x: forwardDir.x * this.currentSpeedMs, y: currentVel.y, z: forwardDir.z * this.currentSpeedMs },
        true
      );

      // Rotation with lean roll
      const euler = new THREE.Euler(0, this.currentYaw, this.leanAngle, 'YXZ');
      const q = new THREE.Quaternion().setFromEuler(euler);
      this.rigidBody.setRotation(q, true);

      // Spin wheels
      const wheelSpin = (this.currentSpeedMs / 0.35) * delta;
      if (this.frontWheel) this.frontWheel.rotation.x += wheelSpin;
      if (this.rearWheel) this.rearWheel.rotation.x += wheelSpin;

      this.speed = Math.abs(Math.round(this.currentSpeedMs * 3.6));
      EventBus.getInstance().emit('SPEED_CHANGE', { speed: this.speed, maxSpeed: this.maxSpeed });
    }

    const t = this.rigidBody.translation();
    const r = this.rigidBody.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
  }
}
