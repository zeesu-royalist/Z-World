import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { InputManager } from '../../core/InputManager';
import { EventBus } from '../../core/EventBus';

export type VehicleCategory = 'car' | 'bike' | 'helicopter' | 'plane' | 'boat';

export abstract class VehicleBase {
  public group: THREE.Group = new THREE.Group();
  public rigidBody!: RAPIER.RigidBody;
  public collider!: RAPIER.Collider;

  public category: VehicleCategory;
  public name: string;
  public speed: number = 0;          // km/h
  public maxSpeed: number = 180;      // km/h
  public acceleration: number = 25;  // m/s^2
  public steerAngle: number = 0;
  public maxSteerAngle: number = 0.55; // radians (~32 deg)

  public isOccupied: boolean = false;
  public driverSeatOffset: THREE.Vector3 = new THREE.Vector3(0, 0.6, 0);
  public exitOffset: THREE.Vector3 = new THREE.Vector3(-1.8, 0, 0);

  // Interaction distance for entering vehicle
  public interactionRadius: number = 3.5;

  constructor(
    public physicsWorld: PhysicsWorld,
    public initialPosition: THREE.Vector3,
    category: VehicleCategory,
    name: string
  ) {
    this.category = category;
    this.name = name;
  }

  public getPosition(): THREE.Vector3 {
    if (this.rigidBody) {
      const trans = this.rigidBody.translation();
      return new THREE.Vector3(trans.x, trans.y, trans.z);
    }
    return this.group.position;
  }

  public getExitWorldPosition(): THREE.Vector3 {
    const pos = this.getPosition();
    const exitWorld = this.exitOffset.clone().applyEuler(this.group.rotation);
    return pos.add(exitWorld);
  }

  public enter(): void {
    this.isOccupied = true;
    EventBus.getInstance().emit('PLAYER_ENTER_VEHICLE', { vehicle: this });
  }

  public exit(): void {
    this.isOccupied = false;
    EventBus.getInstance().emit('PLAYER_EXIT_VEHICLE', { vehicle: this });
  }

  public abstract update(delta: number, input: InputManager): void;
  public abstract buildModel(): void;
}
