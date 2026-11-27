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
  public turnRate: number = 0;

  // Movement parameters (Tuned for smooth, realistic human speeds)
  public walkSpeed: number = 3.2;    // m/s (~11.5 km/h, comfortable natural jog)
  public sprintSpeed: number = 5.6;  // m/s (~20 km/h, athletic smooth sprint)
  public jumpForce: number = 6.0;    // m/s (~0.8m jump height)
  public gravity: number = -20.0;    // m/s^2

  private verticalVelocity: number = 0;
  private moveDirection: THREE.Vector3 = new THREE.Vector3();
  private targetMoveDirection: THREE.Vector3 = new THREE.Vector3();
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
    const targetSpeed = inputState.sprint ? this.sprintSpeed : this.walkSpeed;

    this.isMoving = hasInput;

    if (hasInput) {
      // Compute desired direction vector
      const moveX = camFwdX * fwdInput + camRightX * sideInput;
      const moveZ = camFwdZ * fwdInput + camRightZ * sideInput;
      this.targetMoveDirection.set(moveX, 0, moveZ).normalize();

      // Target facing angle
      this.targetRotationY = Math.atan2(this.targetMoveDirection.x, this.targetMoveDirection.z);

      // Smoothly blend movement direction into a continuous curve
      this.moveDirection.lerp(this.targetMoveDirection, Math.min(delta * 8.0, 1.0));
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, Math.min(delta * 6.5, 1.0));
    } else {
      // Smooth deceleration to stop
      this.moveDirection.lerp(new THREE.Vector3(0, 0, 0), Math.min(delta * 8.0, 1.0));
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, Math.min(delta * 7.5, 1.0));
    }

    // 2. Smooth character turning with natural human angular velocity
    const rotDiff = THREE.MathUtils.euclideanModulo(this.targetRotationY - this.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    this.rotation.y += rotDiff * Math.min(delta * 7.0, 1.0);
    this.turnRate = rotDiff;

    // 3. Calculate next horizontal position
    const moveDist = this.currentSpeed * delta;
    const nextX = this.position.x + this.moveDirection.x * moveDist;
    const nextZ = this.position.z + this.moveDirection.z * moveDist;

    // 4. Query exact road surface height at (nextX, nextZ)
    const roadY = cityManager ? cityManager.getGroundHeight(nextX, nextZ, this.position.y) : 6.18;

    // 5. Grounding & Jump Physics (Smooth elevation tracking absorbs polygon seams and curbs)
    if (this.isGrounded) {
      if (inputState.jump) {
        this.verticalVelocity = this.jumpForce;
        this.isGrounded = false;
        this.position.y += this.verticalVelocity * delta;
      } else {
        this.verticalVelocity = 0;
        const yDiff = roadY - this.position.y;
        if (Math.abs(yDiff) < 0.65) {
          // Smoothly glide along the road elevation
          this.position.y = THREE.MathUtils.lerp(this.position.y, roadY, Math.min(delta * 12.0, 1.0));
        } else if (yDiff < -0.65) {
          // Walked off high ledge
          this.isGrounded = false;
        } else {
          this.position.y = roadY;
        }
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

    // 6. Sync Rapier Kinematic translation
    this.rigidBody.setTranslation(
      { x: this.position.x, y: this.position.y + 0.48, z: this.position.z },
      true
    );
  }

  public teleport(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.rigidBody.setTranslation({ x: pos.x, y: pos.y + 0.48, z: pos.z }, true);
  }
}
