import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client with R2 credentials
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename: rawFilename } = await params;
    const filename = decodeURIComponent(rawFilename);
    
    // Get the image from R2
    const getObjectCommand = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: `profiles/${filename}`,
    });
    
    const response = await s3Client.send(getObjectCommand);
    
    if (!response.Body) {
      return new NextResponse('Profile image not found', { status: 404 });
    }
    
    // Convert the stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const fileBuffer = Buffer.concat(chunks);
    
    // Determine content type based on file extension or S3 metadata
    const ext = filename.toLowerCase().split('.').pop();
    let contentType = response.ContentType || 'image/jpeg'; // Use S3 metadata or default to JPEG
    
    if (ext === 'png') {
      contentType = 'image/png';
    } else if (ext === 'gif') {
      contentType = 'image/gif';
    } else if (ext === 'webp') {
      contentType = 'image/webp';
    } else if (ext === 'jpg' || ext === 'jpeg') {
      contentType = 'image/jpeg';
    }
    
    // Return the image with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
    
  } catch (error: unknown) {
    console.error('Error serving profile image from R2:', error);
    
    // If it's a 404 from S3, return 404
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchKey') {
      return new NextResponse('Profile image not found', { status: 404 });
    }
    
    if (error && typeof error === 'object' && '$metadata' in error && 
        error.$metadata && typeof error.$metadata === 'object' && 
        'httpStatusCode' in error.$metadata && error.$metadata.httpStatusCode === 404) {
      return new NextResponse('Profile image not found', { status: 404 });
    }
    
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
