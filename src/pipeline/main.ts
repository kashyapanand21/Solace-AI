import { chunkText } from "./chunker";
import { embed } from "./embedder";
import { addToStore, searchStore } from "./vectorStore";

export async function indexText(text: string) {
  const chunks = chunkText(text);

  const vecs = await Promise.all(chunks.map(embed));

  addToStore(chunks, vecs);
}

export async function runSearch(query: string) {
  const qv = await embed(query);

  return searchStore(qv);
}
