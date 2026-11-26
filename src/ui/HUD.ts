import { EventBus } from '../core/EventBus';

export class HUD {
  private element: HTMLElement;
  private healthFill: HTMLElement;
  private armorFill: HTMLElement;
  private cashText: HTMLElement;
  private speedometer: HTMLElement;
  private speedValue: HTMLElement;
  private interactPrompt: HTMLElement;
  private notificationArea: HTMLElement;
  private starsContainer: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'game-hud';
    this.element.innerHTML = `
      <!-- Top Right: Cash & Wanted Stars -->
      <div class="hud-top-right">
        <div class="hud-cash" id="hud-cash">$250,000</div>
        <div class="hud-wanted" id="hud-wanted">
          <span class="star active">★</span>
          <span class="star">★</span>
          <span class="star">★</span>
          <span class="star">★</span>
          <span class="star">★</span>
        </div>
      </div>

      <!-- Top Center: Interaction / Drive Prompt -->
      <div id="interact-prompt" class="interact-prompt" style="display: none;">
        <span class="key-badge">F</span>
        <span id="prompt-text">Drive Vehicle</span>
      </div>

      <!-- Notifications Toast Area -->
      <div id="notification-area" class="notification-area"></div>

      <!-- Bottom Center: Health, Armor & Vehicle Speed -->
      <div class="hud-bottom-center">
        <!-- Speedometer (shown when in vehicle) -->
        <div id="hud-speedometer" class="speedometer" style="display: none;">
          <div class="speed-number"><span id="speed-value">0</span> <small>KM/H</small></div>
          <div class="speed-bar-bg"><div id="speed-bar-fill" class="speed-bar-fill"></div></div>
        </div>

        <!-- Vital Bars -->
        <div class="vitals-container">
          <div class="vital-bar armor">
            <div id="armor-fill" class="vital-fill" style="width: 100%;"></div>
          </div>
          <div class="vital-bar health">
            <div id="health-fill" class="vital-fill" style="width: 100%;"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);

    this.healthFill = document.getElementById('health-fill')!;
    this.armorFill = document.getElementById('armor-fill')!;
    this.cashText = document.getElementById('hud-cash')!;
    this.speedometer = document.getElementById('hud-speedometer')!;
    this.speedValue = document.getElementById('speed-value')!;
    this.interactPrompt = document.getElementById('interact-prompt')!;
    this.notificationArea = document.getElementById('notification-area')!;
    this.starsContainer = document.getElementById('hud-wanted')!;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const bus = EventBus.getInstance();

    bus.on('HEALTH_CHANGE', ({ health, armor }) => {
      this.healthFill.style.width = `${Math.max(0, health)}%`;
      this.armorFill.style.width = `${Math.max(0, armor)}%`;
    });

    bus.on('CASH_CHANGE', ({ amount }) => {
      this.cashText.innerText = `$${amount.toLocaleString()}`;
    });

    bus.on('WANTED_CHANGE', ({ level }) => {
      const stars = this.starsContainer.querySelectorAll('.star');
      stars.forEach((s, idx) => {
        if (idx < level) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });

    bus.on('PROMPT_SHOW', ({ key, text }) => {
      const keyEl = this.interactPrompt.querySelector('.key-badge') as HTMLElement;
      const textEl = document.getElementById('prompt-text')!;
      if (keyEl) keyEl.innerText = key;
      if (textEl) textEl.innerText = text;
      this.interactPrompt.style.display = 'flex';
    });

    bus.on('PROMPT_HIDE', () => {
      this.interactPrompt.style.display = 'none';
    });

    bus.on('PLAYER_ENTER_VEHICLE', () => {
      this.speedometer.style.display = 'flex';
    });

    bus.on('PLAYER_EXIT_VEHICLE', () => {
      this.speedometer.style.display = 'none';
    });
  }

  public updateSpeedometer(speedKmh: number): void {
    if (this.speedometer.style.display !== 'none') {
      this.speedValue.innerText = Math.round(speedKmh).toString();
      const fill = document.getElementById('speed-bar-fill');
      if (fill) {
        const pct = Math.min(100, (speedKmh / 220) * 100);
        fill.style.width = `${pct}%`;
      }
    }
  }

  public showToast(message: string, durationMs: number = 3500): void {
    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.innerText = message;
    this.notificationArea.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, durationMs);
  }
}
