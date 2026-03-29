export function chunkText(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  const maxTokens = 512;
  const overlapTokens = 50;

  // ⚡ faster split (avoid lookbehind regex)
  const sentences = text.trim().split(/[.?!]\s+/);

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokenCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;

    const words = sentence.split(" ");
    const tokenCount = words.length;

    // ── Hard split large sentence ──
    if (tokenCount > maxTokens) {
      if (currentChunk.length) {
        chunks.push(currentChunk.join(" "));
        currentChunk = [];
        currentTokenCount = 0;
      }

      for (let j = 0; j < words.length; j += (maxTokens - overlapTokens)) {
        chunks.push(words.slice(j, j + maxTokens).join(" "));
      }
      continue;
    }

    // ── Flush if exceeds limit ──
    if (currentTokenCount + tokenCount > maxTokens && currentChunk.length) {
      chunks.push(currentChunk.join(" "));

      // ⚡ overlap (optimized)
      let overlap: string[] = [];
      let count = 0;

      for (let k = currentChunk.length - 1; k >= 0 && count < overlapTokens; k--) {
        overlap.unshift(currentChunk[k]);
        count += currentChunk[k].split(" ").length;
      }

      currentChunk = [...overlap];
      currentTokenCount = count;
    }

    currentChunk.push(sentence);
    currentTokenCount += tokenCount;
  }

  if (currentChunk.length) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}
