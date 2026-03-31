import { embed } from "./embedder";

let store = [];

export async function addDocs(docs) {
  const vecs = await Promise.all(docs.map(embed));
  for (let i = 0; i < docs.length; i++) {
    store.push({ text: docs[i], vec: vecs[i] });
  }
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export async function search(query, k = 5) {
  const qv = await embed(query);
  let res = [];
  for (let i = 0; i < store.length; i++) {
    const score = dot(qv, store[i].vec);
    res.push({ text: store[i].text, score });
  }
  res.sort((a, b) => b.score - a.score);
  return res.slice(0, k);
}