'use client';

import { useEffect, useState } from 'react';
import type { DocChunk } from '@/lib/types';

interface ChunkDisplayProps {
  documentId: string;
}

interface DocumentData {
  document: any;
  stats: {
    totalPages: number;
    totalChunks: number;
    avgTokensPerChunk: number;
  };
  sampleChunks: DocChunk[];
  allChunks: DocChunk[];
}

export default function ChunkDisplay({ documentId }: ChunkDisplayProps) {
  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchDocumentData();
  }, [documentId]);

  const fetchDocumentData = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching document:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&documentId=${documentId}`
      );
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const result = await response.json();
      setSearchResults(result.results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading document data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Failed to load document data</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Document Statistics
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Pages</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {data.stats.totalPages || 0}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Chunks</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {data.stats.totalChunks}
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Tokens/Chunk</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {data.stats.avgTokensPerChunk}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Search Chunks
        </h2>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Search through document chunks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Found {searchResults.length} results
            </p>
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Page {result.page_no} • Chunk {result.chunk_index}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {result.token_count} tokens
                  </span>
                </div>
                <p
                  className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: result.highlighted }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sample Chunks */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Sample Chunks (First 3)
        </h2>
        <div className="space-y-4">
          {data.sampleChunks.map((chunk, index) => (
            <div
              key={chunk.id}
              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Chunk {index + 1} • Page {chunk.page_no}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  {chunk.token_count} tokens
                </span>
              </div>
              <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                {chunk.content.substring(0, 500)}
                {chunk.content.length > 500 && '...'}
              </p>
              <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
                <span>Position: {chunk.meta.position}</span>
                <span>Overlap: {chunk.meta.has_overlap ? 'Yes' : 'No'}</span>
                <span>Hash: {chunk.content_hash.substring(0, 8)}...</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

