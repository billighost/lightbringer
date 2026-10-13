import { describe, it, expect } from 'vitest';
import { validateManifest, validateCharacterDefinition } from '../../data/schemas';

describe('Asset Manifest & Character Definition Validation', () => {
  it('validates a complete and correct manifest object', () => {
    const validManifest = {
      version: '1.0.0',
      characters: {
        hero: {
          id: 'hero',
          name: 'Hero Player',
          glbPath: '/assets/characters/hero.glb',
          definitionPath: '/assets/characters/hero.json'
        }
      },
      props: {},
      animationLibraries: {
        combat_pack: {
          id: 'combat_pack',
          name: 'Combat Animation Pack',
          glbPath: '/assets/animations/combat.glb'
        }
      }
    };

    const res = validateManifest(validManifest);
    expect(res.valid).toBe(true);
    expect(res.issues.filter((i) => i.type === 'error')).toHaveLength(0);
  });

  it('detects invalid manifest missing required character fields', () => {
    const invalidManifest = {
      version: '1.0.0',
      characters: {
        bad_char: {
          id: 'bad_char',
          name: 'Missing GLB'
          // missing glbPath and definitionPath
        }
      }
    };

    const res = validateManifest(invalidManifest);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.field?.includes('glbPath'))).toBe(true);
  });

  it('validates character definition with canonical bone map', () => {
    const validDef = {
      id: 'player_test',
      name: 'Player Test',
      modelAssetId: 'player_test',
      targetHeight: 1.8,
      forwardFix: 0,
      skeletonType: 'mixamo',
      boneMap: {
        hips: 'mixamorig:Hips',
        spine: 'mixamorig:Spine'
      },
      sockets: {},
      animationMap: {}
    };

    const res = validateCharacterDefinition(validDef);
    expect(res.valid).toBe(true);
  });

  it('rejects character definition with negative or non-numeric height', () => {
    const invalidDef = {
      id: 'player_test',
      name: 'Player Test',
      modelAssetId: 'player_test',
      targetHeight: -2.0,
      skeletonType: 'mixamo',
      boneMap: {}
    };

    const res = validateCharacterDefinition(invalidDef);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.field === 'targetHeight')).toBe(true);
  });
});
