import * as THREE from 'three';
import { EventBus } from '../../core/EventBus';

export type WeaponType = 'melee' | 'pistol' | 'rifle' | 'shotgun' | 'rpg';

export interface WeaponStats {
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number; // rounds per second
  range: number;
  maxAmmo: number;
  currentAmmo: number;
  reserveAmmo: number;
  reloadTime: number; // seconds
}

export abstract class WeaponBase {
  public mesh: THREE.Group = new THREE.Group();
  public stats: WeaponStats;
  public isReloading: boolean = false;
  private lastFireTime: number = 0;
  protected muzzleFlash?: THREE.PointLight;

  constructor(stats: WeaponStats) {
    this.stats = stats;
  }

  public canFire(currentTime: number): boolean {
    if (this.isReloading) return false;
    if (this.stats.type !== 'melee' && this.stats.currentAmmo <= 0) return false;
    const interval = 1 / this.stats.fireRate;
    return currentTime - this.lastFireTime >= interval;
  }

  public fire(currentTime: number): boolean {
    if (!this.canFire(currentTime)) return false;

    this.lastFireTime = currentTime;
    if (this.stats.type !== 'melee') {
      this.stats.currentAmmo--;
    }

    // Trigger muzzle flash effect
    if (this.muzzleFlash) {
      this.muzzleFlash.intensity = 8.0;
      setTimeout(() => {
        if (this.muzzleFlash) this.muzzleFlash.intensity = 0;
      }, 50);
    }

    // Broadcast ammo update
    EventBus.getInstance().emit('AMMO_CHANGE', {
      current: this.stats.currentAmmo,
      reserve: this.stats.reserveAmmo,
      name: this.stats.name,
    });

    return true;
  }

  public reload(): void {
    if (this.isReloading || this.stats.type === 'melee') return;
    if (this.stats.currentAmmo >= this.stats.maxAmmo || this.stats.reserveAmmo <= 0) return;

    this.isReloading = true;
    EventBus.getInstance().emit('NOTIFICATION', `Reloading ${this.stats.name}...`);

    setTimeout(() => {
      const needed = this.stats.maxAmmo - this.stats.currentAmmo;
      const toReload = Math.min(needed, this.stats.reserveAmmo);
      this.stats.currentAmmo += toReload;
      this.stats.reserveAmmo -= toReload;
      this.isReloading = false;

      EventBus.getInstance().emit('AMMO_CHANGE', {
        current: this.stats.currentAmmo,
        reserve: this.stats.reserveAmmo,
        name: this.stats.name,
      });
    }, this.stats.reloadTime * 1000);
  }

  public abstract createProceduralMesh(): void;
}
