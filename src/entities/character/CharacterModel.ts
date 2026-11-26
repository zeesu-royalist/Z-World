import * as THREE from 'three';
import { AssetManager } from '../../core/AssetManager';

export class CharacterModel {
  public group: THREE.Group;
  public modelWrapper: THREE.Group;
  public mixer?: THREE.AnimationMixer;
  public idleAction?: THREE.AnimationAction;
  public runAction?: THREE.AnimationAction;

  public isHeroLoaded: boolean = false;
  // Scaled height for natural proportion with city streets and buildings
  private baseHeight: number = 0.95;

  // Animation blending weights
  private currentIdleWeight: number = 1.0;
  private currentRunWeight: number = 0.0;

  constructor() {
    this.group = new THREE.Group();
    this.modelWrapper = new THREE.Group();
    this.group.add(this.modelWrapper);
  }

  public async loadCharacterModel(glbPath: string = '/characters/character_modal.glb'): Promise<boolean> {
    try {
      console.log(`Loading Hero Model with Animations: ${glbPath}`);
      const gltf = await AssetManager.getInstance().loadGLTF(glbPath);

      // Clean existing children
      while (this.modelWrapper.children.length > 0) {
        this.modelWrapper.remove(this.modelWrapper.children[0]);
      }

      const heroScene = gltf.scene;

      // 1. Configure shadows and materials
      heroScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;

          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              const stdMat = m as THREE.MeshStandardMaterial;
              if (stdMat.map) {
                stdMat.map.colorSpace = THREE.SRGBColorSpace;
                stdMat.map.anisotropy = 8;
              }
            });
          }
        }
      });

      // 2. Measure bounding box and scale to natural proportionate human size
      const rawBox = new THREE.Box3().setFromObject(heroScene);
      const rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);

      const scale = this.baseHeight / Math.max(rawSize.y, 0.1);
      heroScene.scale.set(scale, scale, scale);

      const scaledBox = new THREE.Box3().setFromObject(heroScene);
      const scaledCenter = new THREE.Vector3();
      scaledBox.getCenter(scaledCenter);

      // Center horizontally and align feet to Y = 0
      heroScene.position.x = -scaledCenter.x;
      heroScene.position.y = -scaledBox.min.y;
      heroScene.position.z = -scaledCenter.z;

      this.modelWrapper.add(heroScene);

      // 3. Setup AnimationMixer with Idle Animation + Running Animation
      if (gltf.animations && gltf.animations.length > 0) {
        const runClip = gltf.animations[0];
        this.mixer = new THREE.AnimationMixer(heroScene);

        // Build a natural standing idle animation clip (arms relaxed down at sides with subtle breathing)
        const idleClip = this.createNaturalIdleClip(heroScene, runClip);

        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
        this.idleAction.play();
        this.idleAction.setEffectiveWeight(1.0);

        this.runAction = this.mixer.clipAction(runClip);
        this.runAction.setLoop(THREE.LoopRepeat, Infinity);
        this.runAction.play();
        this.runAction.setEffectiveWeight(0.0);
        this.runAction.timeScale = 1.0;

        console.log(`Animations configured: Natural Idle Pose + Run Cycle (${runClip.name}).`);
      }

      this.isHeroLoaded = true;
      console.log(`Hero Model "${glbPath}" successfully mounted and ready!`);
      return true;
    } catch (err) {
      console.error(`Failed to load hero model at ${glbPath}:`, err);
      return false;
    }
  }

  /**
   * Synthesizes a natural human standing idle clip:
   * - Arms lowered relaxed alongside torso/legs (no T-pose)
   * - Forearms with gentle natural elbow curve
   * - Spine and chest with gentle rhythmic breathing oscillation
   * - Straight grounded legs
   */
  private createNaturalIdleClip(scene: THREE.Group, runClip: THREE.AnimationClip): THREE.AnimationClip {
    const duration = 2.4;
    const times = [0, 1.2, 2.4];
    const tracks: THREE.KeyframeTrack[] = [];

    // Pre-calculated relaxed arm quaternions (pointing naturally downwards beside the hips)
    const leftArmIdle = new THREE.Quaternion(0.652377, 0.070009, -0.021578, 0.754346);
    const rightArmIdle = new THREE.Quaternion(0.652377, -0.070008, 0.021577, 0.754346);

    // Slight natural elbow bend
    const lfa = scene.getObjectByName('LeftForeArm_18');
    const rfa = scene.getObjectByName('RightForeArm_37');
    const leftForeArmIdle = lfa
      ? lfa.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.18))
      : new THREE.Quaternion();
    const rightForeArmIdle = rfa
      ? rfa.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.18))
      : new THREE.Quaternion();

    scene.traverse((child) => {
      if (!child.name) return;
      const bName = child.name;

      if (bName === 'LeftArm_19') {
        // Arm relaxed down with subtle breathing sway
        const q0 = leftArmIdle.clone();
        const q1 = leftArmIdle.clone().multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.02)
        );
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${bName}.quaternion`,
            times,
            [q0.x, q0.y, q0.z, q0.w, q1.x, q1.y, q1.z, q1.w, q0.x, q0.y, q0.z, q0.w]
          )
        );
      } else if (bName === 'RightArm_38') {
        const q0 = rightArmIdle.clone();
        const q1 = rightArmIdle.clone().multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.02)
        );
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${bName}.quaternion`,
            times,
            [q0.x, q0.y, q0.z, q0.w, q1.x, q1.y, q1.z, q1.w, q0.x, q0.y, q0.z, q0.w]
          )
        );
      } else if (bName === 'LeftForeArm_18') {
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${bName}.quaternion`,
            times,
            [
              leftForeArmIdle.x, leftForeArmIdle.y, leftForeArmIdle.z, leftForeArmIdle.w,
              leftForeArmIdle.x, leftForeArmIdle.y, leftForeArmIdle.z, leftForeArmIdle.w,
              leftForeArmIdle.x, leftForeArmIdle.y, leftForeArmIdle.z, leftForeArmIdle.w,
            ]
          )
        );
      } else if (bName === 'RightForeArm_37') {
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${bName}.quaternion`,
            times,
            [
              rightForeArmIdle.x, rightForeArmIdle.y, rightForeArmIdle.z, rightForeArmIdle.w,
              rightForeArmIdle.x, rightForeArmIdle.y, rightForeArmIdle.z, rightForeArmIdle.w,
              rightForeArmIdle.x, rightForeArmIdle.y, rightForeArmIdle.z, rightForeArmIdle.w,
            ]
          )
        );
      } else if (bName === 'Spine_42' || bName === 'Spine1_41' || bName === 'Spine2_40') {
        // Natural chest breathing
        const qRest = child.quaternion.clone();
        const qBreath = qRest.clone().multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.012)
        );
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${bName}.quaternion`,
            times,
            [qRest.x, qRest.y, qRest.z, qRest.w, qBreath.x, qBreath.y, qBreath.z, qBreath.w, qRest.x, qRest.y, qRest.z, qRest.w]
          )
        );
      } else if (bName === 'Hips_51') {
        // Subtle vertical breathing bob
        const pRest = child.position.clone();
        const pBreath = pRest.clone().add(new THREE.Vector3(0, 0.003, 0));
        tracks.push(
          new THREE.VectorKeyframeTrack(
            `${bName}.position`,
            times,
            [pRest.x, pRest.y, pRest.z, pBreath.x, pBreath.y, pBreath.z, pRest.x, pRest.y, pRest.z]
          )
        );
        const qRest = child.quaternion.clone();
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${bName}.quaternion`,
            times,
            [qRest.x, qRest.y, qRest.z, qRest.w, qRest.x, qRest.y, qRest.z, qRest.w, qRest.x, qRest.y, qRest.z, qRest.w]
          )
        );
      } else if ((child as THREE.Bone).isBone || runClip.tracks.some((t) => t.name.startsWith(bName + '.'))) {
        // Retain straight standing posture for legs, feet, neck, head, and fingers
        const qRest = child.quaternion.clone();
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${bName}.quaternion`,
            times,
            [qRest.x, qRest.y, qRest.z, qRest.w, qRest.x, qRest.y, qRest.z, qRest.w, qRest.x, qRest.y, qRest.z, qRest.w]
          )
        );
      }
    });

    return new THREE.AnimationClip('idle_natural', duration, tracks);
  }

  public update(delta: number, speed: number, isGrounded: boolean): void {
    const isMoving = isGrounded && speed > 0.3;
    const speedRatio = Math.min(speed / 12.5, 1.0); // 0 to 1

    if (this.mixer && this.idleAction && this.runAction) {
      if (isMoving) {
        // Moving: crossfade into Running animation
        const targetTimeScale = THREE.MathUtils.lerp(1.1, 2.3, speedRatio);
        this.runAction.timeScale = targetTimeScale;

        this.currentRunWeight = THREE.MathUtils.lerp(this.currentRunWeight, 1.0, delta * 8);
        this.currentIdleWeight = THREE.MathUtils.lerp(this.currentIdleWeight, 0.0, delta * 8);

        // Athletic forward lean when sprinting
        const forwardLean = speedRatio * 0.12;
        this.modelWrapper.rotation.x = THREE.MathUtils.lerp(
          this.modelWrapper.rotation.x,
          forwardLean,
          delta * 8
        );
      } else {
        // Stopped: smoothly blend into Natural Standing Idle pose
        this.currentIdleWeight = THREE.MathUtils.lerp(this.currentIdleWeight, 1.0, delta * 8);
        this.currentRunWeight = THREE.MathUtils.lerp(this.currentRunWeight, 0.0, delta * 8);

        // Reset forward lean
        this.modelWrapper.rotation.x = THREE.MathUtils.lerp(this.modelWrapper.rotation.x, 0, delta * 8);
      }

      this.idleAction.setEffectiveWeight(this.currentIdleWeight);
      this.runAction.setEffectiveWeight(this.currentRunWeight);

      // Continuous mixer update preserves smooth transition
      this.mixer.update(delta);
    }
  }
}
