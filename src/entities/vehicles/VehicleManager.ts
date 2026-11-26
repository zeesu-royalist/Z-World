import * as THREE from 'three';
import { VehicleBase } from './VehicleBase';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { InputManager } from '../../core/InputManager';
import { EventBus } from '../../core/EventBus';
import { AssetManager } from '../../core/AssetManager';

export class VehicleManager {
  public vehicles: VehicleBase[] = [];
  public currentVehicle: VehicleBase | null = null;
  public nearestVehicle: VehicleBase | null = null;
  private interactCooldown: boolean = false;

  constructor(
    private scene: THREE.Scene,
    private physicsWorld: PhysicsWorld
  ) {
    console.log('VehicleManager initialized. Ready for custom .GLB vehicle models.');
  }

  /**
   * Loads a real 3D .GLB vehicle model provided by the user.
   */
  public async loadCustomVehicle(
    glbPath: string,
    category: 'car' | 'bike' | 'helicopter' | 'plane' | 'boat',
    name: string,
    spawnPos: THREE.Vector3
  ): Promise<VehicleBase | null> {
    try {
      console.log(`Loading custom vehicle: ${glbPath}`);
      const gltf = await AssetManager.getInstance().loadGLTF(glbPath);
      const model = gltf.scene;

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Custom GLTF vehicle wrapper
      const vehicleWrapper = new (class extends VehicleBase {
        public buildModel(): void {
          this.group.add(model);
          this.group.position.copy(this.initialPosition);
        }
        public update(delta: number, input: InputManager): void {
          // Dynamic vehicle physics
          if (this.rigidBody) {
            const t = this.rigidBody.translation();
            const r = this.rigidBody.rotation();
            this.group.position.set(t.x, t.y, t.z);
            this.group.quaternion.set(r.x, r.y, r.z, r.w);
          }
        }
      })(this.physicsWorld, spawnPos, category, name);

      vehicleWrapper.buildModel();
      this.addVehicle(vehicleWrapper);

      console.log(`Custom vehicle "${name}" loaded from ${glbPath}`);
      return vehicleWrapper;
    } catch (err) {
      console.warn(`Could not load vehicle model at ${glbPath}:`, err);
      return null;
    }
  }

  public addVehicle(vehicle: VehicleBase): void {
    this.vehicles.push(vehicle);
    this.scene.add(vehicle.group);
  }

  public update(delta: number, input: InputManager, playerPos: THREE.Vector3): void {
    if (this.vehicles.length === 0) return;

    // Update active vehicles
    this.vehicles.forEach((v) => v.update(delta, input));

    // Handle vehicle enter / exit interaction (F or E key)
    if (this.currentVehicle) {
      if (input.state.interact && !this.interactCooldown) {
        this.exitVehicle();
        this.triggerCooldown();
      }
    } else {
      let nearest: VehicleBase | null = null;
      let minDistance = Infinity;

      for (const v of this.vehicles) {
        const dist = v.getPosition().distanceTo(playerPos);
        if (dist < v.interactionRadius && dist < minDistance) {
          nearest = v;
          minDistance = dist;
        }
      }

      this.nearestVehicle = nearest;

      if (nearest) {
        EventBus.getInstance().emit('NEAR_VEHICLE', {
          vehicleName: nearest.name,
          category: nearest.category,
        });

        if (input.state.interact && !this.interactCooldown) {
          this.enterVehicle(nearest);
          this.triggerCooldown();
        }
      } else {
        EventBus.getInstance().emit('NEAR_VEHICLE', null);
      }
    }
  }

  public enterVehicle(vehicle: VehicleBase): void {
    this.currentVehicle = vehicle;
    vehicle.enter();
  }

  public exitVehicle(): void {
    if (!this.currentVehicle) return;
    const v = this.currentVehicle;
    this.currentVehicle = null;
    v.exit();
  }

  private triggerCooldown(): void {
    this.interactCooldown = true;
    setTimeout(() => {
      this.interactCooldown = false;
    }, 600);
  }
}
