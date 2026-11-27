import * as THREE from 'three';
import { AssetManager } from '../core/AssetManager';
import { CityManager } from './CityManager';
import { VehicleManager } from '../entities/vehicles/VehicleManager';
import { DrivableCar } from '../entities/vehicles/DrivableCar';
import { CAR_DEFS, CarDef, ROAD_RAILS } from './RoadNetwork';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class TrafficManager {
  private scene: THREE.Scene;
  private cityManager: CityManager;
  private physicsWorld: PhysicsWorld;
  private vehicleManager!: VehicleManager;

  public activeCars: DrivableCar[] = [];
  private carTemplates: Map<string, THREE.Object3D> = new Map();

  constructor(scene: THREE.Scene, cityManager: CityManager, physicsWorld: PhysicsWorld) {
    this.scene = scene;
    this.cityManager = cityManager;
    this.physicsWorld = physicsWorld;
  }

  /**
   * Initializes authentic vehicles from /cars/low-poly_cars.glb using their original built-in wheels and natural textures
   */
  public async init(
    carGlbPathOrVehicleManager?: string | VehicleManager,
    maybeVehicleManager?: VehicleManager
  ): Promise<void> {
    if (typeof carGlbPathOrVehicleManager === 'string' && maybeVehicleManager) {
      this.vehicleManager = maybeVehicleManager;
    } else if (carGlbPathOrVehicleManager && typeof carGlbPathOrVehicleManager !== 'string') {
      this.vehicleManager = carGlbPathOrVehicleManager;
    }

    console.log(`[TrafficManager] Streaming authentic vehicles from /cars/low-poly_cars.glb...`);
    const gltf = await AssetManager.getInstance().loadGLTF('/cars/low-poly_cars.glb');
    const root = gltf.scene;

    // Specifications for the 4 vehicle models (calibrated to proportionate scale)
    const vehicleConfigs = [
      {
        id: 'car1',
        name: 'Albany Premier (Sedan)',
        meshName: 'car1_Material01_0',
        scale: 0.44,
      },
      {
        id: 'car2',
        name: 'Dundreary Landstalker (SUV)',
        meshName: 'car2_Material01_0',
        scale: 0.44,
      },
      {
        id: 'car3',
        name: 'Bravado Banshee (Sports Car)',
        meshName: 'car3_Material01_0',
        scale: 0.44,
      },
      {
        id: 'car4',
        name: 'Declasse Vigero (Muscle Coupe)',
        meshName: 'car4_Material01_0',
        scale: 0.44,
      },
    ];

    for (const cfg of vehicleConfigs) {
      let sourceMesh: THREE.Mesh | null = null;
      root.traverse((c) => {
        if ((c as THREE.Mesh).isMesh && c.name === cfg.meshName) {
          sourceMesh = c as THREE.Mesh;
        }
      });

      if (!sourceMesh) {
        console.warn(`[TrafficManager] Could not find source mesh ${cfg.meshName}`);
        continue;
      }

      // Clone geometry and calibrate body positioning
      const bodyGeo = (sourceMesh as THREE.Mesh).geometry.clone();
      bodyGeo.computeBoundingBox();

      if (bodyGeo.boundingBox) {
        const center = new THREE.Vector3();
        bodyGeo.boundingBox.getCenter(center);
        const minY = bodyGeo.boundingBox.min.y;

        // Center X and Z; align bottom of the car's own built-in wheels flush on the road surface (Y = 0)
        bodyGeo.translate(-center.x, -minY, -center.z);

        // Rotate 180 degrees around Y so front bumper points in standard forward (+Z) direction
        bodyGeo.rotateY(Math.PI);

        // Scale to 0.95m human proportion
        bodyGeo.scale(cfg.scale, cfg.scale, cfg.scale);
        bodyGeo.computeVertexNormals();
        bodyGeo.computeBoundingBox();
      }

      // Retain 100% authentic natural material and texture from original model (with its original wheels and rims)
      const originalMat = (sourceMesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const naturalMat = originalMat.clone();
      naturalMat.roughness = 0.35;
      naturalMat.metalness = 0.15;
      naturalMat.needsUpdate = true;

      // Authentic car mesh with its own original modeled wheels (no procedural wheels added)
      const bodyMesh = new THREE.Mesh(bodyGeo, naturalMat);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;

      this.carTemplates.set(cfg.id, bodyMesh);
      console.log(`[TrafficManager] Successfully loaded authentic vehicle: ${cfg.name} with original wheels & natural textures`);
    }

    // 2. Stream and register authentic classic vehicles from /cars/lada_zhiguli_riva.glb
    console.log(`[TrafficManager] Streaming classic vehicles from /cars/lada_zhiguli_riva.glb...`);
    try {
      const ladaGltf = await AssetManager.getInstance().loadGLTF('/cars/lada_zhiguli_riva.glb');
      const ladaRoot = ladaGltf.scene;
      ladaRoot.updateMatrixWorld(true);

      let ladaRootNode: THREE.Object3D | null = null;
      ladaRoot.traverse((obj) => {
        if (obj.name === 'RootNode') ladaRootNode = obj;
      });

      const ladaConfigs = [
        { id: 'lada_2105', key: '05', name: 'Lada 2105 Riva' },
        { id: 'lada_2104', key: '04', name: 'Lada 2104 Estate' },
        { id: 'lada_2107', key: '07', name: 'Lada 2107 Deluxe' },
        { id: 'lada_2103', key: '03', name: 'Lada 2103 Zhiguli' },
        { id: 'lada_2106', key: '06', name: 'Lada 2106 Zhiguli' },
      ];

      if (ladaRootNode) {
        for (const lcfg of ladaConfigs) {
          const carPivot = new THREE.Group();
          (ladaRootNode as THREE.Object3D).children.forEach((child) => {
            if (child.name.includes(lcfg.key)) {
              carPivot.add(child.clone(true));
            }
          });

          if (carPivot.children.length === 0) continue;

          // Compute initial bounding box for this car model
          const box = new THREE.Box3().setFromObject(carPivot);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const minY = box.min.y;

          // Center all child parts at (0, 0) and align lowest point (wheels) flush on road (Y = 0)
          carPivot.children.forEach((c) => {
            c.position.x -= center.x;
            c.position.y -= minY;
            c.position.z -= center.z;
          });

          // Enable shadows and natural PBR rendering on all original meshes
          carPivot.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              c.castShadow = true;
              c.receiveShadow = true;
              const mesh = c as THREE.Mesh;
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach((m) => {
                    (m as THREE.MeshStandardMaterial).roughness = 0.35;
                  });
                } else {
                  (mesh.material as THREE.MeshStandardMaterial).roughness = 0.35;
                }
              }
            }
          });

          // Rotate 180 degrees so front (+Z forward) matches driving direction
          carPivot.rotation.y = Math.PI;

          // Scale to human proportion (0.95m hero)
          const scale = 0.0044;
          carPivot.scale.set(scale, scale, scale);

          const ladaContainer = new THREE.Group();
          ladaContainer.add(carPivot);

          this.carTemplates.set(lcfg.id, ladaContainer);
          console.log(`[TrafficManager] Successfully loaded authentic vehicle: ${lcfg.name} with original wheels & natural textures`);
        }
      }
    } catch (err) {
      console.warn(`[TrafficManager] Could not load lada_zhiguli_riva.glb:`, err);
    }

    // 3. Stream and register authentic city traffic vehicles from /cars/asphalt_8_generic_traffic_cars.glb
    console.log(`[TrafficManager] Streaming authentic city traffic from /cars/asphalt_8_generic_traffic_cars.glb...`);
    try {
      const asphaltGltf = await AssetManager.getInstance().loadGLTF('/cars/asphalt_8_generic_traffic_cars.glb');
      const asphaltRoot = asphaltGltf.scene;
      asphaltRoot.updateMatrixWorld(true);

      let asphaltRootNode: THREE.Object3D | null = null;
      asphaltRoot.traverse((obj) => {
        if (obj.name === 'RootNode') asphaltRootNode = obj;
      });

      const asphaltConfigs = [
        { id: 'asphalt_taxi', nodeName: 'traffic_generictaxi_nonwreck', name: 'Metro Taxi' },
        { id: 'asphalt_police', nodeName: 'traffic_police_nonwreck', name: 'VCPD Police Cruiser' },
        { id: 'asphalt_suv', nodeName: 'traffic_suv_nonwreck', name: 'City SUV' },
        { id: 'asphalt_sedan', nodeName: 'traffic_car1_nonwreck', name: 'Dodge City Sedan' },
        { id: 'asphalt_pickup', nodeName: 'traffic_pickup_nonwreck', name: 'Workforce Pickup' },
        { id: 'asphalt_economy', nodeName: 'traffic_economy_nonwreck', name: 'Compact Hatchback' },
        { id: 'asphalt_limo', nodeName: 'traffic_limo_nonwreck', name: 'Executive Stretch Limo' },
        { id: 'asphalt_truck', nodeName: 'traffic_truck_nonwreck', name: 'Box Delivery Truck' },
        { id: 'asphalt_bus', nodeName: 'traffic_bus_nonwreck', name: 'City Transit Bus' },
      ];

      if (asphaltRootNode) {
        for (const acfg of asphaltConfigs) {
          const source = (asphaltRootNode as THREE.Object3D).children.find((c) => c.name === acfg.nodeName);
          if (!source) continue;

          // Clone source directly so its -90 degree X-rotation from FBX is fully preserved
          const clonedSource = source.clone(true);

          // Exclude artificial floating billboard light glows so cars look 100% natural and clean
          const toRemove: THREE.Object3D[] = [];
          clonedSource.traverse((c) => {
            if (c.name.includes('glow') || c.name.includes('lights_')) {
              toRemove.push(c);
            }
          });
          toRemove.forEach((c) => {
            if (c.parent) c.parent.remove(c);
          });

          // Reset local position so we can compute bounding box from origin
          clonedSource.position.set(0, 0, 0);

          // Compute initial bounding box for this vehicle
          const box = new THREE.Box3().setFromObject(clonedSource);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const minY = box.min.y;

          // Center all child parts at (0, 0) and align lowest point (wheels) flush on road (Y = 0)
          clonedSource.position.x = -center.x;
          clonedSource.position.y = -minY;
          clonedSource.position.z = -center.z;

          // Enable shadows and natural PBR rendering on all original meshes
          clonedSource.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              c.castShadow = true;
              c.receiveShadow = true;
              const mesh = c as THREE.Mesh;
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach((m) => {
                    (m as THREE.MeshStandardMaterial).roughness = 0.35;
                  });
                } else {
                  (mesh.material as THREE.MeshStandardMaterial).roughness = 0.35;
                }
              }
            }
          });

          const carPivot = new THREE.Group();
          carPivot.add(clonedSource);

          // Scale to human proportion (0.95m hero) - 0.0036 scales sedans to 1.67m
          const scale = 0.0036;
          carPivot.scale.set(scale, scale, scale);

          const asphaltContainer = new THREE.Group();
          asphaltContainer.add(carPivot);

          this.carTemplates.set(acfg.id, asphaltContainer);
          console.log(`[TrafficManager] Successfully loaded authentic vehicle: ${acfg.name} with original wheels & natural textures`);
        }
      }
    } catch (err) {
      console.warn(`[TrafficManager] Could not load asphalt_8_generic_traffic_cars.glb:`, err);
    }

    // Spawn ambient city traffic
    this.spawnCityTraffic();

    // Spawn downtown curbside showcase car (Bravado Banshee Sports Car)
    this.spawnDowntownShowcaseCar();

    console.log(`[TrafficManager] Successfully deployed ${this.activeCars.length} realistic vehicles across the city!`);
  }

  /**
   * Spawns moving cars strictly on verified road surface waypoints
   */
  private spawnCityTraffic(): void {
    if (ROAD_RAILS.length === 0 || this.carTemplates.size === 0) return;

    // 84 realistic cars deployed across downtown and surrounding sectors
    const targetCarCount = 84;
    const heroSpawnX = 2.5;
    const heroSpawnZ = 4.5;

    // Prioritize rails near hero spawn so downtown is immediately bustling with traffic
    const sortedRails = [...ROAD_RAILS].sort((a, b) => {
      const distA = Math.hypot(a.waypoints[0].x - heroSpawnX, a.waypoints[0].z - heroSpawnZ);
      const distB = Math.hypot(b.waypoints[0].x - heroSpawnX, b.waypoints[0].z - heroSpawnZ);
      return distA - distB;
    });

    const nearRails = sortedRails.filter((r) => {
      return r.waypoints.some((wp) => Math.hypot(wp.x - heroSpawnX, wp.z - heroSpawnZ) < 120);
    });
    const outerRails = sortedRails.filter((r) => !nearRails.includes(r));

    // Shuffle inner and outer rails separately
    for (let i = nearRails.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nearRails[i], nearRails[j]] = [nearRails[j], nearRails[i]];
    }
    for (let i = outerRails.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [outerRails[i], outerRails[j]] = [outerRails[j], outerRails[i]];
    }

    const railsToUse = [...nearRails, ...outerRails, ...nearRails];

    let carsSpawned = 0;
    let railIdx = 0;

    while (carsSpawned < targetCarCount && railIdx < railsToUse.length) {
      const rail = railsToUse[railIdx];
      railIdx++;

      if (rail.waypoints.length < 2) continue;

      // Select distinct car model variant across Sedan, SUV, Sports Car, Muscle Coupe
      const carDef = CAR_DEFS[carsSpawned % CAR_DEFS.length];
      const template = this.carTemplates.get(carDef.id);
      if (!template) continue;

      // Pick starting waypoint along rail safely
      const maxStart = Math.max(0, rail.waypoints.length - 2);
      const startWpIdx = Math.floor(Math.random() * (maxStart + 1));
      const pA = rail.waypoints[startWpIdx];
      const pB = rail.waypoints[startWpIdx + 1] || rail.waypoints[0];

      const spawnPos = new THREE.Vector3(pA.x, pA.y, pA.z);
      const heading = Math.atan2(pB.x - pA.x, pB.z - pA.z);

      const car = new DrivableCar(
        this.physicsWorld,
        this.cityManager,
        spawnPos,
        carDef,
        template.clone()
      );

      const slopeAngle = Math.atan2(pB.y - pA.y, Math.max(0.1, Math.hypot(pB.x - pA.x, pB.z - pA.z)));
      car.rail = rail;
      car.currentWaypointIndex = startWpIdx;
      car.targetWaypointIndex = startWpIdx + 1;
      car.currentHeading = heading;
      car.currentPitch = -slopeAngle;
      car.group.rotation.order = 'YXZ';
      car.group.rotation.y = heading;
      car.group.rotation.x = -slopeAngle;

      // Realistic GTA city cruising speed: 9.0 to 13.0 m/s (~32 to 47 km/h)
      car.cruiseSpeed = 9.0 + Math.random() * 4.0;
      car.currentSpeedMs = car.cruiseSpeed * 0.9;

      this.vehicleManager.addVehicle(car);
      this.activeCars.push(car);
      carsSpawned++;
    }
  }

  /**
   * Spawns a sports car (Bravado Banshee) parked on the roadside right in front of hero spawn
   */
  private spawnDowntownShowcaseCar(): void {
    const sportsCarDef = CAR_DEFS.find((c) => c.id === 'car3') || CAR_DEFS[0];
    const template = this.carTemplates.get(sportsCarDef.id);
    if (!template) return;

    // Curbside parking lane on Downtown Main Avenue (X: 4.38, Y: 6.645, Z: -7.0)
    const showcasePos = new THREE.Vector3(4.38, 6.645, -7.0);

    const showcaseCar = new DrivableCar(
      this.physicsWorld,
      this.cityManager,
      showcasePos,
      sportsCarDef,
      template.clone()
    );

    // Parked facing forward down the avenue (Northbound, heading Math.PI) with slope pitch
    showcaseCar.currentHeading = Math.PI;
    showcaseCar.currentPitch = -0.045; // Avenue upward grade towards north
    showcaseCar.group.rotation.order = 'YXZ';
    showcaseCar.group.rotation.y = Math.PI;
    showcaseCar.group.rotation.x = -0.045;
    showcaseCar.cruiseSpeed = 0;
    showcaseCar.currentSpeedMs = 0;

    this.vehicleManager.addVehicle(showcaseCar);
    this.activeCars.push(showcaseCar);

    console.log(`[TrafficManager] Downtown showcase car (${sportsCarDef.name}) spawned at curbside:`, showcasePos);
  }

  /**
   * Updates all cars with distance LOD and anti-collision intelligence
   */
  public update(delta: number, playerPos: THREE.Vector3): void {
    if (this.activeCars.length === 0) return;

    // 1. Group cars by rail to compute distance to leading car ahead
    const carsByRail = new Map<string, DrivableCar[]>();
    for (const car of this.activeCars) {
      if (car.rail) {
        let list = carsByRail.get(car.rail.id);
        if (!list) {
          list = [];
          carsByRail.set(car.rail.id, list);
        }
        list.push(car);
      }
    }

    // 2. Update each car with distant recycling and zero-U-turn lifecycle
    for (const car of this.activeCars) {
      if (car.isOccupied) {
        car.setLODVisible(true);
        continue;
      }

      const distSq = car.group.position.distanceToSquared(playerPos);

      // Despawn and recycle car to a distant street if it reached its destination or drove far away
      if (car.isCompletedJourney || distSq > 155 * 155) {
        this.recycleCarToDistantTrack(car, playerPos);
        continue;
      }

      car.setLODVisible(true);

      // Find car ahead on same rail (cars only drive forward in one-way flow!)
      let carAheadDist: number | null = null;
      if (car.rail) {
        const laneCars = carsByRail.get(car.rail.id);
        if (laneCars && laneCars.length > 1) {
          let minDist = Infinity;
          for (const other of laneCars) {
            if (other === car) continue;
            const wpDiff = other.targetWaypointIndex - car.targetWaypointIndex;
            if (wpDiff >= 0 && wpDiff <= 4) {
              const d = car.group.position.distanceTo(other.group.position);
              if (d < minDist) minDist = d;
            }
          }
          if (minDist < Infinity) carAheadDist = minDist;
        }
      }

      // Step AI forward along route
      car.updateAI(delta, playerPos, distSq, carAheadDist);
    }
  }

  /**
   * Recycles a car that has reached its destination or traveled into the far distance.
   * Respawns the car on a distant road heading across town, ensuring an endless, natural traffic flow with NO U-turns!
   */
  public recycleCarToDistantTrack(car: DrivableCar, playerPos: THREE.Vector3): void {
    if (ROAD_RAILS.length === 0) return;

    // Pick candidate rails that start between 70m and 145m from player (in the distance)
    const distantCandidates = ROAD_RAILS.filter((r) => {
      if (r.waypoints.length < 3) return false;
      const startWp = r.waypoints[0];
      const d = Math.hypot(startWp.x - playerPos.x, startWp.z - playerPos.z);
      return d >= 70 && d <= 145;
    });

    const chosenRail = distantCandidates.length > 0
      ? distantCandidates[Math.floor(Math.random() * distantCandidates.length)]
      : ROAD_RAILS[Math.floor(Math.random() * ROAD_RAILS.length)];

    const p0 = chosenRail.waypoints[0];
    const p1 = chosenRail.waypoints[1];
    const heading = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    const slopeAngle = Math.atan2(p1.y - p0.y, Math.max(0.1, Math.hypot(p1.x - p0.x, p1.z - p0.z)));

    car.rail = chosenRail;
    car.currentWaypointIndex = 0;
    car.targetWaypointIndex = 1;
    car.segmentProgress = 0;
    car.isCompletedJourney = false;
    car.isTransitioningRail = false;

    car.group.position.set(p0.x, p0.y + 0.015, p0.z);
    car.currentHeading = heading;
    car.currentPitch = -slopeAngle;
    car.group.rotation.order = 'YXZ';
    car.group.rotation.y = heading;
    car.group.rotation.x = -slopeAngle;

    car.cruiseSpeed = 9.0 + Math.random() * 4.0;
    car.currentSpeedMs = car.cruiseSpeed * 0.85;
  }
}
