import * as THREE from 'three';
import { InputManager } from '../../core/InputManager';
import { CityManager } from '../../world/CityManager';

export class ThirdPersonCamera {
  public camera: THREE.PerspectiveCamera;
  public target: THREE.Vector3 = new THREE.Vector3();

  // Spherical orbit coordinates (radians)
  // yaw = 0 places camera at +Z (behind player), looking into -Z
  public yaw: number = 0;
  public pitch: number = 0.18; // slightly looking down from behind
  public targetYaw: number = 0;
  public targetPitch: number = 0.18;

  // Distances (GTA San Andreas style)
  public distance: number = 2.1;
  public targetDistance: number = 2.1;
  private readonly defaultDistance: number = 2.1;
  private readonly sprintDistance: number = 2.6;

  // Sensitivity & limits (tuned for mouse/trackpad drag)
  public mouseSensitivity: number = 0.0035;
  public minPitch: number = -0.25;  // looking up from ground
  public maxPitch: number = 1.10;   // looking down from above

  // GTA-style Framing: centered directly behind hero's upper torso
  public heightOffset: number = 0.82;
  private defaultFOV: number = 65;

  // Smooth position tracking
  private currentPosition: THREE.Vector3 = new THREE.Vector3();
  private lookTarget: THREE.Vector3 = new THREE.Vector3();
  private currentLookTarget: THREE.Vector3 = new THREE.Vector3();
  private isInitialized: boolean = false;

  // User manual interaction timer
  private manualMouseTimer: number = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.defaultFOV = camera.fov;
  }

  public update(
    delta: number,
    input: InputManager,
    playerPos: THREE.Vector3,
    heroRotationY: number,
    isHeroMoving: boolean,
    cityManager?: CityManager
  ): void {
    const inputState = input.state;

    // 1. Mouse / Trackpad Drag Orbiting (Cursor visible at all times)
    const hasMouseDelta = Math.abs(inputState.mouseDeltaX) > 0.001 || Math.abs(inputState.mouseDeltaY) > 0.001;

    if (hasMouseDelta) {
      this.manualMouseTimer = 0;
      // Dragging right rotates view right (targetYaw decreases)
      // Dragging left rotates view left (targetYaw increases)
      this.targetYaw -= inputState.mouseDeltaX * this.mouseSensitivity;
      // Dragging down tilts camera down (pitch increases)
      // Dragging up tilts camera up (pitch decreases)
      this.targetPitch += inputState.mouseDeltaY * this.mouseSensitivity;
    } else {
      this.manualMouseTimer += delta;
    }

    // 2. GTA San Andreas Camera: When hero turns or moves,
    // camera automatically pans and steers to stay directly behind hero's back!
    if (isHeroMoving && this.manualMouseTimer > 0.25) {
      // The angle directly behind the hero's back
      const heroBehindYaw = THREE.MathUtils.euclideanModulo(heroRotationY - Math.PI + Math.PI, Math.PI * 2) - Math.PI;
      const angleDiff = THREE.MathUtils.euclideanModulo(heroBehindYaw - this.targetYaw + Math.PI, Math.PI * 2) - Math.PI;
      // Smoothly steer camera behind hero's back
      this.targetYaw += angleDiff * Math.min(delta * 4.5, 1);
    }

    // Clamp pitch
    this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));

    // Smooth interpolation for fluid cinematic feel
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, Math.min(delta * 18, 1));
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, Math.min(delta * 18, 1));

    // Dynamic distance when sprinting
    if (inputState.sprint && isHeroMoving) {
      this.targetDistance = this.sprintDistance;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.defaultFOV + 3, Math.min(delta * 6, 1));
    } else {
      this.targetDistance = this.defaultDistance;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.defaultFOV, Math.min(delta * 6, 1));
    }
    this.camera.updateProjectionMatrix();

    this.distance = THREE.MathUtils.lerp(this.distance, this.targetDistance, Math.min(delta * 8, 1));

    // 3. Compute Look Target at character's upper torso
    this.lookTarget.set(
      playerPos.x,
      playerPos.y + this.heightOffset,
      playerPos.z
    );

    if (!this.isInitialized) {
      this.currentLookTarget.copy(this.lookTarget);
    } else {
      this.currentLookTarget.lerp(this.lookTarget, Math.min(delta * 18, 1));
    }

    // 4. Compute Camera Position Behind Player
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    // Camera sits directly behind player
    const offsetX = sinYaw * cosPitch * this.distance;
    const offsetZ = cosYaw * cosPitch * this.distance;
    const offsetY = sinPitch * this.distance;

    const desiredCamPos = new THREE.Vector3(
      this.currentLookTarget.x + offsetX,
      this.currentLookTarget.y + offsetY,
      this.currentLookTarget.z + offsetZ
    );

    // 5. Anti-Clip Ground Collision: camera never goes under the road
    const minGroundY = cityManager ? cityManager.getGroundHeight(desiredCamPos.x, desiredCamPos.z, desiredCamPos.y) : playerPos.y;
    if (desiredCamPos.y < minGroundY + 0.35) {
      desiredCamPos.y = minGroundY + 0.35;
    }

    // 6. Smooth Camera Translation
    if (!this.isInitialized) {
      this.currentPosition.copy(desiredCamPos);
      this.isInitialized = true;
    } else {
      this.currentPosition.lerp(desiredCamPos, Math.min(delta * 16, 1));
    }

    this.camera.position.copy(this.currentPosition);

    // 7. Camera looks directly at hero
    this.camera.lookAt(this.currentLookTarget);
  }
}
