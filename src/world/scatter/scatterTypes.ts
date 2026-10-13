import { ColliderType } from '../../data/flora/archetypeTypes';

export interface ScatterInstance {
  id: string;
  archetypeId: string;
  variantIndex: number;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles [rx, ry, rz]
  scale: [number, number, number];
  isSolid: boolean;
  colliderType: ColliderType;
  colliderDimensions?: [number, number, number];
  glow?: {
    color: string;
    intensity: number;
    radius: number;
  };
  gatherableConfig?: {
    resourceId: string;
    name: string;
    respawnSeconds: number;
    interactionRadius: number;
  };
}

export interface ChunkScatterResult {
  chunkKey: string;
  chunkX: number;
  chunkZ: number;
  instances: ScatterInstance[];
  archetypeCounts: Record<string, number>;
  generationTimeMs: number;
}
