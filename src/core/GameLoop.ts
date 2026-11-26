import Stats from 'stats.js';

export type UpdateCallback = (delta: number, elapsed: number) => void;
export type RenderCallback = () => void;

export class GameLoop {
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private updateCallbacks: Set<UpdateCallback> = new Set();
  private renderCallbacks: Set<RenderCallback> = new Set();
  private stats?: Stats;
  private maxDelta: number = 0.1; // clamp delta to 100ms max

  constructor(enableStats: boolean = true) {
    if (enableStats) {
      this.stats = new Stats();
      this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
      this.stats.dom.style.position = 'absolute';
      this.stats.dom.style.top = '10px';
      this.stats.dom.style.right = '10px';
      this.stats.dom.style.left = 'auto';
      this.stats.dom.style.zIndex = '9999';
      document.body.appendChild(this.stats.dom);
    }
  }

  public onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  public onRender(callback: RenderCallback): () => void {
    this.renderCallbacks.add(callback);
    return () => this.renderCallbacks.delete(callback);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.tick(time));
  }

  public stop(): void {
    this.isRunning = false;
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    this.stats?.begin();

    const rawDelta = (currentTime - this.lastTime) / 1000;
    const delta = Math.min(rawDelta, this.maxDelta);
    this.lastTime = currentTime;

    // Run game updates (input, physics, entities)
    this.updateCallbacks.forEach((cb) => {
      try {
        cb(delta, currentTime / 1000);
      } catch (err) {
        console.error('Error in update loop callback:', err);
      }
    });

    // Render frame
    this.renderCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error in render loop callback:', err);
      }
    });

    this.stats?.end();

    requestAnimationFrame((time) => this.tick(time));
  }
}
