import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const documentId = searchParams.get('documentId');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Build query
    let dbQuery = supabase
      .from('doc_chunks')
      .select('*')
      .textSearch('content', query, {
        type: 'websearch',
        config: 'english',
      })
      .limit(20);

    // Filter by document if provided
    if (documentId) {
      dbQuery = dbQuery.eq('document_id', documentId);
    }

    const { data: chunks, error } = await dbQuery;

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      );
    }

    // Highlight matching text (simple version)
    const highlightedChunks = chunks?.map(chunk => ({
      ...chunk,
      highlighted: highlightText(chunk.content, query),
    }));

    return NextResponse.json({
      results: highlightedChunks || [],
      count: chunks?.length || 0,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function highlightText(text: string, query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  let highlighted = text;

  words.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    highlighted = highlighted.replace(regex, match => `<mark>${match}</mark>`);
  });

  return highlighted;
}

