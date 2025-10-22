export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'error';

export interface Document {
  id: string;
  user_id: string;
  storage_key: string;
  page_count: number | null;
  status: DocumentStatus;
  error_msg: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  page_no: number;
  content: string;
  token_count: number;
  meta: Record<string, any>;
  content_hash: string;
  created_at: string;
}

export interface ChunkMetadata {
  page_no: number;
  chunk_index: number;
  position: 'start' | 'middle' | 'end';
  has_overlap: boolean;
}

export interface ParseResult {
  chunks: Array<{
    content: string;
    token_count: number;
    page_no: number;
    chunk_index: number;
    meta: ChunkMetadata;
    content_hash: string;
  }>;
  total_pages: number;
  total_chunks: number;
  avg_tokens_per_chunk: number;
}

