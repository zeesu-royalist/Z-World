import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export type LoadProgressCallback = (percent: number, assetName: string) => void;

export class AssetManager {
  private static instance: AssetManager;
  private gltfLoader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private cache: Map<string, any> = new Map();

  private constructor() {
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    // Setup DRACO decompression support if needed
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  public async loadGLTF(
    url: string,
    onProgress?: (percent: number) => void
  ): Promise<GLTF> {
    if (this.cache.has(url)) {
      // Return cloned scene if cached
      const cached = this.cache.get(url) as GLTF;
      return cached;
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.cache.set(url, gltf);
          resolve(gltf);
        },
        (event) => {
          if (event.total > 0 && onProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        },
        (error) => {
          console.error(`Failed to load GLTF at "${url}":`, error);
          reject(error);
        }
      );
    });
  }

  public async loadTexture(url: string): Promise<THREE.Texture> {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (tex) => {
          this.cache.set(url, tex);
          resolve(tex);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }
}
