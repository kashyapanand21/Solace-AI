type Item = {
  text: string;
  vec: number[];
};

let store: Item[] = [];

// ── add vectors ─────────────────────────────
export function addToStore(texts: string[], vecs: number[][]) {
  for (let i = 0; i < texts.length; i++) {
    store.push({ text: texts[i], vec: vecs[i] });
  }
}

// ── dot product (fast) ─────────────────────
function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ── search ─────────────────────────────────
export function searchStore(queryVec: number[], k = 5) {
  let res = [];

  for (let i = 0; i < store.length; i++) {
    const score = dot(queryVec, store[i].vec);
    res.push({ text: store[i].text, score });
  }

  res.sort((a, b) => b.score - a.score);

  return res.slice(0, k);
}
