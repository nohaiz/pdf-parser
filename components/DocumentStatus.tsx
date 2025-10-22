'use client';

import { useEffect, useState } from 'react';
import type { DocumentStatus as Status } from '@/lib/types';

interface DocumentStatusProps {
  documentId: string;
  onComplete: () => void;
}

export default function DocumentStatus({ documentId, onComplete }: DocumentStatusProps) {
  const [status, setStatus] = useState<Status>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document status');
        }

        const data = await response.json();
        setStatus(data.document.status);
        setError(data.document.error_msg);

        if (data.document.status === 'ready') {
          onComplete();
        } else if (data.document.status === 'error') {
          // Stop polling on error
          return;
        }
      } catch (err: any) {
        console.error('Status polling error:', err);
        setError(err.message);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000);
    pollStatus(); // Initial call

    return () => clearInterval(interval);
  }, [documentId, onComplete]);

  const getStatusColor = () => {
    switch (status) {
      case 'uploaded':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'ready':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploaded':
        return '📤';
      case 'processing':
        return '⚙️';
      case 'ready':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📄';
    }
  };

  if (status === 'processing') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl p-8 border border-blue-200 dark:border-gray-700">
          {/* Animated Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-4 relative">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="absolute inset-0 bg-blue-600 rounded-full animate-ping opacity-75"></div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Processing Your PDF
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Parsing pages and creating intelligent text chunks...
            </p>
          </div>

          {/* Animated Processing Steps */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">PDF Uploaded</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">File saved to secure storage</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border-2 border-blue-500">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center animate-spin">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Extracting Text</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reading all pages from PDF...</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm opacity-50">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16m-7 5h7" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Creating Chunks</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Splitting into optimized segments</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm opacity-50">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Saving to Database</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Storing processed chunks</p>
              </div>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="relative">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span className="font-medium">Processing...</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">Please wait</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
              <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-3 rounded-full animate-pulse relative overflow-hidden" style={{ width: '65%' }}>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
              </div>
            </div>
          </div>

          {/* Helpful Tip */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-gray-700">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Did you know?</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  We&apos;re creating 600-1200 token chunks with smart overlap to preserve context for AI applications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-3xl">{getStatusIcon()}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Document Status
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

