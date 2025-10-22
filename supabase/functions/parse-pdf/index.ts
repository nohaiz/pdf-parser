import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Types
interface ParseRequest {
  document_id: string;
}

interface Chunk {
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

// Token counting (simple approximation)
function countTokens(text: string): number {
  if (!text) return 0;
  // Simple approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

// Create hash of content
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Split into sentences
function splitIntoSentences(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

// Chunk text with overlap
async function chunkText(
  text: string,
  pageNo: number,
  minTokens = 600,
  maxTokens = 1200,
  overlapPercentage = 12.5
): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
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
    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      const chunkContent = currentChunk.join(' ');
      const tokenCount = countTokens(chunkContent);
      const contentHash = await hashContent(chunkContent);

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
        content_hash: contentHash,
      });

      // Create overlap
      const overlapTokenTarget = Math.floor(tokenCount * (overlapPercentage / 100));
      const overlapSentences: string[] = [];
      let overlapTokens = 0;

      for (let j = currentChunk.length - 1; j >= 0 && overlapTokens < overlapTokenTarget; j--) {
        const overlapSentence = currentChunk[j];
        overlapSentences.unshift(overlapSentence);
        overlapTokens += countTokens(overlapSentence);
      }

      currentChunk = overlapSentences;
      currentTokens = overlapTokens;
      chunkIndex++;
    }

    currentChunk.push(sentence);
    currentTokens += sentenceTokens;

    // Last sentence
    if (i === sentences.length - 1 && currentChunk.length > 0) {
      const chunkContent = currentChunk.join(' ');
      const tokenCount = countTokens(chunkContent);
      const contentHash = await hashContent(chunkContent);

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
        content_hash: contentHash,
      });
    }
  }

  return chunks;
}

// Parse PDF using pdf-parse (npm package compatible with Deno)
async function parsePDF(pdfBuffer: ArrayBuffer): Promise<{ pages: Array<{ pageNo: number; text: string }>; pageCount: number }> {
  try {
    // Import pdf-parse from npm (Deno supports npm: imports)
    // @ts-ignore - Deno npm import
    const pdfParse = (await import('npm:pdf-parse@1.1.1')).default;

    // Convert ArrayBuffer to Buffer
    const buffer = new Uint8Array(pdfBuffer);

    // Parse PDF
    const data = await pdfParse(buffer);

    const pageCount = data.numpages;
    const fullText = data.text;

    // Split text by page (pdf-parse doesn't give us per-page text easily)
    // We'll estimate by splitting the text into equal chunks
    // This is a limitation of pdf-parse, but works for most PDFs
    const pages: Array<{ pageNo: number; text: string }> = [];

    if (!fullText || fullText.trim().length === 0) {
      console.log('PDF appears to be empty or image-only');
      // Return empty pages
      for (let i = 1; i <= pageCount; i++) {
        pages.push({
          pageNo: i,
          text: '[Empty or image-only page - OCR not implemented]',
        });
      }
      return { pages, pageCount };
    }

    // Simple approach: split by form feed characters or page markers
    // Many PDFs use \f (form feed) to separate pages
    const pageTexts = fullText.split('\f').filter(t => t.trim().length > 0);

    // If we don't have page separators, split text roughly by page count
    if (pageTexts.length < pageCount) {
      const textPerPage = Math.ceil(fullText.length / pageCount);
      for (let i = 0; i < pageCount; i++) {
        const start = i * textPerPage;
        const end = Math.min(start + textPerPage, fullText.length);
        const pageText = fullText.substring(start, end).trim();

        pages.push({
          pageNo: i + 1,
          text: pageText || '[Empty page]',
        });
      }
    } else {
      // Use the split pages
      for (let i = 0; i < Math.min(pageTexts.length, pageCount); i++) {
        pages.push({
          pageNo: i + 1,
          text: pageTexts[i].trim() || '[Empty page]',
        });
      }
    }

    // If we have fewer pages than expected, fill in the rest
    while (pages.length < pageCount) {
      pages.push({
        pageNo: pages.length + 1,
        text: '[Empty page]',
      });
    }

    return { pages: pages.slice(0, pageCount), pageCount };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

serve(async (req) => {
  const startTime = Date.now();

  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    // Parse request
    const { document_id }: ParseRequest = await req.json();

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'document_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${document_id}] Starting PDF parsing...`);

    // Initialize Supabase client
    // These are automatically available in Supabase Edge Functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !document) {
      console.error(`[${document_id}] Document not found:`, docError);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${document_id}] Downloading PDF from storage: ${document.storage_key}`);

    // Download PDF from storage
    const { data: pdfData, error: downloadError } = await supabase
      .storage
      .from(Deno.env.get('STORAGE_BUCKET') || 'pdf-documents')
      .download(document.storage_key);

    if (downloadError || !pdfData) {
      console.error(`[${document_id}] Download failed:`, downloadError);
      await supabase
        .from('documents')
        .update({
          status: 'error',
          error_msg: `Failed to download PDF: ${downloadError?.message}`
        })
        .eq('id', document_id);

      return new Response(
        JSON.stringify({ error: 'Failed to download PDF' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert blob to ArrayBuffer
    const pdfBuffer = await pdfData.arrayBuffer();
    console.log(`[${document_id}] PDF downloaded, size: ${pdfBuffer.byteLength} bytes`);

    // Parse PDF
    console.log(`[${document_id}] Parsing PDF...`);
    const { pages, pageCount } = await parsePDF(pdfBuffer);
    console.log(`[${document_id}] Parsed ${pageCount} pages`);

    // Chunk all pages
    console.log(`[${document_id}] Chunking text...`);
    const allChunks: Chunk[] = [];
    let globalChunkIndex = 0;

    for (const page of pages) {
      const pageChunks = await chunkText(page.text, page.pageNo);

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

    console.log(`[${document_id}] Created ${allChunks.length} chunks`);

    // Delete existing chunks for idempotency (clear + rewrite approach)
    const { error: deleteError } = await supabase
      .from('doc_chunks')
      .delete()
      .eq('document_id', document_id);

    if (deleteError) {
      console.warn(`[${document_id}] Failed to delete old chunks:`, deleteError);
    }

    // Insert chunks in batches (Supabase has a limit)
    const BATCH_SIZE = 100;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const chunksToInsert = batch.map(chunk => ({
        document_id,
        chunk_index: chunk.chunk_index,
        page_no: chunk.page_no,
        content: chunk.content,
        token_count: chunk.token_count,
        meta: chunk.meta,
        content_hash: chunk.content_hash,
      }));

      const { error: insertError } = await supabase
        .from('doc_chunks')
        .insert(chunksToInsert);

      if (insertError) {
        console.error(`[${document_id}] Failed to insert chunks batch ${i}:`, insertError);
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }
    }

    console.log(`[${document_id}] Inserted all chunks`);

    // Calculate statistics
    const avgTokens = allChunks.length > 0
      ? Math.round(allChunks.reduce((sum, c) => sum + c.token_count, 0) / allChunks.length)
      : 0;

    // Update document status
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'ready',
        page_count: pageCount,
        error_msg: null,
      })
      .eq('id', document_id);

    if (updateError) {
      console.error(`[${document_id}] Failed to update document:`, updateError);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[${document_id}] Completed in ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id,
        stats: {
          total_pages: pageCount,
          total_chunks: allChunks.length,
          avg_tokens_per_chunk: avgTokens,
          parse_time_ms: totalTime,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (error) {
    console.error('Parse error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
});

