import * as THREE from 'three';
import { VehicleBase } from './VehicleBase';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { InputManager } from '../../core/InputManager';
import { CityManager } from '../../world/CityManager';
import { CarDef, RoadRail, RoadWaypoint, ROAD_RAILS } from '../../world/RoadNetwork';

export class DrivableCar extends VehicleBase {
  public carDef: CarDef;
  public cityManager: CityManager;
  public carModel: THREE.Object3D;

  // AI navigation state (when not occupied by player)
  public rail: RoadRail | null = null;
  public currentWaypointIndex: number = 0;
  public targetWaypointIndex: number = 1;
  public segmentProgress: number = 0;
  public cruiseSpeed: number = 10.5; // m/s (~38 km/h realistic GTA city cruising speed)
  public currentSpeedMs: number = 0;
  public currentHeading: number = 0;
  public currentPitch: number = 0; // Slope incline / decline angle
  public isCompletedJourney: boolean = false; // Reached end of destination route
  public stuckTimer: number = 0;

  // Seamless intersection transition state
  public isTransitioningRail: boolean = false;
  private transitionWpA: RoadWaypoint | null = null;
  private transitionWpB: RoadWaypoint | null = null;
  private nextRailToAdopt: RoadRail | null = null;

  // Collision & Traffic Spacing state
  public isStoppedForObstacle: boolean = false;
  public distanceToHeroSq: number = 0;

  constructor(
    physicsWorld: PhysicsWorld,
    cityManager: CityManager,
    initialPosition: THREE.Vector3,
    carDef: CarDef,
    carModel: THREE.Object3D
  ) {
    super(physicsWorld, initialPosition, 'car', carDef.name);
    this.carDef = carDef;
    this.cityManager = cityManager;
    this.maxSpeed = carDef.baseMaxSpeed;
    this.acceleration = carDef.acceleration;
    this.interactionRadius = 2.8;

    // Driver seat and exit offsets adjusted for human scale
    this.driverSeatOffset.set(-0.20, carDef.height * 0.45, 0.05);
    this.exitOffset.set(-carDef.width * 0.5 - 0.5, 0, 0.1);

    this.carModel = carModel;
    this.group.add(this.carModel);
    this.group.rotation.order = 'YXZ';
    this.group.position.copy(this.initialPosition);
  }

  public buildModel(): void {
    // Model initialized in constructor
  }

  /**
   * Main update tick called each frame
   */
  public update(delta: number, input: InputManager): void {
    if (this.isOccupied) {
      this.updatePlayerDriving(delta, input);
    }
  }

  /**
   * Smooth, responsive GTA-style driving when player is inside the car
   */
  private updatePlayerDriving(delta: number, input: InputManager): void {
    const inputState = input.state;
    const maxSpeedMs = this.maxSpeed / 3.6;
    const reverseMaxSpeedMs = -5.5; // ~20 km/h reverse speed

    const isThrottle = inputState.forward;
    const isBrakeReverse = inputState.backward;
    const isHandbrake = inputState.jump; // Spacebar

    // Steering input with smooth damping
    const steerInput = (inputState.left ? 1 : 0) - (inputState.right ? 1 : 0);
    const targetSteer = steerInput * this.maxSteerAngle;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, delta * 7.0);

    // Longitudinal acceleration / braking
    if (isHandbrake) {
      this.currentSpeedMs = THREE.MathUtils.lerp(this.currentSpeedMs, 0, delta * 4.5);
      this.setTaillightsBraking(true);
    } else if (isThrottle) {
      this.currentSpeedMs += this.acceleration * delta;
      if (this.currentSpeedMs > maxSpeedMs) this.currentSpeedMs = maxSpeedMs;
      this.setTaillightsBraking(false);
    } else if (isBrakeReverse) {
      if (this.currentSpeedMs > 0.4) {
        // Active braking when moving forward
        this.currentSpeedMs -= Math.max(this.acceleration * 1.6, 14.0) * delta;
        if (this.currentSpeedMs < 0) this.currentSpeedMs = 0;
        this.setTaillightsBraking(true);
      } else {
        // Reversing
        this.currentSpeedMs -= (this.acceleration * 0.65) * delta;
        if (this.currentSpeedMs < reverseMaxSpeedMs) this.currentSpeedMs = reverseMaxSpeedMs;
        this.setTaillightsBraking(true);
      }
    } else {
      // Smooth engine coasting deceleration
      this.currentSpeedMs = THREE.MathUtils.lerp(this.currentSpeedMs, 0, delta * 1.5);
      if (Math.abs(this.currentSpeedMs) < 0.1) this.currentSpeedMs = 0;
      this.setTaillightsBraking(false);
    }

    // Steering yaw rotation with high-speed stability damping
    const speedRatio = Math.min(Math.abs(this.currentSpeedMs) / 7.0, 1.0);
    const steerDir = this.currentSpeedMs >= 0 ? 1 : -1;
    const speedDamping = 1.0 / (1.0 + Math.max(0, Math.abs(this.currentSpeedMs) - 6.0) * 0.04);
    this.currentHeading += this.steerAngle * steerDir * speedRatio * this.carDef.turnRate * speedDamping * delta;

    this.group.rotation.y = this.currentHeading;

    // Movement forward along heading (+Z forward)
    const forwardX = Math.sin(this.currentHeading);
    const forwardZ = Math.cos(this.currentHeading);

    const pos = this.group.position;
    pos.x += forwardX * this.currentSpeedMs * delta;
    pos.z += forwardZ * this.currentSpeedMs * delta;

    // Road ground elevation & dynamic slope pitch tracking
    // Sample road height at front and rear wheel axles tailored to vehicle length
    const halfWheelBase = Math.max(0.55, this.carDef.length * 0.38);
    const frontGroundY = this.cityManager.getGroundHeight(pos.x + forwardX * halfWheelBase, pos.z + forwardZ * halfWheelBase, pos.y);
    const rearGroundY = this.cityManager.getGroundHeight(pos.x - forwardX * halfWheelBase, pos.z - forwardZ * halfWheelBase, pos.y);
    const avgRoadY = (frontGroundY + rearGroundY) * 0.5;

    pos.y = THREE.MathUtils.lerp(pos.y, avgRoadY + 0.015, delta * 15.0);

    // Calculate slope pitch from front-to-rear elevation gradient
    const roadSlopeAngle = Math.atan2(frontGroundY - rearGroundY, halfWheelBase * 2.0);
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, -roadSlopeAngle, delta * 12.0);

    this.group.rotation.order = 'YXZ';
    this.group.rotation.y = this.currentHeading;
    this.group.rotation.x = this.currentPitch;

    // Sync HUD speed (km/h)
    this.speed = Math.round(Math.abs(this.currentSpeedMs) * 3.6);
  }

  /**
   * AI step along rail when car is in ambient city traffic
   */
  public updateAI(
    delta: number,
    playerPos: THREE.Vector3,
    distToPlayerSq: number,
    carInFrontDist: number | null
  ): void {
    if (this.isOccupied || !this.rail || this.rail.waypoints.length < 2) return;

    this.distanceToHeroSq = distToPlayerSq;

    // 1. Spacing check with car in front on the same lane
    let desiredSpeed = this.cruiseSpeed;
    let isBraking = false;

    if (carInFrontDist !== null) {
      if (carInFrontDist < 3.8) {
        desiredSpeed = 0;
        isBraking = true;
      } else if (carInFrontDist < 7.5) {
        desiredSpeed = this.cruiseSpeed * 0.45;
        isBraking = true;
      }
    }

    // 2. Player avoidance: If hero is standing directly in front of the car
    if (distToPlayerSq < 42.0) { // Within 6.5 meters
      const toPlayer = new THREE.Vector3().subVectors(playerPos, this.group.position);
      toPlayer.y = 0;
      const forward = new THREE.Vector3(Math.sin(this.currentHeading), 0, Math.cos(this.currentHeading));
      const dot = forward.dot(toPlayer.clone().normalize());

      if (dot > 0.65 && toPlayer.length() < 5.5) {
        desiredSpeed = 0;
        isBraking = true;
      }
    }

    // 3. Smooth acceleration / deceleration
    const lerpFactor = desiredSpeed < this.currentSpeedMs ? 6.0 : 2.5;
    this.currentSpeedMs = THREE.MathUtils.lerp(this.currentSpeedMs, desiredSpeed, delta * lerpFactor);
    if (this.currentSpeedMs < 0.2 && desiredSpeed === 0) {
      this.currentSpeedMs = 0;
      isBraking = true;
      this.stuckTimer += delta;
      // Anti-deadlock watchdog: if stuck stopped for > 2.0s, advance to unblock
      if (this.stuckTimer > 2.0) {
        this.stuckTimer = 0;
        this.advanceWaypoint();
        this.currentSpeedMs = this.cruiseSpeed * 0.6;
      }
    } else {
      this.stuckTimer = 0;
    }

    this.setTaillightsBraking(isBraking);
    this.speed = Math.round(this.currentSpeedMs * 3.6);

    if (this.currentSpeedMs === 0) return;

    // 4. Progress along road waypoints (100% pre-verified clean rails, zero CPU raycasts)
    let pA: RoadWaypoint;
    let pB: RoadWaypoint;

    if (this.isTransitioningRail && this.transitionWpA && this.transitionWpB) {
      pA = this.transitionWpA;
      pB = this.transitionWpB;
    } else {
      const wps = this.rail.waypoints;
      pA = wps[this.currentWaypointIndex];
      pB = wps[this.targetWaypointIndex];
    }

    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const dz = pB.z - pA.z;
    const hDist = Math.hypot(dx, dz);
    const segDist3D = Math.hypot(dx, dy, dz);

    if (segDist3D < 0.1) {
      this.advanceWaypoint();
      return;
    }

    // Dynamic slope pitch: tilts car nose up when climbing slopes, nose down when descending slopes
    const slopeAngle = Math.atan2(dy, Math.max(0.1, hDist));
    const targetPitch = -slopeAngle;
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, delta * 8.0);

    const targetHeading = Math.atan2(dx, dz);
    const angleDiff = THREE.MathUtils.euclideanModulo(targetHeading - this.currentHeading + Math.PI, Math.PI * 2) - Math.PI;

    // Smooth heading steering towards target waypoint (responsive at realistic city speed)
    this.currentHeading += angleDiff * Math.min(delta * 5.0, 0.32);

    // Apply rotation with YXZ order: Yaw first, then local slope pitch!
    this.group.rotation.order = 'YXZ';
    this.group.rotation.y = this.currentHeading;
    this.group.rotation.x = this.currentPitch;

    // Longitudinal progress eases slightly on sharp turns
    const alignmentFactor = Math.max(0.35, Math.cos(angleDiff));
    const stepDist = this.currentSpeedMs * delta * alignmentFactor;
    this.segmentProgress += stepDist / segDist3D;

    if (this.segmentProgress >= 1.0) {
      this.segmentProgress = 0;
      this.advanceWaypoint();
    } else {
      const t = this.segmentProgress;
      this.group.position.set(
        pA.x + dx * t,
        pA.y + dy * t + 0.015, // 1.5cm ground cushion keeps tires on road surface without z-fighting
        pA.z + dz * t
      );
    }
  }

  private advanceWaypoint(): void {
    if (!this.rail) return;

    if (this.isTransitioningRail) {
      // Completed smooth intersection transition to new rail
      if (this.nextRailToAdopt) {
        this.rail = this.nextRailToAdopt;
        this.currentWaypointIndex = 0;
        this.targetWaypointIndex = Math.min(1, this.rail.waypoints.length - 1);
        this.nextRailToAdopt = null;
      }
      this.isTransitioningRail = false;
      this.transitionWpA = null;
      this.transitionWpB = null;
      return;
    }

    const wps = this.rail.waypoints;

    if (this.targetWaypointIndex + 1 < wps.length) {
      this.currentWaypointIndex = this.targetWaypointIndex;
      this.targetWaypointIndex++;
    } else {
      // Reached the end of this road corridor!
      const lastWp = wps[wps.length - 1];
      const nextRail = this.findForwardConnectingRail(lastWp, this.currentHeading, this.rail.id);
      if (nextRail) {
        // Smoothly continue into intersecting forward/turning street
        this.transitionWpA = lastWp;
        this.transitionWpB = nextRail.waypoints[0];
        this.nextRailToAdopt = nextRail;
        this.isTransitioningRail = true;
      } else {
        // Car has reached its destination! Arrives and despawns in the distance (NEVER U-turns)
        this.isCompletedJourney = true;
      }
    }
  }

  private findForwardConnectingRail(endPoint: RoadWaypoint, currentHeading: number, currentRailId: string): RoadRail | null {
    const candidates: RoadRail[] = [];
    for (const r of ROAD_RAILS) {
      if (r.id === currentRailId || r.waypoints.length < 2) continue;
      const startWp = r.waypoints[0];
      const d = Math.hypot(startWp.x - endPoint.x, startWp.z - endPoint.z);
      if (d <= 9.0) {
        // Candidate direction check
        const nextWp = r.waypoints[1];
        const nextHeading = Math.atan2(nextWp.x - startWp.x, nextWp.z - startWp.z);
        const angleDiff = THREE.MathUtils.euclideanModulo(nextHeading - currentHeading + Math.PI, Math.PI * 2) - Math.PI;

        // STRICTLY FORWARD OR TURNING ONLY: angleDiff < 110 degrees (1.92 rad)
        // Strictly excludes 180-degree U-turns back onto the opposing lane!
        if (Math.abs(angleDiff) < 1.92) {
          candidates.push(r);
        }
      }
    }
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return null;
  }

  public setPaintColor(_hex: number): void {
    // Preserves authentic natural textured materials
  }

  public setTaillightsBraking(_isBraking: boolean): void {}

  public setLODVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}

