'use client';

import { useState } from 'react';
import UploadForm from '@/components/UploadForm';
import DocumentStatus from '@/components/DocumentStatus';
import ChunkDisplay from '@/components/ChunkDisplay';

export default function Home() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleUploadComplete = (id: string) => {
    setDocumentId(id);
    setIsProcessing(true);
  };

  const handleProcessingComplete = () => {
    setIsProcessing(false);
    setIsComplete(true);
  };

  const handleReset = () => {
    setDocumentId(null);
    setIsProcessing(false);
    setIsComplete(false);
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            PDF Parser
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Upload large PDFs and parse them with intelligent text chunking
          </p>
        </div>

        <div className="space-y-8">
          {!documentId && <UploadForm onUploadComplete={handleUploadComplete} />}

          {documentId && isProcessing && (
            <DocumentStatus
              documentId={documentId}
              onComplete={handleProcessingComplete}
            />
          )}

          {documentId && isComplete && (
            <>
              <ChunkDisplay documentId={documentId} />
              <div className="text-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Upload Another Document
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

