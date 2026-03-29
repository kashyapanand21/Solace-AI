function chunkText(text) {
    if (!text || typeof text !== 'string') return [];
    
    const maxTokens = 512;
    const overlapTokens = 50;

    // Split text into sentences using lookbehind for punctuation followed by whitespace.
    // This preserves the punctuation at the end of each sentence.
    const sentences = text.trim().split(/(?<=[.?!])\s+/);
    
    const chunks = [];
    let currentChunk = [];
    let currentChunkTokenCount = 0;
    
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;
        
        const words = sentence.split(/\s+/);
        const tokenCount = words.length;
        
        // Hard split if a single sentence is larger than the max chunk size
        if (tokenCount > maxTokens) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.join(' '));
                currentChunk = [];
                currentChunkTokenCount = 0;
            }
            
            for (let j = 0; j < words.length; j += (maxTokens - overlapTokens)) {
                const subWords = words.slice(j, j + maxTokens);
                chunks.push(subWords.join(' '));
            }
            continue;
        }
        
        // Flush the current chunk if adding the sentence would exceed the limit
        if (currentChunkTokenCount + tokenCount > maxTokens && currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
            
            // Build the next chunk starting with an overlap of ~50 tokens from previous sentences
            let overlapLexemes = [];
            let overlapCount = 0;
            
            for (let k = currentChunk.length - 1; k >= 0; k--) {
                const s = currentChunk[k];
                const sWordsCount = s.split(/\s+/).length;
                overlapLexemes.unshift(s);
                overlapCount += sWordsCount;
                if (overlapCount >= overlapTokens) {
                    break;
                }
            }
            
            currentChunk = [...overlapLexemes, sentence];
            currentChunkTokenCount = overlapCount + tokenCount;
        } else {
            currentChunk.push(sentence);
            currentChunkTokenCount += tokenCount;
        }
    }
    
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }
    
    return chunks;
}

module.exports = { chunkText };
