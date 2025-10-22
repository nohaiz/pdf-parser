/**
 * Smart Fuzzy Search Implementation
 * Provides multiple fuzzy matching algorithms and intelligent query processing
 */

export interface SearchResult {
  chunk: any;
  score: number;
  highlights: string[];
  matchType: 'exact' | 'fuzzy' | 'partial' | 'trigram';
}

export interface SearchOptions {
  threshold?: number;
  maxResults?: number;
  includePartial?: boolean;
  boostExact?: boolean;
}

/**
 * Levenshtein distance calculation for fuzzy matching
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,      // deletion
        matrix[j - 1][i] + 1,      // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score between 0 and 1
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

/**
 * Generate query variations for better matching
 */
export function generateQueryVariations(query: string): string[] {
  const variations = new Set<string>();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  // Add original query
  variations.add(query.toLowerCase());

  // Add individual words
  words.forEach(word => variations.add(word));

  // Add stemmed versions (simple stemming)
  words.forEach(word => {
    if (word.length > 3) {
      // Remove common suffixes
      const stemmed = word.replace(/(ing|ed|er|est|ly|s)$/, '');
      if (stemmed.length > 2) {
        variations.add(stemmed);
      }
    }
  });

  // Add partial words (for typos)
  words.forEach(word => {
    if (word.length > 4) {
      // Remove last character
      variations.add(word.slice(0, -1));
      // Remove second to last character
      if (word.length > 5) {
        variations.add(word.slice(0, -2) + word.slice(-1));
      }
    }
  });

  return Array.from(variations);
}

/**
 * Preprocess query for better search results
 */
export function preprocessQuery(query: string): {
  original: string;
  processed: string;
  variations: string[];
  keywords: string[];
} {
  const original = query.trim();
  const processed = original
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();

  const variations = generateQueryVariations(processed);
  const keywords = processed.split(/\s+/).filter(w => w.length > 0);

  return {
    original,
    processed,
    variations,
    keywords
  };
}

/**
 * Smart highlighting that detects fuzzy matches
 */
export function smartHighlight(text: string, query: string, variations: string[]): string {
  let highlighted = text;
  const words = text.split(/(\s+)/);

  words.forEach((word, index) => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleanWord.length === 0) return;

    let bestMatch = '';
    let bestScore = 0;

    // Check against all query variations
    variations.forEach(variation => {
      const score = calculateSimilarity(cleanWord, variation);
      if (score > bestScore && score > 0.6) { // Threshold for fuzzy matching
        bestScore = score;
        bestMatch = variation;
      }
    });

    if (bestMatch) {
      const originalWord = words[index];
      const highlightedWord = `<mark class="search-highlight" data-score="${bestScore.toFixed(2)}">${originalWord}</mark>`;
      words[index] = highlightedWord;
    }
  });

  return words.join('');
}

/**
 * Calculate comprehensive search score
 */
export function calculateSearchScore(
  content: string,
  query: string,
  variations: string[],
  options: SearchOptions = {}
): {
  score: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'trigram';
  highlights: string[];
} {
  const { boostExact = true } = options;
  const contentLower = content.toLowerCase();
  const queryLower = query.toLowerCase();

  let score = 0;
  let matchType: 'exact' | 'fuzzy' | 'partial' | 'trigram' = 'trigram';
  const highlights: string[] = [];

  // Exact match (highest priority)
  if (contentLower.includes(queryLower)) {
    score += 100;
    matchType = 'exact';
    highlights.push('exact');
  }

  // Word boundary exact matches
  const exactWordMatches = queryLower.split(/\s+/).filter(word =>
    word.length > 0 && new RegExp(`\\b${word}\\b`).test(contentLower)
  );
  if (exactWordMatches.length > 0) {
    score += exactWordMatches.length * 50;
    if (matchType !== 'exact') matchType = 'exact';
    highlights.push('exact-words');
  }

  // Fuzzy matches
  const words = contentLower.split(/\s+/);
  let fuzzyMatches = 0;

  variations.forEach(variation => {
    words.forEach(word => {
      if (word.length > 2) {
        const similarity = calculateSimilarity(word, variation);
        if (similarity > 0.7) {
          fuzzyMatches++;
          score += similarity * 30;
          if (matchType === 'trigram') matchType = 'fuzzy';
          highlights.push(`fuzzy-${similarity.toFixed(2)}`);
        }
      }
    });
  });

  // Partial matches
  variations.forEach(variation => {
    if (contentLower.includes(variation)) {
      score += 20;
      if (matchType === 'trigram') matchType = 'partial';
      highlights.push('partial');
    }
  });

  // Boost for exact matches if enabled
  if (boostExact && matchType === 'exact') {
    score *= 1.5;
  }

  // Normalize score to 0-100 range
  const normalizedScore = Math.min(100, Math.max(0, score));

  return {
    score: normalizedScore,
    matchType,
    highlights
  };
}

/**
 * Sort search results by relevance
 */
export function sortSearchResults(results: SearchResult[]): SearchResult[] {
  return results.sort((a, b) => {
    // First by match type priority
    const typePriority = { exact: 4, fuzzy: 3, partial: 2, trigram: 1 };
    const typeDiff = typePriority[b.matchType] - typePriority[a.matchType];
    if (typeDiff !== 0) return typeDiff;

    // Then by score
    return b.score - a.score;
  });
}

/**
 * Filter results by minimum score threshold
 */
export function filterSearchResults(
  results: SearchResult[],
  threshold: number = 10
): SearchResult[] {
  return results.filter(result => result.score >= threshold);
}
