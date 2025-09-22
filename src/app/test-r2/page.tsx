'use client';

import { useState } from 'react';

export default function TestR2Page() {
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    fileName?: string;
    etag?: string;
    location?: string;
    error?: string;
    details?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const testR2Upload = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-r2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: 'Network error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">R2 Upload Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test R2 Credentials</h2>
          <p className="text-gray-600 mb-4">
            This will upload an empty file to your R2 bucket to test the credentials.
          </p>
          
          <button
            onClick={testR2Upload}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Testing...' : 'Test R2 Upload'}
          </button>
        </div>

        {result && (
          <div className={`bg-white rounded-lg shadow p-6 ${
            result.success ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
          }`}>
            <h3 className={`text-lg font-semibold mb-2 ${
              result.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {result.success ? '✅ Success!' : '❌ Error'}
            </h3>
            
            <div className="space-y-2">
              {result.message && (
                <p className="text-gray-700">{result.message}</p>
              )}
              
              {result.fileName && (
                <p className="text-sm text-gray-600">
                  <strong>File:</strong> {result.fileName}
                </p>
              )}
              
              {result.etag && (
                <p className="text-sm text-gray-600">
                  <strong>ETag:</strong> {result.etag}
                </p>
              )}
              
              {result.location && (
                <p className="text-sm text-gray-600">
                  <strong>URL:</strong>{' '}
                  <a 
                    href={result.location} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {result.location}
                  </a>
                </p>
              )}
              
              {result.error && (
                <p className="text-red-600">
                  <strong>Error:</strong> {result.error}
                </p>
              )}
              
              {result.details && (
                <p className="text-sm text-gray-600">
                  <strong>Details:</strong> {result.details}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">Required Environment Variables:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• R2_ACCOUNT_ID</li>
            <li>• R2_ACCESS_KEY_ID</li>
            <li>• R2_SECRET_ACCESS_KEY</li>
            <li>• R2_BUCKET_NAME</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
