import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { VehicleBase } from './VehicleBase';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { InputManager } from '../../core/InputManager';
import { EventBus } from '../../core/EventBus';

export class Car extends VehicleBase {
  private wheels: THREE.Mesh[] = [];
  private frontWheelPivots: THREE.Group[] = [];
  private headlights: THREE.SpotLight[] = [];
  private currentYaw: number = 0;
  private currentSpeedMs: number = 0;

  constructor(physicsWorld: PhysicsWorld, initialPosition: THREE.Vector3) {
    super(physicsWorld, initialPosition, 'car', 'Infernus Sports Car');
    this.maxSpeed = 190;
    this.acceleration = 32;

    this.buildModel();
    this.setupPhysics();
  }

  public buildModel(): void {
    const carMat = new THREE.MeshStandardMaterial({
      color: 0xd91424, // GTA Rosso Corsa Red
      roughness: 0.15,
      metalness: 0.75,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x112233,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.7,
    });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });

    // Chassis / Body
    const bodyGeo = new THREE.BoxGeometry(2.1, 0.65, 4.4);
    const body = new THREE.Mesh(bodyGeo, carMat);
    body.position.y = 0.55;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Cabin / Roof
    const roofGeo = new THREE.BoxGeometry(1.6, 0.55, 2.2);
    const roof = new THREE.Mesh(roofGeo, glassMat);
    roof.position.set(0, 1.05, -0.2);
    roof.castShadow = true;
    this.group.add(roof);

    // Front Bumper / Hood slope
    const hoodGeo = new THREE.BoxGeometry(1.9, 0.25, 1.2);
    const hood = new THREE.Mesh(hoodGeo, carMat);
    hood.position.set(0, 0.7, 1.4);
    this.group.add(hood);

    // Rear Spoiler
    const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.35), blackMat);
    spoilerWing.position.set(0, 1.2, -1.9);
    spoilerWing.castShadow = true;
    this.group.add(spoilerWing);

    // 4 Wheels (Front-Left, Front-Right, Rear-Left, Rear-Right)
    const wheelPositions = [
      { x: -1.05, y: 0.35, z: 1.35, isFront: true },
      { x: 1.05, y: 0.35, z: 1.35, isFront: true },
      { x: -1.05, y: 0.35, z: -1.35, isFront: false },
      { x: 1.05, y: 0.35, z: -1.35, isFront: false },
    ];

    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    wheelPositions.forEach((wp) => {
      const pivot = new THREE.Group();
      pivot.position.set(wp.x, wp.y, wp.z);

      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wheelMesh.castShadow = true;

      // Rim details
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 8), rimMat);
      rim.rotateZ(Math.PI / 2);
      wheelMesh.add(rim);

      pivot.add(wheelMesh);
      this.group.add(pivot);

      this.wheels.push(wheelMesh);
      if (wp.isFront) {
        this.frontWheelPivots.push(pivot);
      }
    });

    // Headlights
    [-0.7, 0.7].forEach((x) => {
      const spot = new THREE.SpotLight(0xfffae6, 0, 80, Math.PI / 5, 0.3, 1.5);
      spot.position.set(x, 0.6, 2.2);
      spot.target.position.set(x, 0, 20);
      this.group.add(spot);
      this.group.add(spot.target);
      this.headlights.push(spot);
    });

    // Set initial position
    this.group.position.copy(this.initialPosition);
  }

  private setupPhysics(): void {
    // Dynamic physics rigid body for car
    const bodyDesc = this.physicsWorld.rapier.RigidBodyDesc.dynamic()
      .setTranslation(this.initialPosition.x, this.initialPosition.y + 0.5, this.initialPosition.z)
      .setLinearDamping(0.8)
      .setAngularDamping(2.5)
      .setCanSleep(false);

    this.rigidBody = this.physicsWorld.world.createRigidBody(bodyDesc);

    // Box collider matching car chassis
    const colliderDesc = this.physicsWorld.rapier.ColliderDesc.cuboid(1.05, 0.45, 2.2)
      .setFriction(0.6)
      .setRestitution(0.1);
    this.collider = this.physicsWorld.world.createCollider(colliderDesc, this.rigidBody);
  }

  public update(delta: number, input: InputManager): void {
    if (!this.rigidBody) return;

    if (this.isOccupied) {
      const inputState = input.state;

      // Throttle & Brake
      const accel = inputState.forward ? 1 : inputState.backward ? -0.5 : 0;
      const steer = inputState.left ? 1 : inputState.right ? -1 : 0;

      // Steer angle smoothing
      this.steerAngle = THREE.MathUtils.lerp(
        this.steerAngle,
        steer * this.maxSteerAngle,
        delta * 8
      );

      // Rotate front wheels visually
      this.frontWheelPivots.forEach((pivot) => {
        pivot.rotation.y = this.steerAngle;
      });

      // Turning based on speed and steer angle
      const speedFactor = Math.min(Math.abs(this.currentSpeedMs) / 10, 1.0);
      if (accel !== 0 || Math.abs(this.currentSpeedMs) > 0.5) {
        this.currentYaw += this.steerAngle * (this.currentSpeedMs >= 0 ? 1 : -1) * speedFactor * delta * 2.8;
      }

      // Acceleration
      if (accel > 0) {
        this.currentSpeedMs = Math.min(
          this.currentSpeedMs + this.acceleration * delta,
          this.maxSpeed / 3.6
        );
      } else if (accel < 0) {
        this.currentSpeedMs = Math.max(
          this.currentSpeedMs - this.acceleration * 0.7 * delta,
          -15
        );
      } else {
        // Natural friction/drag
        this.currentSpeedMs = THREE.MathUtils.lerp(this.currentSpeedMs, 0, delta * 1.5);
      }

      // Handbrake drift
      if (inputState.handbrake) {
        this.currentSpeedMs = THREE.MathUtils.lerp(this.currentSpeedMs, 0, delta * 3.5);
      }

      // Apply linear velocity along car's forward vector
      const forwardDir = new THREE.Vector3(
        Math.sin(this.currentYaw),
        0,
        Math.cos(this.currentYaw)
      );

      const currentVel = this.rigidBody.linvel();
      this.rigidBody.setLinvel(
        {
          x: forwardDir.x * this.currentSpeedMs,
          y: currentVel.y, // preserve gravity
          z: forwardDir.z * this.currentSpeedMs,
        },
        true
      );

      // Update rotation
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.currentYaw);
      this.rigidBody.setRotation(q, true);

      // Spin wheels
      const wheelSpin = (this.currentSpeedMs / 0.38) * delta;
      this.wheels.forEach((w) => {
        w.rotation.x += wheelSpin;
      });

      // Headlights toggle
      this.headlights.forEach((h) => {
        h.intensity = inputState.headlights ? 6.0 : 0.0;
      });

      // Speed in km/h
      this.speed = Math.abs(Math.round(this.currentSpeedMs * 3.6));
      EventBus.getInstance().emit('SPEED_CHANGE', { speed: this.speed, maxSpeed: this.maxSpeed });
    } else {
      // Unoccupied drag
      this.currentSpeedMs = THREE.MathUtils.lerp(this.currentSpeedMs, 0, delta * 2.0);
    }

    // Sync Three.js mesh with Rapier physics translation & rotation
    const t = this.rigidBody.translation();
    const r = this.rigidBody.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
  }
}
