export function chunkText(text) {
  if (!text || typeof text !== "string") return [];
  const maxTokens = 512;
  const overlapTokens = 50;
  const sentences = text.trim().split(/[.?!]\s+/);
  const chunks = [];
  let currentChunk = [];
  let currentTokenCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;
    const words = sentence.split(" ");
    const tokenCount = words.length;

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

    if (currentTokenCount + tokenCount > maxTokens && currentChunk.length) {
      chunks.push(currentChunk.join(" "));
      let overlap = [];
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