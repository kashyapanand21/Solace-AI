import { embed } from "./embedder";

// in-memory store
let store: { text: string; vec: number[] }[] = [];

// add documents (indexing)
export async function addDocs(docs: string[]) {
  const vecs = await Promise.all(docs.map(embed));

  for (let i = 0; i < docs.length; i++) {
    store.push({ text: docs[i], vec: vecs[i] });
  }
}

// dot product
function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// search
export async function search(query: string, k = 5) {
  const qv = await embed(query);

  let res = [];

  for (let i = 0; i < store.length; i++) {
    const score = dot(qv, store[i].vec);
    res.push({ text: store[i].text, score });
  }

  res.sort((a, b) => b.score - a.score);

  return res.slice(0, k);
}
