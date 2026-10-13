import * as THREE from 'three';
import { ChunkScatterManager } from '../scatter/chunkScatterManager';
import { GatherableComponent } from './gatherableComponent';

export class GatherableManager {
  private scatterManager: ChunkScatterManager;
  private gatherables = new Map<string, GatherableComponent>();

  // Nearest interactable node
  private activeTarget: GatherableComponent | null = null;
  private promptElement: HTMLDivElement | null = null;

  constructor(scatterManager: ChunkScatterManager) {
    this.scatterManager = scatterManager;
    this.createPromptUI();
    this.setupInputListener();
  }

  private createPromptUI(): void {
    const existing = document.getElementById('gather-prompt');
    if (existing) {
      this.promptElement = existing as HTMLDivElement;
      return;
    }

    const div = document.createElement('div');
    div.id = 'gather-prompt';
    div.style.position = 'fixed';
    div.style.bottom = '85px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.background = 'rgba(8, 28, 34, 0.85)';
    div.style.backdropFilter = 'blur(8px)';
    div.style.border = '1px solid rgba(0, 242, 255, 0.4)';
    div.style.boxShadow = '0 0 16px rgba(0, 242, 255, 0.35)';
    div.style.borderRadius = '6px';
    div.style.padding = '8px 18px';
    div.style.color = '#e2f8fa';
    div.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    div.style.fontSize = '14px';
    div.style.fontWeight = '600';
    div.style.letterSpacing = '0.5px';
    div.style.pointerEvents = 'none';
    div.style.zIndex = '25';
    div.style.display = 'none';
    div.style.transition = 'opacity 0.15s ease';

    document.body.appendChild(div);
    this.promptElement = div;
  }

  private setupInputListener(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        this.attemptGather();
      }
    });
  }

  public attemptGather(): boolean {
    if (this.activeTarget && this.activeTarget.state === 'available') {
      const success = this.activeTarget.gather();
      if (success) {
        this.updatePrompt();
        return true;
      }
    }
    return false;
  }

  public update(dt: number, playerPos: THREE.Vector3, playerFacing?: THREE.Vector3): void {
    // 1. Sync gatherable instances from scatter manager query
    const nearby = this.scatterManager.queryNearby(playerPos, 28.0, { gatherableOnly: true });

    for (const item of nearby) {
      const inst = item.instance;
      if (!this.gatherables.has(inst.id) && inst.gatherableConfig) {
        this.gatherables.set(
          inst.id,
          new GatherableComponent({
            id: inst.id,
            resourceId: inst.gatherableConfig.resourceId,
            name: inst.gatherableConfig.name,
            position: inst.position,
            respawnSeconds: inst.gatherableConfig.respawnSeconds,
            interactionRadius: inst.gatherableConfig.interactionRadius
          })
        );
      }
    }

    // 2. Update timers and visual lerp factors on tracked gatherables
    for (const comp of this.gatherables.values()) {
      comp.update(dt);
    }

    // 3. Find closest available gatherable within interaction radius
    let closest: GatherableComponent | null = null;
    let closestDist = Infinity;

    for (const comp of this.gatherables.values()) {
      const dx = comp.position[0] - playerPos.x;
      const dy = comp.position[1] - playerPos.y;
      const dz = comp.position[2] - playerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= comp.interactionRadius && dist < closestDist) {
        // Check facing angle if playerFacing vector is provided
        if (playerFacing) {
          const toTarget = new THREE.Vector3(dx, 0, dz).normalize();
          const dot = playerFacing.x * toTarget.x + playerFacing.z * toTarget.z;
          if (dot < -0.15) {
            // Target is roughly behind player, ignore
            continue;
          }
        }

        closest = comp;
        closestDist = dist;
      }
    }

    this.activeTarget = closest;
    this.updatePrompt();
  }

  private updatePrompt(): void {
    if (!this.promptElement) return;

    if (this.activeTarget && this.activeTarget.state === 'available') {
      this.promptElement.style.display = 'block';
      this.promptElement.innerHTML = `<span style="background: rgba(0, 242, 255, 0.25); border: 1px solid rgba(0, 242, 255, 0.6); padding: 2px 7px; border-radius: 4px; color: #ffffff; margin-right: 6px;">E</span> Gather ${this.activeTarget.name}`;
    } else {
      this.promptElement.style.display = 'none';
    }
  }

  public getActiveTarget(): GatherableComponent | null {
    return this.activeTarget;
  }

  public getTrackedGatherables(): GatherableComponent[] {
    return Array.from(this.gatherables.values());
  }

  public dispose(): void {
    if (this.promptElement && this.promptElement.parentNode) {
      this.promptElement.parentNode.removeChild(this.promptElement);
    }
    this.gatherables.clear();
    this.activeTarget = null;
  }
}
