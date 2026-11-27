import * as THREE from 'three';
import { InputManager } from '../../core/InputManager';
import { CityManager } from '../../world/CityManager';

/**
 * AAA-grade Third-Person Camera (GTA San Andreas style):
 * - Single smoothed focus point prevents second-order phase lag and wobbling
 * - Decoupled auto-steering with deadzone eliminates left-right oscillation while running forward
 * - Smooth vertical damping absorbs running footsteps, pavement curbs, and ground slope changes
 * - Mathematically bound camera position and look target guarantees a 100% rock-solid horizon
 */
export class ThirdPersonCamera {
  public camera: THREE.PerspectiveCamera;
  public target: THREE.Vector3 = new THREE.Vector3();

  // Spherical orbit coordinates (radians)
  // yaw = 0 places camera at +Z (behind player), looking into -Z
  public yaw: number = 0;
  public pitch: number = 0.18; // slightly looking down from behind
  public targetYaw: number = 0;
  public targetPitch: number = 0.18;

  // Distances (GTA San Andreas style tuned for 0.76m character)
  public distance: number = 1.80;
  public targetDistance: number = 1.80;
  private readonly defaultDistance: number = 1.80;
  private readonly sprintDistance: number = 2.15;

  // Sensitivity & limits (tuned for mouse/trackpad drag)
  public mouseSensitivity: number = 0.0035;
  public minPitch: number = -0.22;  // looking up from ground
  public maxPitch: number = 1.05;   // looking down from above

  // GTA-style Framing: centered directly behind hero's upper torso
  public heightOffset: number = 0.65;
  private defaultFOV: number = 65;

  // Single smoothed focus target
  private smoothedTarget: THREE.Vector3 = new THREE.Vector3();
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
    _cityManager?: CityManager
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

    // 2. GTA San Andreas Camera Auto-Steer:
    // Only gently drift camera behind hero if hero is deliberately turning/moving in a new direction
    // A deadzone of ±18 degrees prevents camera oscillation while running straight forward
    if (isHeroMoving && this.manualMouseTimer > 0.55) {
      const heroBehindYaw = THREE.MathUtils.euclideanModulo(heroRotationY - Math.PI + Math.PI, Math.PI * 2) - Math.PI;
      const angleDiff = THREE.MathUtils.euclideanModulo(heroBehindYaw - this.targetYaw + Math.PI, Math.PI * 2) - Math.PI;

      // Deadzone: if hero is running in line with camera view, do NOT steer
      if (Math.abs(angleDiff) > 0.30) {
        this.targetYaw += angleDiff * Math.min(delta * 1.5, 1.0);
      }
    }

    // Clamp pitch
    this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));

    // Smooth interpolation for orbit angles (fluid cinematic feel)
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, Math.min(delta * 12.0, 1.0));
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, Math.min(delta * 14.0, 1.0));

    // Dynamic distance when sprinting (gentle and smooth)
    if (inputState.sprint && isHeroMoving) {
      this.targetDistance = this.sprintDistance;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.defaultFOV + 2.5, Math.min(delta * 4.0, 1.0));
    } else {
      this.targetDistance = this.defaultDistance;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.defaultFOV, Math.min(delta * 4.0, 1.0));
    }
    this.camera.updateProjectionMatrix();

    this.distance = THREE.MathUtils.lerp(this.distance, this.targetDistance, Math.min(delta * 6.0, 1.0));

    // 3. Smooth Focus Target (Hero's upper torso)
    const rawTargetX = playerPos.x;
    const rawTargetY = playerPos.y + this.heightOffset;
    const rawTargetZ = playerPos.z;

    if (!this.isInitialized) {
      this.smoothedTarget.set(rawTargetX, rawTargetY, rawTargetZ);
      this.isInitialized = true;
    } else {
      // Horizontal tracking: responsive and crisp
      this.smoothedTarget.x = THREE.MathUtils.lerp(this.smoothedTarget.x, rawTargetX, Math.min(delta * 14.0, 1.0));
      this.smoothedTarget.z = THREE.MathUtils.lerp(this.smoothedTarget.z, rawTargetZ, Math.min(delta * 14.0, 1.0));

      // Vertical tracking: softer damping to absorb running footsteps, curbs, and ground slope changes
      this.smoothedTarget.y = THREE.MathUtils.lerp(this.smoothedTarget.y, rawTargetY, Math.min(delta * 8.5, 1.0));
    }

    // 4. Compute Camera Position from Smoothed Focus Target
    // Mathematical binding guarantees position and look target move in 100% perfect lockstep
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    const offsetX = sinYaw * cosPitch * this.distance;
    const offsetY = sinPitch * this.distance;
    const offsetZ = cosYaw * cosPitch * this.distance;

    let camX = this.smoothedTarget.x + offsetX;
    let camY = this.smoothedTarget.y + offsetY;
    let camZ = this.smoothedTarget.z + offsetZ;

    // 5. Anti-Clip Ground Margin: camera never dips below player's ground plane
    const minCameraY = playerPos.y + 0.32;
    if (camY < minCameraY) {
      camY = minCameraY;
    }

    this.camera.position.set(camX, camY, camZ);

    // 6. Camera looks at smoothed focus target (Rock-solid horizon with ZERO shake)
    this.camera.lookAt(this.smoothedTarget);
  }
}
