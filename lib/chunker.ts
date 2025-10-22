import { countTokens } from '@/utils/tokenCounter';
import { createHash } from 'crypto';

export interface ChunkOptions {
  minTokens?: number;
  maxTokens?: number;
  overlapPercentage?: number;
}

export interface Chunk {
  content: string;
  token_count: number;
  page_no: number;
  chunk_index: number;
  meta: {
    page_no: number;
    chunk_index: number;
    position: 'start' | 'middle' | 'end';
    has_overlap: boolean;
  };
  content_hash: string;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  minTokens: 600,
  maxTokens: 1200,
  overlapPercentage: 12.5, // 12.5% = ~100 tokens for 800-token chunks
};

/**
 * Splits text into sentences, attempting to preserve context
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries while preserving the delimiter
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Creates a hash of the content for idempotency
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Intelligently chunks text based on token count with overlap
 */
export function chunkText(
  text: string,
  pageNo: number,
  options: ChunkOptions = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];

  // Split into sentences for better boundary awareness
  const sentences = splitIntoSentences(text);

  if (sentences.length === 0) {
    return chunks;
  }

  let currentChunk: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = countTokens(sentence);

    // If adding this sentence would exceed max tokens, save current chunk
    if (currentTokens + sentenceTokens > opts.maxTokens && currentChunk.length > 0) {
      const chunkContent = currentChunk.join(' ');
      const tokenCount = countTokens(chunkContent);

      chunks.push({
        content: chunkContent,
        token_count: tokenCount,
        page_no: pageNo,
        chunk_index: chunkIndex,
        meta: {
          page_no: pageNo,
          chunk_index: chunkIndex,
          position: chunkIndex === 0 ? 'start' : 'middle',
          has_overlap: chunkIndex > 0,
        },
        content_hash: hashContent(chunkContent),
      });

      // Create overlap: keep last portion of sentences based on overlap percentage
      const overlapTokenTarget = Math.floor(tokenCount * (opts.overlapPercentage / 100));
      const overlapSentences: string[] = [];
      let overlapTokens = 0;

      // Work backwards from the end to get overlap
      for (let j = currentChunk.length - 1; j >= 0 && overlapTokens < overlapTokenTarget; j--) {
        const overlapSentence = currentChunk[j];
        overlapSentences.unshift(overlapSentence);
        overlapTokens += countTokens(overlapSentence);
      }

      currentChunk = overlapSentences;
      currentTokens = overlapTokens;
      chunkIndex++;
    }

    // Add current sentence to chunk
    currentChunk.push(sentence);
    currentTokens += sentenceTokens;

    // If we've hit minimum tokens and this is the last sentence, save the chunk
    if (i === sentences.length - 1 && currentChunk.length > 0) {
      const chunkContent = currentChunk.join(' ');
      const tokenCount = countTokens(chunkContent);

      chunks.push({
        content: chunkContent,
        token_count: tokenCount,
        page_no: pageNo,
        chunk_index: chunkIndex,
        meta: {
          page_no: pageNo,
          chunk_index: chunkIndex,
          position: 'end',
          has_overlap: chunkIndex > 0,
        },
        content_hash: hashContent(chunkContent),
      });
    }
  }

  return chunks;
}

/**
 * Processes multiple pages and returns all chunks with continuous indexing
 */
export function chunkPages(
  pages: Array<{ pageNo: number; text: string }>,
  options: ChunkOptions = {}
): Chunk[] {
  const allChunks: Chunk[] = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    const pageChunks = chunkText(page.text, page.pageNo, options);

    // Update chunk indices to be global
    for (const chunk of pageChunks) {
      allChunks.push({
        ...chunk,
        chunk_index: globalChunkIndex,
        meta: {
          ...chunk.meta,
          chunk_index: globalChunkIndex,
        },
      });
      globalChunkIndex++;
    }
  }

  return allChunks;
}

