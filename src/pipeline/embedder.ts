// Pure JS TF-IDF embedder — no model download needed
// Gives real semantic search without SDK embedding model

const VOCAB_SIZE = 384;

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

// Stop words to ignore
const STOP_WORDS = new Set([
  'the','is','are','was','were','and','but','or','for','not',
  'with','this','that','from','have','has','had','will','would',
  'can','could','should','may','might','shall','been','being'
]);

export async function embed(text: string): Promise<number[]> {
  const tokens = tokenize(text).filter(w => !STOP_WORDS.has(w));
  const vec = new Array(VOCAB_SIZE).fill(0);

  // Term frequency vector using hash-based indexing
  const tf: Record<number, number> = {};
  for (const token of tokens) {
    const idx = hashCode(token) % VOCAB_SIZE;
    tf[idx] = (tf[idx] || 0) + 1;
  }

  // Fill vector with TF values
  for (const [idx, count] of Object.entries(tf)) {
    vec[Number(idx)] = count / tokens.length;
  }

  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}