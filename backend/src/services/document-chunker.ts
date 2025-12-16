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
 * Split text by separators recursively
 */
function splitText(text: string, separators: string[]): string[] {
  const goodSplits: string[] = [];
  let separatorIndex = 0;

  while (separatorIndex < separators.length) {
    const separator = separators[separatorIndex];
    let splits: string[] = [];

    if (separator === '') {
      splits = Array.from(text);
      separatorIndex += 1;
    } else {
      if (text.includes(separator)) {
        splits = text.split(separator);
        separatorIndex += 1;
      } else {
        separatorIndex += 1;
        continue;
      }
    }

    // Merge small splits
    const goodSplits2: string[] = [];
    for (const s of splits) {
      if (estimateTokens(s) < DEFAULT_CHUNK_SIZE) {
        goodSplits2.push(s);
      } else {
        if (goodSplits2.length > 0) {
          const mergedText = goodSplits2.join(separator);
          goodSplits.push(mergedText);
          goodSplits2.length = 0;
        }
        goodSplits.push(s);
      }
    }

    if (goodSplits2.length > 0) {
      const mergedText = goodSplits2.join(separator);
      goodSplits.push(mergedText);
    }

    return goodSplits;
  }

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

  const splits = splitText(text, separators);
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
