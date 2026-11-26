import * as THREE from 'three';
import { CharacterController } from './CharacterController';
import { CharacterModel } from './CharacterModel';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { InputManager } from '../../core/InputManager';
import { CityManager } from '../../world/CityManager';
import { EventBus } from '../../core/EventBus';
import { VehicleBase } from '../vehicles/VehicleBase';

export interface PlayerStats {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  cash: number;
  wantedLevel: number;
}

export class Player {
  public controller: CharacterController;
  public model: CharacterModel;

  public stats: PlayerStats = {
    health: 100,
    maxHealth: 100,
    armor: 100,
    maxArmor: 100,
    stamina: 100,
    cash: 250000,
    wantedLevel: 1,
  };

  public isInVehicle: boolean = false;
  public activeVehicle: VehicleBase | null = null;

  constructor(
    private scene: THREE.Scene,
    private physicsWorld: PhysicsWorld,
    spawnPoint: THREE.Vector3,
    private cityManager: CityManager
  ) {
    this.controller = new CharacterController(physicsWorld, spawnPoint);
    this.model = new CharacterModel();

    this.scene.add(this.model.group);

    // Listen to vehicle events
    EventBus.getInstance().on('PLAYER_ENTER_VEHICLE', ({ vehicle }) => {
      this.onEnterVehicle(vehicle);
    });

    EventBus.getInstance().on('PLAYER_EXIT_VEHICLE', ({ vehicle }) => {
      this.onExitVehicle(vehicle);
    });
  }

  public async init(heroModelPath: string = '/characters/character_modal.glb'): Promise<void> {
    // Load animated hero 3D model
    await this.model.loadCharacterModel(heroModelPath);
  }

  public update(delta: number, input: InputManager, cameraAngleY: number): void {
    if (this.isInVehicle && this.activeVehicle) {
      // Player is seated inside vehicle
      this.model.group.visible = false;
      this.controller.teleport(this.activeVehicle.getPosition());
      return;
    }

    this.model.group.visible = true;

    // Update character physics & controller with real road surface tracking
    this.controller.update(
      delta,
      input,
      cameraAngleY,
      this.cityManager
    );

    // Sync 3D model position & rotation with physics controller
    this.model.group.position.copy(this.controller.position);
    this.model.group.rotation.y = this.controller.rotation.y;

    // Update animations and locomotion
    this.model.update(
      delta,
      this.controller.currentSpeed,
      this.controller.isGrounded,
      this.controller.turnRate
    );
  }

  private onEnterVehicle(vehicle: VehicleBase): void {
    this.isInVehicle = true;
    this.activeVehicle = vehicle;
    this.model.group.visible = false;
  }

  private onExitVehicle(vehicle: VehicleBase): void {
    this.isInVehicle = false;
    this.activeVehicle = null;
    this.model.group.visible = true;

    // Position player safely outside driver door on road
    const exitPos = vehicle.getExitWorldPosition();
    this.controller.teleport(exitPos);
  }

  public takeDamage(amount: number): void {
    if (this.stats.armor > 0) {
      const absorbed = Math.min(this.stats.armor, amount);
      this.stats.armor -= absorbed;
      amount -= absorbed;
    }

    if (amount > 0) {
      this.stats.health = Math.max(0, this.stats.health - amount);
    }

    EventBus.getInstance().emit('HEALTH_CHANGE', {
      health: this.stats.health,
      armor: this.stats.armor,
    });
  }
}
