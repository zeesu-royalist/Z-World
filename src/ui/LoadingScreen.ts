export class LoadingScreen {
  private element: HTMLElement;
  private progressBar: HTMLElement;
  private progressText: HTMLElement;
  private statusText: HTMLElement;
  private startButton: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'loading-screen';
    this.element.innerHTML = `
      <div class="loading-content">
        <div class="game-logo">
          <h1>Z - WORLD</h1>
          <p class="subtitle">OPEN WORLD 3D ACTION</p>
        </div>
        <div class="progress-container">
          <div class="progress-bar-bg">
            <div id="progress-bar-fill" class="progress-bar-fill"></div>
          </div>
          <div class="progress-info">
            <span id="loading-status">INITIALIZING 3D ENGINE...</span>
            <span id="loading-percent">0%</span>
          </div>
        </div>
        <button id="start-game-btn" class="start-btn" style="display: none;">ENTER CITY</button>
        <div class="game-tips">
          <p>💡 Tip: Press <b>[F]</b> or <b>[E]</b> to enter/exit cars, bikes, helicopters, planes & boats.</p>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);

    this.progressBar = document.getElementById('progress-bar-fill')!;
    this.progressText = document.getElementById('loading-percent')!;
    this.statusText = document.getElementById('loading-status')!;
    this.startButton = document.getElementById('start-game-btn')!;
  }

  public setProgress(percent: number, status?: string): void {
    const clamped = Math.min(Math.max(percent, 0), 100);
    this.progressBar.style.width = `${clamped}%`;
    this.progressText.innerText = `${clamped}%`;
    if (status) {
      this.statusText.innerText = status;
    }
  }

  public showStartButton(onStart: () => void): void {
    this.statusText.innerText = 'WORLD LOADED & READY!';
    this.progressBar.style.width = '100%';
    this.progressText.innerText = '100%';
    this.startButton.style.display = 'inline-block';

    this.startButton.onclick = () => {
      this.hide();
      onStart();
    };
  }

  public hide(): void {
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    setTimeout(() => {
      this.element.remove();
    }, 600);
  }
}
