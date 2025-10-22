import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  preprocessQuery,
  smartHighlight,
  calculateSearchScore,
  sortSearchResults,
  filterSearchResults,
  type SearchResult,
  type SearchOptions
} from '@/lib/fuzzySearch';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const documentId = searchParams.get('documentId');
    const threshold = parseFloat(searchParams.get('threshold') || '10');
    const maxResults = parseInt(searchParams.get('maxResults') || '50');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Preprocess query for fuzzy matching
    const { processed, variations, keywords } = preprocessQuery(query);

    // Build multiple search strategies
    const searchStrategies = [];

    // 1. Trigram similarity search (PostgreSQL native)
    const trigramQuery = supabase
      .from('doc_chunks')
      .select('*')
      .textSearch('content', processed, {
        type: 'websearch',
        config: 'english',
      });

    if (documentId) {
      trigramQuery.eq('document_id', documentId);
    }

    searchStrategies.push(trigramQuery);

    // 2. ILIKE search for partial matches
    const ilikeQuery = supabase
      .from('doc_chunks')
      .select('*')
      .ilike('content', `%${processed}%`);

    if (documentId) {
      ilikeQuery.eq('document_id', documentId);
    }

    searchStrategies.push(ilikeQuery);

    // 3. Individual keyword searches
    keywords.forEach(keyword => {
      if (keyword.length > 2) {
        const keywordQuery = supabase
          .from('doc_chunks')
          .select('*')
          .ilike('content', `%${keyword}%`);

        if (documentId) {
          keywordQuery.eq('document_id', documentId);
        }

        searchStrategies.push(keywordQuery);
      }
    });

    // Execute all search strategies
    const searchPromises = searchStrategies.map(strategy => strategy.limit(maxResults));
    const searchResults = await Promise.allSettled(searchPromises);

    // Combine and deduplicate results
    const allChunks = new Map();

    searchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.data) {
        result.value.data.forEach((chunk: any) => {
          if (!allChunks.has(chunk.id)) {
            allChunks.set(chunk.id, chunk);
          }
        });
      }
    });

    const chunks = Array.from(allChunks.values());

    if (chunks.length === 0) {
      return NextResponse.json({
        results: [],
        count: 0,
        query: {
          original: query,
          processed,
          variations,
          keywords
        }
      });
    }

    // Calculate fuzzy scores and create search results
    const searchResultsWithScores: SearchResult[] = chunks.map(chunk => {
      const { score, matchType, highlights } = calculateSearchScore(
        chunk.content,
        processed,
        variations,
        { boostExact: true }
      );

      return {
        chunk,
        score,
        highlights,
        matchType
      };
    });

    // Sort by relevance and filter by threshold
    const sortedResults = sortSearchResults(searchResultsWithScores);
    const filteredResults = filterSearchResults(sortedResults, threshold);

    // Apply smart highlighting
    const highlightedResults = filteredResults.map(result => ({
      ...result.chunk,
      highlighted: smartHighlight(result.chunk.content, processed, variations),
      searchScore: result.score,
      matchType: result.matchType,
      highlights: result.highlights
    }));

    return NextResponse.json({
      results: highlightedResults,
      count: highlightedResults.length,
      totalFound: chunks.length,
      query: {
        original: query,
        processed,
        variations,
        keywords
      },
      searchStats: {
        threshold,
        maxResults,
        strategiesUsed: searchStrategies.length
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


