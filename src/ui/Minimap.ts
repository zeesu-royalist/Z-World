import * as THREE from 'three';
import { VehicleBase } from '../entities/vehicles/VehicleBase';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size: number = 190; // px
  private scale: number = 0.5; // world to radar scale

  constructor() {
    const container = document.createElement('div');
    container.id = 'minimap-container';
    container.style.width = `${this.size}px`;
    container.style.height = `${this.size}px`;
    container.style.overflow = 'hidden';
    container.style.position = 'absolute';
    container.style.bottom = '25px';
    container.style.left = '25px';
    container.style.zIndex = '100';
    container.style.pointerEvents = 'none';

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.id = 'minimap-canvas';
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.canvas.style.display = 'block';
    this.canvas.style.borderRadius = '50%';
    container.appendChild(this.canvas);

    document.body.appendChild(container);
    this.ctx = this.canvas.getContext('2d')!;
  }

  public update(
    playerPos: THREE.Vector3,
    playerYaw: number,
    vehicles: VehicleBase[]
  ): void {
    const ctx = this.ctx;
    const center = this.size / 2;
    const radius = this.size / 2 - 4;

    ctx.clearRect(0, 0, this.size, this.size);

    // Save for circular clipping
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    // Radar background
    ctx.fillStyle = 'rgba(20, 28, 38, 0.88)';
    ctx.fillRect(0, 0, this.size, this.size);

    // Radar distance rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    [radius * 0.35, radius * 0.7, radius * 0.98].forEach((r) => {
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs on radar
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, this.size);
    ctx.moveTo(0, center);
    ctx.lineTo(this.size, center);
    ctx.stroke();

    // Render Vehicle Blips
    vehicles.forEach((v) => {
      const vPos = v.getPosition();
      const dx = (vPos.x - playerPos.x) * this.scale;
      const dz = (vPos.z - playerPos.z) * this.scale;

      const screenX = center + dx;
      const screenY = center + dz;

      // Distance from radar center
      if (Math.hypot(dx, dz) < radius - 8) {
        ctx.fillStyle = v.category === 'helicopter' || v.category === 'plane' ? '#ffd700' : '#00e5ff';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Render Player Arrow in Center
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(playerYaw);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // Restore clip

    // Radar Outer Border
    ctx.strokeStyle = '#445566';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    // North Indicator 'N'
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', center, 14);
  }
}
