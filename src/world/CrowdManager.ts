import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AssetManager } from '../core/AssetManager';
import { CityManager } from './CityManager';
import {
  CharacterDef,
  CHARACTER_DEFS,
  SidewalkRail,
  SIDEWALK_RAILS,
  StationarySpot,
  STATIONARY_SPOTS
} from './SidewalkNetwork';

/**
 * Represents an individual active pedestrian anywhere in the city.
 * Follows pre-mapped sidewalk rails or remains at assigned sidewalk spots.
 */
class ActivePedestrian {
  public group: THREE.Group;
  public mixer: THREE.AnimationMixer;
  public action: THREE.AnimationAction;
  public charDef: CharacterDef;
  public isWalking: boolean;
  public walkSpeed: number;

  // Rail navigation state (for walkers)
  public rail: SidewalkRail | null = null;
  public currentWaypointIndex: number = 0;
  public targetWaypointIndex: number = 1;
  public segmentProgress: number = 0; // 0.0 to 1.0 along current segment
  public isForward: boolean = true;
  public lateralOffset: number = 0; // Perpendicular offset to prevent collisions

  // Dynamic heading & animation LOD counter
  public currentHeading: number = 0;
  private animFrameCounter: number = 0;

  constructor(
    group: THREE.Group,
    mixer: THREE.AnimationMixer,
    action: THREE.AnimationAction,
    charDef: CharacterDef,
    isWalking: boolean,
    walkSpeed: number
  ) {
    this.group = group;
    this.mixer = mixer;
    this.action = action;
    this.charDef = charDef;
    this.isWalking = isWalking;
    this.walkSpeed = walkSpeed;
    this.animFrameCounter = Math.floor(Math.random() * 4);
  }

  /**
   * 2-tier LOD update:
   * - Near (<= 50m): 60 FPS full bone animation
   * - Mid (50m to 140m): Visible down long streets! Throttled animation to preserve 60 FPS
   * - Far (> 140m): Hidden from render pipeline, but progress along rail keeps updating
   */
  public update(delta: number, distSq: number, closeRadiusSq: number, visibleRadiusSq: number): void {
    // 1. Always step along sidewalk rail so the entire city is alive
    if (this.isWalking && this.rail && this.walkSpeed > 0) {
      this.stepAlongRail(delta);
    }

    // 2. Render & Skeletal Animation LOD
    if (distSq <= closeRadiusSq) {
      // Tier 1: Close range - Full 60 FPS skeletal animation
      this.group.visible = true;
      this.mixer.update(delta);
    } else if (distSq <= visibleRadiusSq) {
      // Tier 2: Mid range (up to 140m) - Visible down avenues!
      this.group.visible = true;
      this.animFrameCounter = (this.animFrameCounter + 1) % 2;
      if (this.animFrameCounter === 0) {
        this.mixer.update(delta * 2);
      }
    } else {
      // Tier 3: Distant - Culled from render pipeline
      this.group.visible = false;
    }
  }

  private stepAlongRail(delta: number): void {
    if (!this.rail || this.rail.waypoints.length < 2) return;

    const wps = this.rail.waypoints;
    const pA = wps[this.currentWaypointIndex];
    const pB = wps[this.targetWaypointIndex];

    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const dz = pB.z - pA.z;
    const segDist = Math.hypot(dx, dz);

    if (segDist < 0.05) {
      this.advanceWaypoint();
      return;
    }

    this.segmentProgress += (this.walkSpeed * delta) / segDist;

    if (this.segmentProgress >= 1.0) {
      this.segmentProgress = 0.0;
      this.advanceWaypoint();
    } else {
      const t = this.segmentProgress;
      // Interpolate along the waypoint segment (strictly on the sidewalk)
      const baseX = pA.x + dx * t;
      const baseY = pA.y + dy * t;
      const baseZ = pA.z + dz * t;

      // Heading points along travel direction
      const heading = Math.atan2(dx, dz);
      this.currentHeading = heading;
      this.group.rotation.y = heading;

      // Lateral sidewalk lane offset perpendicular to travel heading
      const perpX = Math.cos(heading) * this.lateralOffset;
      const perpZ = -Math.sin(heading) * this.lateralOffset;

      this.group.position.set(baseX + perpX, baseY, baseZ + perpZ);
    }
  }

  private advanceWaypoint(): void {
    if (!this.rail) return;
    const n = this.rail.waypoints.length;
    this.currentWaypointIndex = this.targetWaypointIndex;

    if (this.isForward) {
      if (this.currentWaypointIndex >= n - 1) {
        // Reached end of sidewalk rail: reverse direction smoothly
        this.isForward = false;
        this.targetWaypointIndex = this.currentWaypointIndex - 1;
      } else {
        this.targetWaypointIndex = this.currentWaypointIndex + 1;
      }
    } else {
      if (this.currentWaypointIndex <= 0) {
        // Reached start of sidewalk rail: reverse direction smoothly
        this.isForward = true;
        this.targetWaypointIndex = 1;
      } else {
        this.targetWaypointIndex = this.currentWaypointIndex - 1;
      }
    }
  }
}

export class CrowdManager {
  private masterScene: THREE.Group | null = null;
  private masterClip: THREE.AnimationClip | null = null;
  private pedestrians: ActivePedestrian[] = [];

  // Exact scale factor matching the hero's 0.95m height
  private readonly PEDESTRIAN_SCALE = 0.26;

  // 2-tier LOD distances:
  // - Close range: up to 50 meters (full skeletal animation)
  // - Visual range: up to 140 meters (visible down long city avenues like GTA)
  private readonly CLOSE_RADIUS_SQ = 50.0 * 50.0;
  private readonly VISIBLE_RADIUS_SQ = 140.0 * 140.0;

  constructor(
    private scene: THREE.Scene,
    private cityManager: CityManager
  ) {}

  public async init(modelPath: string = '/characters/just_people.glb'): Promise<void> {
    console.log(`[CrowdManager] Loading master crowd asset: ${modelPath}`);
    const assetManager = AssetManager.getInstance();
    const gltf = await assetManager.loadGLTF(modelPath);

    this.masterScene = gltf.scene;

    if (gltf.animations && gltf.animations.length > 0) {
      this.masterClip = gltf.animations[0];

      // ROOT MOTION FIX:
      // Strip baked X and Z translation from all COM1 bones to prevent characters
      // from drifting off the sidewalk into vehicular road lanes.
      // Vertical hip bobbing (Y) is preserved for natural walking mechanics.
      this.masterClip.tracks.forEach((track) => {
        if (track.name.includes('COM1') && track.name.endsWith('.position')) {
          const initX = track.values[0];
          const initZ = track.values[2];
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = initX;
            track.values[i + 2] = initZ;
          }
        }
      });

      console.log(
        `[CrowdManager] Master animation "${this.masterClip.name}" sanitized: Locked X/Z root motion.`
      );
    }

    // Populate the entire city upfront with dense persistent crowd
    this.populateCityCrowd();
  }

  /**
   * Spawns persistent pedestrians across the entire city:
   * 1. Stationary units (couples and individuals chatting, waiting, looking around at all plazas)
   * 2. Walking units distributed along all 30 sidewalk rails spanning all city districts
   */
  private populateCityCrowd(): void {
    if (!this.masterScene || !this.masterClip) return;

    // 1. Spawn Stationary Pedestrians (Plazas, corners, storefronts across North, South, East, West)
    STATIONARY_SPOTS.forEach((spot) => {
      const charDef = CHARACTER_DEFS[spot.charId % CHARACTER_DEFS.length];
      const ped = this.instantiatePedestrian(charDef, false, 0);

      const groundY = this.cityManager.getSidewalkHeight(spot.x, spot.z, spot.y) ?? spot.y;
      ped.group.position.set(spot.x, groundY, spot.z);
      ped.group.rotation.y = spot.heading;
      this.pedestrians.push(ped);
    });

    // 2. Distribute Walking Pedestrians across ALL Sidewalk Rails in the city
    const walkingCharDefs = CHARACTER_DEFS.filter((d) => d.defaultIsWalking && d.walkSpeed > 0);
    let charCycle = 0;

    SIDEWALK_RAILS.forEach((rail) => {
      const wpCount = rail.waypoints.length;
      if (wpCount < 2) return;

      // Dynamically scale quota with rail length:
      // Long avenues get 6 to 8 walkers, medium streets get 4 to 5, short streets get 3
      const quota = Math.max(3, Math.min(8, Math.round(wpCount * 0.25)));

      for (let i = 0; i < quota; i++) {
        const charDef = walkingCharDefs[charCycle % walkingCharDefs.length];
        charCycle++;

        // Randomize speed slightly around character's natural pace
        const speed = charDef.walkSpeed * (0.85 + (i % 4) * 0.08);

        const ped = this.instantiatePedestrian(charDef, true, speed);
        ped.rail = rail;

        // Distribute initial waypoint index evenly along the rail
        const startIndex = Math.min(
          Math.floor((i / quota) * (wpCount - 1)),
          wpCount - 2
        );
        ped.currentWaypointIndex = startIndex;
        ped.isForward = i % 2 === 0;
        ped.targetWaypointIndex = ped.isForward
          ? Math.min(startIndex + 1, wpCount - 1)
          : Math.max(startIndex - 1, 0);

        ped.segmentProgress = ((i * 0.31) % 0.8) + 0.1;

        // Subtle lateral sidewalk lane offset (±0.08m) so pedestrians pass without stepping off curbs
        ped.lateralOffset = ped.isForward ? 0.08 : -0.08;

        // Position at starting segment
        const pA = rail.waypoints[ped.currentWaypointIndex];
        const pB = rail.waypoints[ped.targetWaypointIndex];
        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const dz = pB.z - pA.z;
        const heading = Math.atan2(dx, dz);
        ped.group.rotation.y = heading;

        const t = ped.segmentProgress;
        const baseX = pA.x + dx * t;
        const baseY = pA.y + dy * t;
        const baseZ = pA.z + dz * t;

        const perpX = Math.cos(heading) * ped.lateralOffset;
        const perpZ = -Math.sin(heading) * ped.lateralOffset;
        const groundY = this.cityManager.getSidewalkHeight(baseX + perpX, baseZ + perpZ, baseY) ?? baseY;
        ped.group.position.set(baseX + perpX, groundY, baseZ + perpZ);

        this.pedestrians.push(ped);
      }
    });

    console.log(
      `[CrowdManager] City-wide crowd active: ${this.pedestrians.length} pedestrians populated along ${SIDEWALK_RAILS.length} sidewalk rails across the entire city.`
    );
  }

  /**
   * Clones a character unit with exact local centering, model yaw offset, and shadow setups.
   */
  private instantiatePedestrian(
    charDef: CharacterDef,
    isWalking: boolean,
    walkSpeed: number
  ): ActivePedestrian {
    // 1. Clone skeleton and meshes cleanly
    const clonedScene = clone(this.masterScene!) as THREE.Group;

    // 2. Filter meshes: make ONLY this character's meshes visible
    const activeSet = new Set(charDef.activeMeshNames);
    clonedScene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const sm = child as THREE.SkinnedMesh;
        const isTargetMesh = activeSet.has(sm.name);
        sm.visible = isTargetMesh;

        if (isTargetMesh) {
          sm.castShadow = true;
          sm.receiveShadow = true;
          sm.frustumCulled = true;

          const mats = Array.isArray(sm.material) ? sm.material : [sm.material];
          mats.forEach((mat) => {
            if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const std = mat as THREE.MeshStandardMaterial;
              std.roughness = THREE.MathUtils.clamp(std.roughness, 0.45, 0.85);
              std.metalness = THREE.MathUtils.clamp(std.metalness, 0.05, 0.2);
              if (std.map) {
                std.map.colorSpace = THREE.SRGBColorSpace;
                std.map.anisotropy = 2;
              }
            }
          });
        }
      }
    });

    // 3. Anchor & center wrapper:
    // - clonedScene is translated by -localCenter so character feet sit right at (0, 0, 0)
    // - wrapper applies modelYawOffset so the character's facing direction aligns with outerGroup's forward (+Z)
    // - outerGroup controls world position and travel heading
    const outerGroup = new THREE.Group();
    outerGroup.name = `Pedestrian_${charDef.name}`;

    const wrapper = new THREE.Group();
    wrapper.name = `ModelWrapper`;
    clonedScene.position.set(-charDef.localCenterX, 0, -charDef.localCenterZ);

    // CRITICAL: modelYawOffset eliminates sideways crab-walking completely!
    wrapper.rotation.y = charDef.modelYawOffset;
    wrapper.scale.set(this.PEDESTRIAN_SCALE, this.PEDESTRIAN_SCALE, this.PEDESTRIAN_SCALE);

    wrapper.add(clonedScene);
    outerGroup.add(wrapper);

    // 4. Setup AnimationMixer
    const mixer = new THREE.AnimationMixer(clonedScene);
    const action = mixer.clipAction(this.masterClip!);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    // Desynchronize walk phase so pedestrians do not step in lockstep
    const clipDuration = this.masterClip!.duration;
    mixer.setTime(Math.random() * clipDuration);

    this.scene.add(outerGroup);

    return new ActivePedestrian(
      outerGroup,
      mixer,
      action,
      charDef,
      isWalking,
      walkSpeed
    );
  }

  /**
   * Frame tick:
   * - Updates all pedestrians' rail navigation progress across the city
   * - 2-tier LOD: full animation within 50m, visible down street up to 140m, culled beyond 140m
   */
  public update(
    delta: number,
    playerPosition: THREE.Vector3,
    _playerHeading?: number,
    _isMoving?: boolean
  ): void {
    if (this.pedestrians.length === 0) return;

    const count = this.pedestrians.length;
    const closeSq = this.CLOSE_RADIUS_SQ;
    const visSq = this.VISIBLE_RADIUS_SQ;

    for (let i = 0; i < count; i++) {
      const ped = this.pedestrians[i];
      const distSq = ped.group.position.distanceToSquared(playerPosition);
      ped.update(delta, distSq, closeSq, visSq);
    }
  }

  public dispose(): void {
    this.pedestrians.forEach((ped) => {
      ped.mixer.stopAllAction();
      this.scene.remove(ped.group);
    });
    this.pedestrians = [];
    this.masterScene = null;
    this.masterClip = null;
  }
}
