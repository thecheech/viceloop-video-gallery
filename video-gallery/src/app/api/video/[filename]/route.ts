import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

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

    // Get object from R2
    const getCommand = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: `videos/${decodedFilename}`,
    });

    const response = await s3Client.send(getCommand);
    
    if (!response.Body) {
      return NextResponse.json(
        { error: 'Video not found in R2' },
        { status: 404 }
      );
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const fileBuffer = Buffer.concat(chunks);
    
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

    // Set appropriate headers for video streaming
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=31536000');

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error serving video from R2:', error);
    return NextResponse.json(
      { error: 'Failed to serve video from R2' },
      { status: 500 }
    );
  }
}
