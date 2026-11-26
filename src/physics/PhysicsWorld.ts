import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class PhysicsWorld {
  private static instance: PhysicsWorld;
  public rapier!: typeof RAPIER;
  public world!: RAPIER.World;
  public isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    await RAPIER.init();
    this.rapier = RAPIER;
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);
    this.isInitialized = true;
    console.log('Rapier3D Physics Engine initialized successfully.');
  }

  public step(deltaTime: number): void {
    if (!this.isInitialized) return;
    // Step Rapier physics world with clamped fixed delta
    const dt = Math.min(deltaTime, 0.1);
    this.world.timestep = dt;
    this.world.step();
  }

  public createCharacterController(offset: number = 0.05): RAPIER.KinematicCharacterController {
    const controller = this.world.createCharacterController(offset);
    controller.enableAutostep(0.4, 0.2, true); // step height 0.4m, min width 0.2m
    controller.enableSnapToGround(0.5);
    controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);
    return controller;
  }

  public createGroundPlane(y: number = 0, size: number = 5000): RAPIER.Collider {
    const groundBodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(0, y - 0.5, 0);
    const groundBody = this.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = this.rapier.ColliderDesc.cuboid(size / 2, 0.5, size / 2)
      .setFriction(0.8)
      .setRestitution(0.1);
    return this.world.createCollider(groundColliderDesc, groundBody);
  }
}
