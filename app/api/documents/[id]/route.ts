import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    const supabase = createServerClient();

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get chunks for this document
    const { data: chunks, error: chunksError } = await supabase
      .from('doc_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (chunksError) {
      console.error('Error fetching chunks:', chunksError);
    }

    // Calculate statistics
    const totalChunks = chunks?.length || 0;
    const avgTokens = totalChunks > 0
      ? Math.round(chunks!.reduce((sum, c) => sum + c.token_count, 0) / totalChunks)
      : 0;

    // Get sample chunks (first 3)
    const sampleChunks = chunks?.slice(0, 3) || [];

    return NextResponse.json({
      document,
      stats: {
        totalPages: document.page_count,
        totalChunks,
        avgTokensPerChunk: avgTokens,
      },
      sampleChunks,
      allChunks: chunks || [],
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

