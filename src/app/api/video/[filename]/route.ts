import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const decodedFilename = decodeURIComponent(filename);

    // Initialize S3 client with R2 credentials
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    // Check if video exists first with basic error handling
    let contentLength = 0;
    let etag = '';

    try {
      const headCommand = new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: `videos/${decodedFilename}`,
      });

      const headResponse = await s3Client.send(headCommand);
      contentLength = headResponse.ContentLength || 0;
      etag = headResponse.ETag || '';

      // Check for extremely large files that might cause issues
      if (contentLength > 500 * 1024 * 1024) { // 500MB limit
        console.warn(`Large video file: ${decodedFilename} (${contentLength} bytes)`);
      }

    } catch (error) {
      console.error(`Video not found: ${decodedFilename}`, error);
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const range = request.headers.get('range');

    // Determine content type based on file extension
    const ext = decodedFilename.split('.').pop()?.toLowerCase() || '';
    let contentType = 'video/mp4';

    switch (ext) {
      case 'webm':
        contentType = 'video/webm';
        break;
      case 'mov':
        contentType = 'video/quicktime';
        break;
      case 'avi':
        contentType = 'video/x-msvideo';
        break;
      case 'mkv':
        contentType = 'video/x-matroska';
        break;
      case 'flv':
        contentType = 'video/x-flv';
        break;
      case 'wmv':
        contentType = 'video/x-ms-wmv';
        break;
      default:
        contentType = 'video/mp4';
    }

    // Handle range requests for better streaming performance
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;

      // Limit chunk size to 2MB for better streaming performance
      const maxChunkSize = 2 * 1024 * 1024; // 2MB
      if (end - start > maxChunkSize) {
        end = start + maxChunkSize - 1;
      }

      // Validate range
      if (start >= contentLength || end >= contentLength || start < 0 || start > end) {
        return NextResponse.json(
          { error: 'Invalid range' },
          {
            status: 416,
            headers: {
              'Content-Range': `bytes */${contentLength}`,
              'Accept-Ranges': 'bytes'
            }
          }
        );
      }

      const chunkSize = (end - start) + 1;

      try {
        // Get partial content from R2
        const getCommand = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: `videos/${decodedFilename}`,
          Range: `bytes=${start}-${end}`,
        });

        const response = await s3Client.send(getCommand);

        if (!response.Body) {
          return NextResponse.json(
            { error: 'Video chunk not found' },
            { status: 404 }
          );
        }

        // Set headers for partial content
        const headers = new Headers();
        headers.set('Content-Type', contentType);
        headers.set('Content-Range', `bytes ${start}-${end}/${contentLength}`);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Content-Length', chunkSize.toString());
        headers.set('Cache-Control', 'public, max-age=86400'); // 24 hours cache
        headers.set('ETag', etag);

        // Add CORS headers for cross-origin requests
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Range');

        return new NextResponse(response.Body.transformToWebStream(), {
          status: 206,
          headers,
        });
      } catch (error) {
        console.error(`Error streaming video chunk for ${decodedFilename}:`, error);
        return NextResponse.json(
          { error: 'Failed to stream video chunk' },
          { status: 500 }
        );
      }
    }

    // For non-range requests, serve first 5MB to encourage range requests
    try {
      const maxInitialSize = 5 * 1024 * 1024; // 5MB initial chunk
      const actualEnd = Math.min(maxInitialSize - 1, contentLength - 1);

      const getCommand = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: `videos/${decodedFilename}`,
        Range: contentLength > maxInitialSize ? `bytes=0-${actualEnd}` : undefined,
      });

      const response = await s3Client.send(getCommand);

      if (!response.Body) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      // Set headers for content
      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=86400'); // 24 hours cache
      headers.set('ETag', etag);

      // Add CORS headers
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Range');

      if (contentLength > maxInitialSize) {
        // Partial content response to encourage range requests
        headers.set('Content-Range', `bytes 0-${actualEnd}/${contentLength}`);
        headers.set('Content-Length', (actualEnd + 1).toString());
        return new NextResponse(response.Body.transformToWebStream(), {
          status: 206,
          headers,
        });
      } else {
        // Full content for small files
        headers.set('Content-Length', contentLength.toString());
        return new NextResponse(response.Body.transformToWebStream(), {
          status: 200,
          headers,
        });
      }
    } catch (error) {
      console.error(`Error streaming video for ${decodedFilename}:`, error);
      return NextResponse.json(
        { error: 'Failed to stream video' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Unexpected error in video API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    },
  });
}
