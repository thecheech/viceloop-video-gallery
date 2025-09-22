import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export interface VideoFile {
  id: string;
  filename: string;
  size: number;
  sizeFormatted: string;
  extension: string;
  createdAt: Date;
  url: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';

    // Initialize S3 client with R2 credentials
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    // List all objects in the videos folder
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME!,
      Prefix: 'videos/',
      MaxKeys: 1000 // Adjust if you have more than 1000 videos
    });

    const response = await s3Client.send(listCommand);
    const objects = response.Contents || [];
    
    // Filter video files
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    const videoFiles = objects
      .filter(obj => {
        if (!obj.Key) return false;
        const fileName = obj.Key.split('/').pop() || '';
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        return videoExtensions.includes(`.${ext}`);
      })
      .map(obj => {
        const fileName = obj.Key!.split('/').pop() || '';
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        
        return {
          id: fileName,
          filename: fileName,
          size: obj.Size || 0,
          sizeFormatted: formatBytes(obj.Size || 0),
          extension: `.${ext}`,
          createdAt: obj.LastModified || new Date(),
          url: `/api/video/${encodeURIComponent(fileName)}`
        };
      })
      .filter(video => 
        search === '' || 
        video.filename.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by newest first

    // Calculate pagination
    const total = videoFiles.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVideos = videoFiles.slice(startIndex, endIndex);

    return NextResponse.json({
      videos: paginatedVideos,
      total,
      page,
      totalPages,
      limit
    });

  } catch (error) {
    console.error('Error fetching videos from R2:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos from R2' },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
