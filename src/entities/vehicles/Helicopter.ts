import * as THREE from 'three';
import { VehicleBase } from './VehicleBase';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { InputManager } from '../../core/InputManager';
import { EventBus } from '../../core/EventBus';

export class Helicopter extends VehicleBase {
  private mainRotor?: THREE.Mesh;
  private tailRotor?: THREE.Mesh;
  private rotorSpeed: number = 0;
  private pitch: number = 0;
  private roll: number = 0;
  private yaw: number = 0;
  private verticalVelocity: number = 0;

  constructor(physicsWorld: PhysicsWorld, initialPosition: THREE.Vector3) {
    super(physicsWorld, initialPosition, 'helicopter', 'Maverick Police Chopper');
    this.maxSpeed = 240;
    this.acceleration = 18;
    this.driverSeatOffset.set(0, 0.8, 0.4);
    this.exitOffset.set(-2.2, 0, 0);

    this.buildModel();
    this.setupPhysics();
  }

  public buildModel(): void {
    const fuselageMat = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.7, roughness: 0.3 }); // Police Black & White
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x224466, transparent: true, opacity: 0.65, roughness: 0.1 });
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });

    // Fuselage cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 3.6), fuselageMat);
    cabin.position.y = 1.4;
    cabin.castShadow = true;
    this.group.add(cabin);

    // Cockpit Glass
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.6), glassMat);
    cockpit.position.set(0, 1.6, 1.2);
    this.group.add(cockpit);

    // Tail Boom
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 4.2), fuselageMat);
    tail.position.set(0, 1.8, -3.2);
    tail.castShadow = true;
    this.group.add(tail);

    // Tail Fin
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.8), stripeMat);
    tailFin.position.set(0, 2.2, -5.2);
    this.group.add(tailFin);

    // Landing Skids
    [-0.9, 0.9].forEach((x) => {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.0), rotorMat);
      skid.rotateX(Math.PI / 2);
      skid.position.set(x, 0.2, 0);
      skid.castShadow = true;
      this.group.add(skid);
    });

    // Main Rotor Blades
    const rotorGeo = new THREE.BoxGeometry(8.5, 0.06, 0.4);
    this.mainRotor = new THREE.Mesh(rotorGeo, rotorMat);
    this.mainRotor.position.set(0, 2.5, 0);
    this.mainRotor.castShadow = true;
    this.group.add(this.mainRotor);

    // Tail Rotor
    const tailRotorGeo = new THREE.BoxGeometry(0.05, 1.6, 0.2);
    this.tailRotor = new THREE.Mesh(tailRotorGeo, rotorMat);
    this.tailRotor.position.set(0.2, 2.4, -5.2);
    this.group.add(this.tailRotor);

    this.group.position.copy(this.initialPosition);
  }

  private setupPhysics(): void {
    const bodyDesc = this.physicsWorld.rapier.RigidBodyDesc.dynamic()
      .setTranslation(this.initialPosition.x, this.initialPosition.y + 1.0, this.initialPosition.z)
      .setLinearDamping(0.6)
      .setAngularDamping(2.0)
      .setCanSleep(false);

    this.rigidBody = this.physicsWorld.world.createRigidBody(bodyDesc);
    const colliderDesc = this.physicsWorld.rapier.ColliderDesc.cuboid(1.2, 1.0, 2.4);
    this.collider = this.physicsWorld.world.createCollider(colliderDesc, this.rigidBody);
  }

  public update(delta: number, input: InputManager): void {
    if (!this.rigidBody) return;

    if (this.isOccupied) {
      const inputState = input.state;

      // Rotor spool up
      this.rotorSpeed = THREE.MathUtils.lerp(this.rotorSpeed, 28, delta * 2);

      // Controls:
      // Space/Shift = Climb, Crouch/C = Descend
      // W/S = Pitch forward/back, A/D = Yaw
      const climb = (inputState.sprint || inputState.jump ? 1 : 0) - (inputState.crouch ? 1 : 0);
      const pitchInput = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
      const yawInput = (inputState.left ? 1 : 0) - (inputState.right ? 1 : 0);

      this.yaw += yawInput * delta * 1.5;
      this.pitch = THREE.MathUtils.lerp(this.pitch, pitchInput * 0.35, delta * 4);
      this.roll = THREE.MathUtils.lerp(this.roll, -yawInput * 0.2, delta * 4);

      // Altitude
      this.verticalVelocity = THREE.MathUtils.lerp(
        this.verticalVelocity,
        climb * 12.0 + (this.rotorSpeed > 20 ? 0 : -9.8),
        delta * 3
      );

      // Forward velocity along pitch
      const forwardSpeed = this.pitch * 35.0;
      const forwardDir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));

      this.rigidBody.setLinvel(
        {
          x: forwardDir.x * forwardSpeed,
          y: this.verticalVelocity,
          z: forwardDir.z * forwardSpeed,
        },
        true
      );

      const euler = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ');
      this.rigidBody.setRotation(new THREE.Quaternion().setFromEuler(euler), true);

      this.speed = Math.round(Math.sqrt(forwardSpeed * forwardSpeed + this.verticalVelocity * this.verticalVelocity) * 3.6);
      EventBus.getInstance().emit('SPEED_CHANGE', { speed: this.speed, maxSpeed: this.maxSpeed });
    } else {
      this.rotorSpeed = THREE.MathUtils.lerp(this.rotorSpeed, 0, delta * 1.5);
    }

    // Spin rotors
    if (this.mainRotor) this.mainRotor.rotation.y += this.rotorSpeed * delta * 2;
    if (this.tailRotor) this.tailRotor.rotation.x += this.rotorSpeed * delta * 2.5;

    const t = this.rigidBody.translation();
    const r = this.rigidBody.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
  }
}
