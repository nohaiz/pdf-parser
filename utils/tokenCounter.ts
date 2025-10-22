/**
 * Token counter utility
 * Uses a simple approximation: ~4 characters per token (GPT standard approximation)
 * For production, you would use tiktoken library, but it requires Node.js native modules
 * which can be complex in Edge Functions
 */

const CHARS_PER_TOKEN = 4;

/**
 * Estimates token count for a given text
 * This is a simple approximation. For accurate counts, use tiktoken with cl100k_base encoding
 */
export function countTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Simple approximation: 1 token ≈ 4 characters
  // This is close enough for chunking purposes
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * More accurate token estimation that considers word boundaries
 */
export function countTokensAccurate(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Split by whitespace to count words
  const words = text.trim().split(/\s+/);

  // Average: 1 token ≈ 0.75 words (or 1.33 words per token)
  // This is more accurate for English text
  return Math.ceil(words.length / 0.75);
}

