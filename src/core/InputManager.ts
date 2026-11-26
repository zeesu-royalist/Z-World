export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
  interact: boolean; // Enter/exit vehicle (F / E)
  handbrake: boolean; // Space in vehicle
  horn: boolean;      // H in vehicle
  headlights: boolean; // L in vehicle

  mouseX: number;
  mouseY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;
}

export class InputManager {
  private static instance: InputManager;
  public state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    crouch: false,
    interact: false,
    handbrake: false,
    horn: false,
    headlights: false,
    mouseX: 0,
    mouseY: 0,
    mouseDeltaX: 0,
    mouseDeltaY: 0,
  };

  public isMouseDown: boolean = false;
  private lastClientX: number = 0;
  private lastClientY: number = 0;
  private domElement: HTMLElement;

  private constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    // Keep cursor visible with grab indicator for dragging
    document.body.style.cursor = 'grab';
    this.initListeners();
  }

  public static getInstance(domElement?: HTMLElement): InputManager {
    if (!InputManager.instance) {
      if (!domElement) domElement = document.body;
      InputManager.instance = new InputManager(domElement);
    }
    return InputManager.instance;
  }

  private initListeners(): void {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Support touch / trackpad dragging
    window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: true });
    window.addEventListener('touchend', () => this.onTouchEnd());

    // Prevent context menu
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    const code = e.code;

    switch (code) {
      // Forward: W or ArrowUp
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = true;
        break;

      // Backward: S or ArrowDown
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = true;
        break;

      // Left: A or ArrowLeft
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = true;
        break;

      // Right: D or ArrowRight
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = true;
        break;

      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = true;
        break;
      case 'Space':
        this.state.jump = true;
        this.state.handbrake = true;
        break;
      case 'KeyC':
        this.state.crouch = true;
        break;
      case 'KeyE':
      case 'KeyF':
        this.state.interact = true;
        break;
      case 'KeyH':
        this.state.horn = true;
        break;
      case 'KeyL':
        this.state.headlights = !this.state.headlights;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const code = e.code;

    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = false;
        break;
      case 'Space':
        this.state.jump = false;
        this.state.handbrake = false;
        break;
      case 'KeyC':
        this.state.crouch = false;
        break;
      case 'KeyE':
      case 'KeyF':
        this.state.interact = false;
        break;
      case 'KeyH':
        this.state.horn = false;
        break;
    }
  }

  private onMouseDown(e: MouseEvent): void {
    this.isMouseDown = true;
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    document.body.style.cursor = 'grabbing';
  }

  private onMouseUp(_e?: MouseEvent): void {
    this.isMouseDown = false;
    document.body.style.cursor = 'grab';
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isMouseDown) {
      const dx = e.clientX - this.lastClientX;
      const dy = e.clientY - this.lastClientY;
      // Clamp to eliminate sudden jumps on fast swipes
      this.state.mouseDeltaX += Math.max(-50, Math.min(50, dx));
      this.state.mouseDeltaY += Math.max(-50, Math.min(50, dy));
    }

    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    this.state.mouseX = e.clientX;
    this.state.mouseY = e.clientY;
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length > 0) {
      this.isMouseDown = true;
      this.lastClientX = e.touches[0].clientX;
      this.lastClientY = e.touches[0].clientY;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.isMouseDown && e.touches.length > 0) {
      const dx = e.touches[0].clientX - this.lastClientX;
      const dy = e.touches[0].clientY - this.lastClientY;
      this.state.mouseDeltaX += Math.max(-50, Math.min(50, dx));
      this.state.mouseDeltaY += Math.max(-50, Math.min(50, dy));
      this.lastClientX = e.touches[0].clientX;
      this.lastClientY = e.touches[0].clientY;
    }
  }

  private onTouchEnd(): void {
    this.isMouseDown = false;
  }

  public resetDeltas(): void {
    this.state.mouseDeltaX = 0;
    this.state.mouseDeltaY = 0;
  }
}
