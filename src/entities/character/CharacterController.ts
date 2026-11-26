import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { InputManager } from '../../core/InputManager';
import { CityManager } from '../../world/CityManager';

export class CharacterController {
  public rigidBody: RAPIER.RigidBody;
  public collider: RAPIER.Collider;

  public position: THREE.Vector3 = new THREE.Vector3();
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  public isGrounded: boolean = true;
  public currentSpeed: number = 0;
  public isMoving: boolean = false;

  // Movement parameters
  public walkSpeed: number = 6.0;    // m/s (~22 km/h)
  public sprintSpeed: number = 12.5; // m/s (~45 km/h)
  public jumpForce: number = 8.5;    // m/s
  public gravity: number = -24.0;    // m/s^2

  private verticalVelocity: number = 0;
  private moveDirection: THREE.Vector3 = new THREE.Vector3();
  private targetRotationY: number = 0;

  constructor(
    private physicsWorld: PhysicsWorld,
    spawnPoint: THREE.Vector3
  ) {
    this.position.copy(spawnPoint);

    // Dynamic Kinematic RigidBody for character
    const bodyDesc = physicsWorld.rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(spawnPoint.x, spawnPoint.y + 0.48, spawnPoint.z);
    this.rigidBody = physicsWorld.world.createRigidBody(bodyDesc);

    // Capsule Collider (scaled for 0.95m human)
    const capsuleDesc = physicsWorld.rapier.ColliderDesc.capsule(0.24, 0.20)
      .setFriction(0.0)
      .setRestitution(0.0);
    this.collider = physicsWorld.world.createCollider(capsuleDesc, this.rigidBody);
  }

  public update(
    delta: number,
    input: InputManager,
    cameraAngleY: number,
    cityManager?: CityManager
  ): void {
    const inputState = input.state;

    // 1. Calculate movement vectors relative to camera view
    // Camera forward vector in world space (looking into scene)
    const camFwdX = -Math.sin(cameraAngleY);
    const camFwdZ = -Math.cos(cameraAngleY);

    // Camera right vector in world space (perpendicular to forward)
    const camRightX = Math.cos(cameraAngleY);
    const camRightZ = -Math.sin(cameraAngleY);

    // Forward/Backward: W or ArrowUp (+1) / S or ArrowDown (-1)
    const fwdInput = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
    // Left/Right: D or ArrowRight (+1) / A or ArrowLeft (-1)
    const sideInput = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);

    const hasInput = fwdInput !== 0 || sideInput !== 0;
    const speed = inputState.sprint ? this.sprintSpeed : this.walkSpeed;

    this.moveDirection.set(0, 0, 0);
    this.isMoving = hasInput;

    if (hasInput) {
      // Combine forward and sideways directions
      const moveX = camFwdX * fwdInput + camRightX * sideInput;
      const moveZ = camFwdZ * fwdInput + camRightZ * sideInput;
      this.moveDirection.set(moveX, 0, moveZ).normalize();

      // Hero model faces the exact direction of movement
      this.targetRotationY = Math.atan2(this.moveDirection.x, this.moveDirection.z);
    }

    // Smooth character rotation towards target movement angle
    const rotDiff = THREE.MathUtils.euclideanModulo(this.targetRotationY - this.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    this.rotation.y += rotDiff * Math.min(delta * 14, 1);

    // Calculate next horizontal position
    const moveDist = (hasInput ? speed : 0) * delta;
    const nextX = this.position.x + this.moveDirection.x * moveDist;
    const nextZ = this.position.z + this.moveDirection.z * moveDist;

    // 2. Query exact road surface height at (nextX, nextZ)
    const roadY = cityManager ? cityManager.getGroundHeight(nextX, nextZ, this.position.y) : 6.18;

    // 3. Grounding & Jump Physics
    if (this.isGrounded) {
      if (inputState.jump) {
        this.verticalVelocity = this.jumpForce;
        this.isGrounded = false;
        this.position.y += this.verticalVelocity * delta;
      } else {
        // Firmly track road elevation uphill and downhill
        this.verticalVelocity = 0;
        this.position.y = THREE.MathUtils.lerp(this.position.y, roadY, Math.min(delta * 25, 1));
      }
    } else {
      // In air (Jumping / Falling)
      this.verticalVelocity += this.gravity * delta;
      this.position.y += this.verticalVelocity * delta;

      // Landing check on road surface
      if (this.position.y <= roadY) {
        this.position.y = roadY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    }

    this.position.x = nextX;
    this.position.z = nextZ;

    // 4. Sync Rapier Kinematic translation
    this.rigidBody.setTranslation(
      { x: this.position.x, y: this.position.y + 0.48, z: this.position.z },
      true
    );

    this.currentSpeed = hasInput ? speed : 0;
  }

  public teleport(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.rigidBody.setTranslation({ x: pos.x, y: pos.y + 0.48, z: pos.z }, true);
    this.verticalVelocity = 0;
    this.isGrounded = true;
  }
}
