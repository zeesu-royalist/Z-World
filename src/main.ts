import * as THREE from 'three';
import { Engine } from './core/Engine';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { CityManager } from './world/CityManager';
import { Environment } from './world/Environment';
import { Player } from './entities/character/Player';
import { ThirdPersonCamera } from './entities/camera/ThirdPersonCamera';
import { VehicleCamera } from './entities/vehicles/VehicleCamera';
import { VehicleManager } from './entities/vehicles/VehicleManager';
import { LoadingScreen } from './ui/LoadingScreen';
import { HUD } from './ui/HUD';
import { Minimap } from './ui/Minimap';
import { ControlsOverlay } from './ui/ControlsOverlay';
import { CrowdManager } from './world/CrowdManager';

class ZWorldGame {
  private engine: Engine;
  private gameLoop: GameLoop;
  private input: InputManager;
  private physicsWorld: PhysicsWorld;
  private cityManager: CityManager;
  private environment!: Environment;
  private player!: Player;
  private thirdPersonCamera!: ThirdPersonCamera;
  private vehicleCamera!: VehicleCamera;
  private vehicleManager!: VehicleManager;
  private crowdManager!: CrowdManager;

  private loadingScreen: LoadingScreen;
  private hud!: HUD;
  private minimap!: Minimap;
  private controlsOverlay!: ControlsOverlay;

  constructor() {
    this.loadingScreen = new LoadingScreen();
    this.engine = new Engine({ shadows: true });
    this.gameLoop = new GameLoop(true); // stats enabled
    this.input = InputManager.getInstance(this.engine.renderer.domElement);
    this.physicsWorld = PhysicsWorld.getInstance();
    this.cityManager = new CityManager(this.engine.scene, this.physicsWorld);
  }

  public async start(): Promise<void> {
    try {
      this.loadingScreen.setProgress(10, 'INITIALIZING RAPIER 3D PHYSICS...');
      await this.physicsWorld.init();

      this.loadingScreen.setProgress(20, 'SETTING UP ATMOSPHERIC ENVIRONMENT...');
      this.environment = new Environment(this.engine.scene);

      this.loadingScreen.setProgress(30, 'DOWNLOADING & STREAMING 3D CITY (65MB)...');
      const cityStats = await this.cityManager.loadCity(
        '/city/city_3d_model.glb',
        (pct) => {
          const mapped = 30 + Math.round((pct / 100) * 50);
          this.loadingScreen.setProgress(mapped, `LOADING CITY ASSETS: ${pct}%`);
        }
      );

      this.loadingScreen.setProgress(82, 'LOADING HERO MODEL (character_modal.glb)...');
      const spawnPoint = cityStats.spawnPoint;
      this.player = new Player(
        this.engine.scene,
        this.physicsWorld,
        spawnPoint,
        this.cityManager
      );
      await this.player.init('/characters/character_modal.glb');

      this.thirdPersonCamera = new ThirdPersonCamera(this.engine.camera);
      this.vehicleCamera = new VehicleCamera(this.engine.camera);

      this.loadingScreen.setProgress(88, 'STREAMING DYNAMIC CITY CROWD (just_people.glb)...');
      this.crowdManager = new CrowdManager(this.engine.scene, this.cityManager);
      await this.crowdManager.init('/characters/just_people.glb');

      this.loadingScreen.setProgress(94, 'INITIALIZING VEHICLE SYSTEM (AWAITING .GLB MODELS)...');
      this.vehicleManager = new VehicleManager(this.engine.scene, this.physicsWorld);

      this.loadingScreen.setProgress(98, 'INITIALIZING GTA HUD & RADAR...');
      this.hud = new HUD();
      this.minimap = new Minimap();
      this.controlsOverlay = new ControlsOverlay();

      // Setup game update loop
      this.setupGameLoop();

      // Ready to play!
      this.loadingScreen.showStartButton(() => {
        this.gameLoop.start();
        this.hud.showToast('Welcome to Z-World Open World!');
      });
    } catch (error) {
      console.error('Fatal initialization error:', error);
      this.loadingScreen.setProgress(100, 'ERROR LOADING ASSETS. CHECK CONSOLE.');
    }
  }

  private setupGameLoop(): void {
    this.gameLoop.onUpdate((delta) => {
      // 1. Step Rapier physics simulation
      this.physicsWorld.step(delta);

      const playerPos = this.player.controller.position;

      // 2. Update vehicles & interaction
      this.vehicleManager.update(delta, this.input, playerPos);

      // 3. Update player with camera yaw angle
      this.player.update(delta, this.input, this.thirdPersonCamera.yaw);

      // 4. Update dynamic camera (GTA 3rd-person camera following behind hero)
      if (this.player.isInVehicle && this.player.activeVehicle) {
        this.vehicleCamera.update(delta, this.input, this.player.activeVehicle);
      } else {
        this.thirdPersonCamera.update(
          delta,
          this.input,
          playerPos,
          this.player.controller.rotation.y,
          this.player.controller.isMoving,
          this.cityManager
        );
      }

      // 5. Update environment lighting following player
      const activePos = this.player.isInVehicle && this.player.activeVehicle
        ? this.player.activeVehicle.getPosition()
        : playerPos;
      this.environment.update(activePos);

      // 6. Update dynamic proximity crowd around hero
      const playerYaw = this.player.isInVehicle && this.player.activeVehicle
        ? this.player.activeVehicle.group.rotation.y
        : this.thirdPersonCamera.yaw;
      const isHeroMoving = this.player.isInVehicle
        ? Math.abs(this.player.activeVehicle?.speed ?? 0) > 0.5
        : this.player.controller.isMoving;
      this.crowdManager.update(delta, activePos, playerYaw, isHeroMoving);

      // 7. Update Minimap / Radar
      this.minimap.update(activePos, playerYaw, this.vehicleManager.vehicles);

      // 8. Reset single-frame mouse deltas
      this.input.resetDeltas();
    });

    this.gameLoop.onRender(() => {
      this.engine.render();
    });
  }
}

// Bootstrap application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  const game = new ZWorldGame();
  game.start();
});
