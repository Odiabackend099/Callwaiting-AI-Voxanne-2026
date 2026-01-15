/**
 * Document Chunking Service
 * Splits large documents into semantically meaningful chunks for RAG
 */

interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string[];
}

const DEFAULT_CHUNK_SIZE = 1000; // tokens
const DEFAULT_CHUNK_OVERLAP = 200; // tokens
const DEFAULT_SEPARATORS = [
  '\n\n',
  '\n',
  '. ',
  ' ',
  ''
];

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text by separators recursively with size validation
 * Ensures all splits respect the chunk size limit
 */
function splitText(text: string, separators: string[], chunkSize: number = DEFAULT_CHUNK_SIZE): string[] {
  let finalSplits: string[] = [];
  
  // Try each separator in order
  for (let i = 0; i < separators.length; i++) {
    const separator = separators[i];
    let splits: string[] = [];

    if (separator === '') {
      // Empty separator: split into individual characters
      splits = Array.from(text);
    } else if (text.includes(separator)) {
      // Separator found: split by it
      splits = text.split(separator);
    } else {
      // Separator not found: continue to next separator
      continue;
    }

    // Check if all splits are within size limit
    let allUnderLimit = true;
    const processedSplits: string[] = [];
    
    for (const split of splits) {
      if (estimateTokens(split) < chunkSize) {
        processedSplits.push(split);
      } else {
        // This split exceeds size limit - need to split further
        allUnderLimit = false;
        
        // Recursively split with remaining separators
        if (i + 1 < separators.length) {
          const subSplits = splitText(split, separators.slice(i + 1), chunkSize);
          processedSplits.push(...subSplits);
        } else {
          // No more separators - force split by character size
          const chunkSizeChars = chunkSize * 4; // Approximate: 4 chars per token
          let offset = 0;
          while (offset < split.length) {
            const chunk = split.substring(offset, offset + chunkSizeChars);
            if (chunk.length > 0) {
              processedSplits.push(chunk);
            }
            offset += chunkSizeChars;
          }
        }
      }
    }

    // If all splits are under limit, we're done
    if (allUnderLimit && processedSplits.length > 0) {
      return processedSplits;
    }
    
    // If some splits were oversized but we processed them, return what we have
    if (!allUnderLimit && processedSplits.length > 0) {
      return processedSplits;
    }
  }

  // Fallback: return original text as single chunk
  return [text];
}

/**
 * Create chunks with overlap
 */
function createChunksWithOverlap(
  splits: string[],
  chunkSize: number,
  chunkOverlap: number,
  separator: string
): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const split of splits) {
    const splitLength = estimateTokens(split);

    if (currentLength + splitLength + estimateTokens(separator) > chunkSize) {
      if (currentChunk.length > 0) {
        const chunk = currentChunk.join(separator);
        chunks.push(chunk);

        // Keep overlap
        while (
          currentChunk.length > 0 &&
          currentLength > chunkOverlap
        ) {
          currentLength -= estimateTokens(currentChunk[0]) + estimateTokens(separator);
          currentChunk.shift();
        }
      }
    }

    currentChunk.push(split);
    currentLength += splitLength + estimateTokens(separator);
  }

  if (currentChunk.length > 0) {
    const chunk = currentChunk.join(separator);
    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Main chunking function
 */
export function chunkDocument(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap || DEFAULT_CHUNK_OVERLAP;
  const separators = options.separator || DEFAULT_SEPARATORS;

  const splits = splitText(text, separators, chunkSize);
  return createChunksWithOverlap(splits, chunkSize, chunkOverlap, separators[0]);
}

/**
 * Chunk document and return with metadata
 */
export function chunkDocumentWithMetadata(
  text: string,
  options: ChunkOptions = {}
): Array<{ content: string; tokenCount: number; index: number }> {
  const chunks = chunkDocument(text, options);

  return chunks.map((content, index) => ({
    content,
    tokenCount: estimateTokens(content),
    index
  }));
}
