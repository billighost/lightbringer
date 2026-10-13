import * as THREE from 'three';

export interface GlowSource {
  id: string;
  position: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  radius: number;
}

export interface PoolLightSlot {
  light: THREE.PointLight;
  currentSourceId: string | null;
  targetIntensity: number;
  targetColor: THREE.Color;
  targetPos: THREE.Vector3;
}

export class LightPool {
  public scene: THREE.Scene;
  public maxLights: number;
  private glowSources = new Map<string, GlowSource>();
  private slots: PoolLightSlot[] = [];

  // Debug visualization
  private debugGroup: THREE.Group;
  public debugVisible = false;
  private debugHelpers: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, maxLights = 6) {
    this.scene = scene;
    this.maxLights = maxLights;
    this.debugGroup = new THREE.Group();
    this.debugGroup.visible = false;
    this.scene.add(this.debugGroup);

    this.initPool();
  }

  private initPool(): void {
    const helperGeo = new THREE.SphereGeometry(0.2, 8, 8);

    for (let i = 0; i < this.maxLights; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 15, 2.0);
      light.castShadow = false; // Glow sources are fill lights, only player light casts shadow
      this.scene.add(light);

      const helperMat = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x00f2ff });
      const helper = new THREE.Mesh(helperGeo, helperMat);
      this.debugGroup.add(helper);
      this.debugHelpers.push(helper);

      this.slots.push({
        light,
        currentSourceId: null,
        targetIntensity: 0,
        targetColor: new THREE.Color(0xffffff),
        targetPos: new THREE.Vector3()
      });
    }
  }

  public registerGlowSource(
    id: string,
    position: THREE.Vector3,
    color: THREE.Color | string | number,
    intensity: number,
    radius: number
  ): void {
    const col = color instanceof THREE.Color ? color.clone() : new THREE.Color(color);
    this.glowSources.set(id, {
      id,
      position: position.clone(),
      color: col,
      intensity,
      radius
    });
  }

  public updateGlowSource(id: string, position: THREE.Vector3, intensity?: number): void {
    const source = this.glowSources.get(id);
    if (source) {
      source.position.copy(position);
      if (intensity !== undefined) {
        source.intensity = intensity;
      }
    }
  }

  public unregisterGlowSource(id: string): void {
    this.glowSources.delete(id);
  }

  public update(dt: number, referencePos: THREE.Vector3): void {
    // 1. Sort registered sources by distance to reference point (e.g. player)
    const sortedSources = Array.from(this.glowSources.values()).sort((a, b) => {
      const distA = a.position.distanceToSquared(referencePos);
      const distB = b.position.distanceToSquared(referencePos);
      return distA - distB;
    });

    const activeTopSources = sortedSources.slice(0, this.maxLights);
    const assignedSourceIds = new Set<string>();

    // 2. Preserve slot continuity for sources already bound
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.currentSourceId) {
        const stillInTop = activeTopSources.find((s) => s.id === slot.currentSourceId);
        if (stillInTop) {
          assignedSourceIds.add(stillInTop.id);
          slot.targetIntensity = stillInTop.intensity;
          slot.targetColor.copy(stillInTop.color);
          slot.targetPos.copy(stillInTop.position);
          slot.light.distance = stillInTop.radius;
        } else {
          // Source fell out of top N, smoothly fade out
          slot.targetIntensity = 0;
          if (slot.light.intensity <= 0.02) {
            slot.currentSourceId = null;
          }
        }
      }
    }

    // 3. Assign unallocated top sources to available slots
    for (const source of activeTopSources) {
      if (!assignedSourceIds.has(source.id)) {
        // Find empty slot or fading slot with lowest intensity
        let bestSlot: PoolLightSlot | null = null;
        let lowestIntensity = Infinity;

        for (const slot of this.slots) {
          if (!slot.currentSourceId) {
            bestSlot = slot;
            break;
          } else if (slot.targetIntensity === 0 && slot.light.intensity < lowestIntensity) {
            lowestIntensity = slot.light.intensity;
            bestSlot = slot;
          }
        }

        if (bestSlot) {
          bestSlot.currentSourceId = source.id;
          bestSlot.targetIntensity = source.intensity;
          bestSlot.targetColor.copy(source.color);
          bestSlot.targetPos.copy(source.position);
          bestSlot.light.position.copy(source.position);
          bestSlot.light.distance = source.radius;
          assignedSourceIds.add(source.id);
        }
      }
    }

    // 4. Smooth interpolation of light values to eliminate popping / flicker
    const lerpSpeed = Math.min(1.0, dt * 7.0);

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      slot.light.intensity = THREE.MathUtils.lerp(slot.light.intensity, slot.targetIntensity, lerpSpeed);
      slot.light.color.lerp(slot.targetColor, lerpSpeed);
      slot.light.position.lerp(slot.targetPos, lerpSpeed);

      if (this.debugVisible) {
        const helper = this.debugHelpers[i];
        helper.position.copy(slot.light.position);
        helper.visible = slot.light.intensity > 0.05;
        (helper.material as THREE.MeshBasicMaterial).color.copy(slot.light.color);
      }
    }
  }

  public setDebugVisible(visible: boolean): void {
    this.debugVisible = visible;
    this.debugGroup.visible = visible;
  }

  public getActiveAssignments(): { slotIndex: number; sourceId: string | null; intensity: number }[] {
    return this.slots.map((s, idx) => ({
      slotIndex: idx,
      sourceId: s.currentSourceId,
      intensity: s.light.intensity
    }));
  }

  public dispose(): void {
    for (const slot of this.slots) {
      this.scene.remove(slot.light);
      slot.light.dispose();
    }
    this.scene.remove(this.debugGroup);
    this.slots = [];
    this.glowSources.clear();
  }
}
