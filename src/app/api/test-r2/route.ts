import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Check if environment variables are set
    const requiredEnvVars = [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID', 
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        missing: missingVars,
        message: 'Please create a .env.local file with your R2 credentials'
      }, { status: 400 });
    }

    // If we have all env vars, proceed with upload
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    // Initialize S3 client with R2 credentials
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    // Create an empty file content
    const emptyContent = '';
    const fileName = `test-empty-${Date.now()}.txt`;

    // Upload command
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fileName,
      Body: emptyContent,
      ContentType: 'text/plain',
    });

    // Execute upload
    const result = await s3Client.send(uploadCommand);

    return NextResponse.json({
      success: true,
      message: 'Empty file uploaded successfully',
      fileName,
      etag: result.ETag,
      location: `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${fileName}`,
    });

  } catch (error) {
    console.error('R2 upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload to R2',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}