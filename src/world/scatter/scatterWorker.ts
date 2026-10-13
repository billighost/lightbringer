import { RegionData } from '../../data/regions/schema';
import { HeightFunction } from '../terrain/heightFunction';
import { ExclusionManager } from './exclusion';
import { ScatterGenerator } from './scatterGenerator';
import { ChunkScatterResult } from './scatterTypes';

export interface ScatterWorkerRequest {
  requestId: number;
  chunkKey: string;
  chunkX: number;
  chunkZ: number;
  region: RegionData;
}

export interface ScatterWorkerResponse {
  requestId: number;
  chunkKey: string;
  chunkX: number;
  chunkZ: number;
  result: ChunkScatterResult;
}

let cachedGenerator: ScatterGenerator | null = null;
let cachedRegionId: string | null = null;

self.onmessage = (e: MessageEvent<ScatterWorkerRequest>) => {
  const { requestId, chunkKey, chunkX, chunkZ, region } = e.data;

  if (!cachedGenerator || cachedRegionId !== region.id) {
    const heightFunc = new HeightFunction(region);
    const exclusionMgr = new ExclusionManager(region.features);
    cachedGenerator = new ScatterGenerator(region, heightFunc, exclusionMgr);
    cachedRegionId = region.id;
  }

  const result = cachedGenerator.generateChunk(chunkX, chunkZ);

  const response: ScatterWorkerResponse = {
    requestId,
    chunkKey,
    chunkX,
    chunkZ,
    result
  };

  self.postMessage(response);
};
