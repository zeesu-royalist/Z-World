import * as THREE from 'three';

export interface EnvironmentConfig {
  sunColor?: number;
  skyColor?: number;
  fogDensity?: number;
}

export class Environment {
  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public ambientLight: THREE.AmbientLight;
  private targetPosition: THREE.Vector3 = new THREE.Vector3();

  constructor(private scene: THREE.Scene, config: EnvironmentConfig = {}) {
    // 1. Atmosphere / Fog (Crisp view with light atmospheric haze)
    const skyColor = new THREE.Color(config.skyColor ?? 0x7bb5eb);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0xa0c8ec, config.fogDensity ?? 0.00025);

    // 2. Sun Directional Light with Dynamic Shadows
    this.sunLight = new THREE.DirectionalLight(config.sunColor ?? 0xfff4e6, 2.8);
    this.sunLight.position.set(150, 300, 150);
    this.sunLight.castShadow = true;

    // Shadow Map configuration optimized for open-world draw distance
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 1000;

    const shadowExtent = 200;
    this.sunLight.shadow.camera.left = -shadowExtent;
    this.sunLight.shadow.camera.right = shadowExtent;
    this.sunLight.shadow.camera.top = shadowExtent;
    this.sunLight.shadow.camera.bottom = -shadowExtent;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 3. Hemisphere Light (Bright sky illumination + warm ground bounce)
    this.hemiLight = new THREE.HemisphereLight(0xbadfff, 0x666655, 1.2);
    this.hemiLight.position.set(0, 400, 0);
    this.scene.add(this.hemiLight);

    // 4. Ambient Light (Clear fill)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this.ambientLight);
  }

  /**
   * Updates sun shadow frustum following player position to keep shadows sharp
   */
  public update(playerPosition: THREE.Vector3): void {
    this.targetPosition.copy(playerPosition);

    this.sunLight.position.set(
      playerPosition.x + 150,
      playerPosition.y + 300,
      playerPosition.z + 150
    );
    this.sunLight.target.position.copy(playerPosition);
    this.sunLight.target.updateMatrixWorld();
  }
}
