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
  const [searchStats, setSearchStats] = useState<any>(null);
  const [searchThreshold, setSearchThreshold] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [chunksPerPage] = useState(10);

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
      setSearchStats(null);
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        documentId: documentId,
        threshold: searchThreshold.toString(),
        maxResults: '50'
      });
      
      const response = await fetch(`/api/search?${params}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const result = await response.json();
      setSearchResults(result.results);
      setSearchStats(result.searchStats);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Pagination logic
  const totalPages = data ? Math.ceil(data.allChunks.length / chunksPerPage) : 0;
  const startIndex = (currentPage - 1) * chunksPerPage;
  const endIndex = startIndex + chunksPerPage;
  const currentChunks = data ? data.allChunks.slice(startIndex, endIndex) : [];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of chunks section
    const chunksSection = document.getElementById('chunks-section');
    if (chunksSection) {
      chunksSection.scrollIntoView({ behavior: 'smooth' });
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

      {/* Smart Fuzzy Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Smart Fuzzy Search
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Handles typos, partial matches, and variations
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Search with fuzzy matching (try: 'documnt', 'parsing', 'chunking')..."
              value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearch()}
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
          
          {/* Search Controls */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <label className="text-gray-600 dark:text-gray-400">Threshold:</label>
              <input
                type="range"
                min="0"
                max="50"
                value={searchThreshold}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchThreshold(parseInt(e.target.value))}
                className="w-20"
              />
              <span className="text-gray-500 dark:text-gray-400 w-8">{searchThreshold}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Lower = more results, Higher = more precise
            </div>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Found {searchResults.length} results
                {searchStats && (
                  <span className="ml-2 text-xs text-gray-500">
                    (Threshold: {searchStats.threshold}, Strategies: {searchStats.strategiesUsed})
                  </span>
                )}
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Sorted by relevance
              </div>
            </div>
            
            {searchResults.map((result: any, index: number) => (
              <div
                key={result.id}
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      #{index + 1} • Page {result.page_no} • Chunk {result.chunk_index}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      result.matchType === 'exact' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      result.matchType === 'fuzzy' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      result.matchType === 'partial' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {result.matchType}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {result.token_count} tokens
                    </span>
                    {result.searchScore && (
                      <span className="text-xs font-mono text-gray-400">
                        Score: {Math.round(result.searchScore)}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: result.highlighted }}
                />
                {result.highlights && result.highlights.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {result.highlights.slice(0, 5).map((highlight: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Chunks with Pagination */}
      <div id="chunks-section" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Document Chunks
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {startIndex + 1}-{Math.min(endIndex, data.allChunks.length)} of {data.allChunks.length} chunks
          </div>
        </div>
        
        <div className="space-y-4">
          {currentChunks.map((chunk: any, index: number) => (
            <div
              key={chunk.id}
              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Chunk {startIndex + index + 1} • Page {chunk.page_no}
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                First
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Previous
              </button>
            </div>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

