export class ControlsOverlay {
  private element: HTMLElement;
  private isVisible: boolean = true;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'controls-overlay';
    this.element.innerHTML = `
      <div class="controls-card">
        <div class="controls-header">
          <h3>🎮 CONTROLS</h3>
          <span class="hint-key">[H] Toggle Help</span>
        </div>
        <div class="controls-grid">
          <div class="ctrl-row"><span>W, A, S, D</span> <small>Move Character / Steer Vehicle</small></div>
          <div class="ctrl-row"><span>DRAG MOUSE / TRACKPAD</span> <small>Orbit Camera (Cursor Visible)</small></div>
          <div class="ctrl-row"><span>SHIFT</span> <small>Sprint / Aircraft Boost</small></div>
          <div class="ctrl-row"><span>SPACE</span> <small>Jump / Handbrake Drift</small></div>
          <div class="ctrl-row"><span>F or E</span> <small>Enter / Exit Vehicle</small></div>
          <div class="ctrl-row"><span>L</span> <small>Toggle Vehicle Headlights</small></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH') {
        this.toggle();
      }
    });
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.element.style.display = this.isVisible ? 'block' : 'none';
  }
}
