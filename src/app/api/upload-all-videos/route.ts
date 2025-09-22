import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    // Initialize S3 client with R2 credentials
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    // Path to the downloads folder
    const downloadsPath = path.join(process.cwd(), '..', 'promptchan-scrapper', 'downloads');
    
    // Check if downloads folder exists
    if (!fs.existsSync(downloadsPath)) {
      return NextResponse.json({
        success: false,
        error: 'Downloads folder not found',
        path: downloadsPath
      }, { status: 404 });
    }

    // Read all files from downloads folder
    const files = fs.readdirSync(downloadsPath);
    
    // Filter video files
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return videoExtensions.includes(ext);
    });

    console.log(`Found ${videoFiles.length} video files to upload`);

    const results = {
      total: videoFiles.length,
      uploaded: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        fileName: string;
        status: string;
        reason?: string;
        error?: string;
        etag?: string;
        size?: number;
        url?: string;
      }>
    };

    // Upload each video file
    for (let i = 0; i < videoFiles.length; i++) {
      const fileName = videoFiles[i];
      const filePath = path.join(downloadsPath, fileName);
      
      try {
        // Check if file already exists in R2
        try {
          await s3Client.send(new HeadObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: `videos/${fileName}`
          }));
          
          // File exists, skip
          results.skipped++;
          results.details.push({
            fileName,
            status: 'skipped',
            reason: 'already exists'
          });
          console.log(`Skipped ${fileName} (already exists)`);
          continue;
        } catch (error: unknown) {
          // File doesn't exist, proceed with upload
          if (error instanceof Error && error.name !== 'NotFound') {
            throw error;
          }
        }

        // Read file
        const fileBuffer = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);
        
        // Determine content type
        const ext = path.extname(fileName).toLowerCase();
        let contentType = 'video/mp4';
        
        switch (ext) {
          case '.webm':
            contentType = 'video/webm';
            break;
          case '.mov':
            contentType = 'video/quicktime';
            break;
          case '.avi':
            contentType = 'video/x-msvideo';
            break;
          case '.mkv':
            contentType = 'video/x-matroska';
            break;
          case '.flv':
            contentType = 'video/x-flv';
            break;
          case '.wmv':
            contentType = 'video/x-ms-wmv';
            break;
        }

        // Upload to R2
        const uploadCommand = new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: `videos/${fileName}`,
          Body: fileBuffer,
          ContentType: contentType,
          Metadata: {
            'original-filename': fileName,
            'upload-timestamp': new Date().toISOString(),
            'file-size': stats.size.toString()
          }
        });

        const result = await s3Client.send(uploadCommand);
        
        results.uploaded++;
        results.details.push({
          fileName,
          status: 'uploaded',
          etag: result.ETag,
          size: stats.size,
          url: `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/videos/${fileName}`
        });
        
        console.log(`Uploaded ${fileName} (${i + 1}/${videoFiles.length})`);
        
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        results.errors++;
        results.details.push({
          fileName,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`Error uploading ${fileName}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Upload process completed. ${results.uploaded} uploaded, ${results.skipped} skipped, ${results.errors} errors`,
      results
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload videos to R2',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
