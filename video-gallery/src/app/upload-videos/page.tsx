'use client';

import { useState } from 'react';

export default function UploadVideosPage() {
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    results?: {
      total: number;
      uploaded: number;
      skipped: number;
      errors: number;
      details: Array<{
        fileName: string;
        status: string;
        reason?: string;
        error?: string;
        etag?: string;
        size?: number;
        url?: string;
      }>;
    };
    error?: string;
    details?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const uploadAllVideos = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/upload-all-videos', {
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Upload All Videos to R2</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Bulk Upload to R2</h2>
          <p className="text-gray-600 mb-4">
            This will upload all videos from the local downloads folder to your R2 bucket.
            Videos will be stored in the &apos;videos/&apos; prefix and the app will be configured to read from R2.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notes:</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• This process may take several minutes for 331 videos</li>
              <li>• Videos already in R2 will be skipped</li>
              <li>• The app will automatically switch to reading from R2 after upload</li>
              <li>• Make sure you have sufficient R2 storage quota</li>
            </ul>
          </div>
          
          <button
            onClick={uploadAllVideos}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? 'Uploading Videos...' : 'Start Bulk Upload'}
          </button>
        </div>

        {result && (
          <div className={`bg-white rounded-lg shadow p-6 ${
            result.success ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              result.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {result.success ? '✅ Upload Complete!' : '❌ Upload Failed'}
            </h3>
            
            {result.success && result.results && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{result.results.uploaded}</div>
                    <div className="text-sm text-green-700">Uploaded</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{result.results.skipped}</div>
                    <div className="text-sm text-blue-700">Skipped</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{result.results.errors}</div>
                    <div className="text-sm text-red-700">Errors</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{result.results.total}</div>
                    <div className="text-sm text-gray-700">Total</div>
                  </div>
                </div>
                
                {result.results.errors > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                    <div className="max-h-40 overflow-y-auto bg-red-50 p-3 rounded-lg">
                      {result.results.details
                        .filter((detail) => detail.status === 'error')
                        .map((detail, index: number) => (
                          <div key={index} className="text-sm text-red-700 mb-1">
                            <strong>{detail.fileName}:</strong> {detail.error}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {result.message && (
              <p className="text-gray-700 mt-4">{result.message}</p>
            )}
            
            {result.error && (
              <p className="text-red-600 mt-4">
                <strong>Error:</strong> {result.error}
              </p>
            )}
            
            {result.details && (
              <p className="text-sm text-gray-600 mt-2">
                <strong>Details:</strong> {result.details}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">Next Steps:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• After upload, visit the main gallery to see videos from R2</li>
            <li>• Videos will be served directly from Cloudflare R2</li>
            <li>• You can now remove local video files to save disk space</li>
            <li>• The app will automatically use R2 for all video operations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
