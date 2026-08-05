import { describe, expect, it } from 'vitest'
import { cosineSimilarity, hammingDistance, parseEmbedding } from './imageMatch'

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
  })

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('is 0 when either vector is all zeros', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0)
  })
})

describe('hammingDistance', () => {
  it('is 0 for identical hashes', () => {
    expect(hammingDistance(0b1010n, 0b1010n)).toBe(0)
  })

  it('counts differing bits', () => {
    expect(hammingDistance(0b1010n, 0b0010n)).toBe(1)
    expect(hammingDistance(0b1111n, 0b0000n)).toBe(4)
  })
})

describe('parseEmbedding', () => {
  it('passes through arrays', () => {
    expect(parseEmbedding([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('parses a JSON-string embedding', () => {
    expect(parseEmbedding('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('returns null for invalid input', () => {
    expect(parseEmbedding('not json')).toBeNull()
    expect(parseEmbedding(null)).toBeNull()
    expect(parseEmbedding(42)).toBeNull()
  })
})
