import * as THREE from 'three';
import { WeaponBase, WeaponStats } from './WeaponBase';
import { CombatSystem } from './CombatSystem';
import { EventBus } from '../../core/EventBus';

export class FistsWeapon extends WeaponBase {
  constructor() {
    super({
      name: 'Fists (Melee)',
      type: 'melee',
      damage: 25,
      fireRate: 2.0,
      range: 2.5,
      maxAmmo: Infinity,
      currentAmmo: Infinity,
      reserveAmmo: Infinity,
      reloadTime: 0,
    });
  }
  public createProceduralMesh(): void {}
}

export class PistolWeapon extends WeaponBase {
  constructor() {
    super({
      name: '9mm Combat Pistol',
      type: 'pistol',
      damage: 35,
      fireRate: 4.5,
      range: 150,
      maxAmmo: 15,
      currentAmmo: 15,
      reserveAmmo: 60,
      reloadTime: 1.5,
    });
    this.createProceduralMesh();
  }

  public createProceduralMesh(): void {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.85, roughness: 0.3 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.7 });

    // Slide
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.28), metalMat);
    slide.position.set(0, 0.05, 0);
    slide.castShadow = true;
    this.mesh.add(slide);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.09), gripMat);
    grip.position.set(0, -0.06, -0.06);
    grip.rotation.x = 0.25;
    this.mesh.add(grip);

    // Muzzle point light
    this.muzzleFlash = new THREE.PointLight(0xffaa33, 0, 8);
    this.muzzleFlash.position.set(0, 0.05, 0.2);
    this.mesh.add(this.muzzleFlash);
  }
}

export class AssaultRifleWeapon extends WeaponBase {
  constructor() {
    super({
      name: 'AK-47 Assault Rifle',
      type: 'rifle',
      damage: 45,
      fireRate: 9.5,
      range: 350,
      maxAmmo: 30,
      currentAmmo: 30,
      reserveAmmo: 180,
      reloadTime: 2.2,
    });
    this.createProceduralMesh();
  }

  public createProceduralMesh(): void {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.25 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x663311, roughness: 0.7 });

    // Barrel / Receiver
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.65), metalMat);
    body.position.set(0, 0.04, 0.1);
    body.castShadow = true;
    this.mesh.add(body);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.25), woodMat);
    stock.position.set(0, 0, -0.32);
    this.mesh.add(stock);

    // Curved Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.12), metalMat);
    mag.position.set(0, -0.12, 0.08);
    mag.rotation.x = -0.3;
    this.mesh.add(mag);

    // Muzzle point light
    this.muzzleFlash = new THREE.PointLight(0xffbb44, 0, 12);
    this.muzzleFlash.position.set(0, 0.04, 0.5);
    this.mesh.add(this.muzzleFlash);
  }
}

export class WeaponManager {
  public weapons: (WeaponBase | null)[] = [
    new FistsWeapon(),
    new PistolWeapon(),
    new AssaultRifleWeapon(),
    null, // Shotgun slot ready
    null, // Heavy slot ready
  ];

  public currentSlot: number = 2; // Default to Rifle
  public combatSystem: CombatSystem;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.combatSystem = new CombatSystem(scene, camera);
  }

  public getCurrentWeapon(): WeaponBase {
    return this.weapons[this.currentSlot] || this.weapons[0]!;
  }

  public selectSlot(slotIndex: number, socket: THREE.Object3D): void {
    if (slotIndex < 0 || slotIndex >= this.weapons.length) return;
    const newWeapon = this.weapons[slotIndex];
    if (!newWeapon) return;

    // Detach previous weapon
    const oldWeapon = this.getCurrentWeapon();
    if (oldWeapon.mesh.parent) {
      oldWeapon.mesh.parent.remove(oldWeapon.mesh);
    }

    this.currentSlot = slotIndex;
    socket.add(newWeapon.mesh);

    EventBus.getInstance().emit('WEAPON_CHANGE', {
      slot: slotIndex + 1,
      stats: newWeapon.stats,
    });
  }

  public fire(currentTime: number): boolean {
    const weapon = this.getCurrentWeapon();
    const fired = weapon.fire(currentTime);

    if (fired) {
      this.combatSystem.fireRaycast(weapon.stats.range);
    }
    return fired;
  }

  public reload(): void {
    this.getCurrentWeapon().reload();
  }
}
