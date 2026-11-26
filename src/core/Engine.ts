import * as THREE from 'three';

export interface EngineOptions {
  canvas?: HTMLCanvasElement;
  antialias?: boolean;
  shadows?: boolean;
}

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public container: HTMLElement;

  constructor(options: EngineOptions = {}) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7bb5eb); // Sunny bright sky blue

    // Camera setup - GTA wide FOV
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    this.camera.position.set(0, 6, 10);

    const canvas =
      options.canvas ||
      (document.getElementById('game-canvas') as HTMLCanvasElement) ||
      undefined;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: options.antialias ?? true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // High quality color and tone mapping
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Shadows configuration
    if (options.shadows ?? true) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.container = this.renderer.domElement.parentElement || document.body;

    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
