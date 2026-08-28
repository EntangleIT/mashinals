import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mashCharacters,
  recipeKey,
  validateGenes,
  STARTERS,
  type MashParents,
} from './index.js';

function asParent(id: string): MashParents {
  const s = STARTERS.find((x) => x.id === id)!;
  return {
    id: s.id,
    name: s.name,
    generation: s.generation,
    spec: s.spec,
    origin: s.origin,
  };
}

describe('deterministic mash', () => {
  it('same parents always yield the same child', () => {
    const a = asParent('starter_spark');
    const b = asParent('starter_meme');
    const r1 = mashCharacters(a, b);
    const r2 = mashCharacters(b, a);
    assert.equal(r1.recipeKey, r2.recipeKey);
    assert.equal(r1.name, r2.name);
    assert.equal(r1.caption, r2.caption);
    assert.equal(r1.generation, r2.generation);
    assert.deepEqual(r1.spec, r2.spec);
  });

  it('different parents yield different children', () => {
    const spark = asParent('starter_spark');
    const meme = asParent('starter_meme');
    const tide = asParent('starter_tide');
    const r1 = mashCharacters(spark, meme);
    const r2 = mashCharacters(spark, tide);
    assert.notEqual(r1.recipeKey, r2.recipeKey);
    assert.notDeepEqual(r1.spec.genes, r2.spec.genes);
  });

  it('genes stay within valid part indices', () => {
    for (let i = 0; i < STARTERS.length; i++) {
      for (let j = i + 1; j < STARTERS.length; j++) {
        const result = mashCharacters(asParent(STARTERS[i]!.id), asParent(STARTERS[j]!.id));
        assert.ok(
          validateGenes(result.spec),
          `invalid genes for ${STARTERS[i]!.name}+${STARTERS[j]!.name}`,
        );
      }
    }
  });

  it('recipeKey is order-independent', () => {
    assert.equal(recipeKey('a', 'b'), recipeKey('b', 'a'));
  });

  it('generation increments from parents', () => {
    const a = asParent('starter_spark');
    const b = asParent('starter_heart');
    const child = mashCharacters(a, b);
    assert.equal(child.generation, 1);
    const deeper = mashCharacters(
      { ...a, id: 'child', name: child.name, generation: child.generation, spec: child.spec },
      b,
    );
    assert.equal(deeper.generation, 2);
  });
});
