const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');

// Load environment variables from .env.local
require('dotenv').config({ path: '../.env.local' });

const execAsync = promisify(exec);

// Configuration
const API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-kontext-dev';
const API_KEY = process.env.WAVESPEED_API_KEY;

const downloadsDir = './downloads';
const frameDir = './downloads/frame';
const profileDir = './downloads/profile';

// Ensure directories exist
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir, { recursive: true });
if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

// Video file extensions to process
const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'];

async function getVideoDuration(videoPath) {
  try {
    const { stdout } = await execAsync(`ffmpeg -i "${videoPath}" 2>&1 | grep Duration | cut -d ' ' -f 4 | sed s/,//`);
    const durationStr = stdout.trim();
    const timeParts = durationStr.split(':');
    if (timeParts.length === 3) {
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      const seconds = parseFloat(timeParts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return null;
  } catch (error) {
    console.error(`Error getting duration for ${videoPath}:`, error.message);
    return null;
  }
}

async function extractMiddleFrame(videoPath, outputPath) {
  try {
    const duration = await getVideoDuration(videoPath);
    if (!duration) {
      console.error(`Could not get duration for ${videoPath}`);
      return false;
    }

    const middleTime = duration / 2;
    const command = `ffmpeg -i "${videoPath}" -ss ${middleTime} -vframes 1 -q:v 2 "${outputPath}"`;
    
    await execAsync(command);
    console.log(`✅ Extracted frame: ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    console.error(`Error extracting frame from ${videoPath}:`, error.message);
    return false;
  }
}

async function submitJob(imagePath) {
  return new Promise((resolve, reject) => {
    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const requestData = JSON.stringify({
      enable_base64_output: false,
      enable_sync_mode: false,
      guidance_scale: 2.5,
      image: dataUrl,
      num_images: 1,
      num_inference_steps: 28,
      output_format: "jpeg",
      prompt: "Professional head and shoulders portrait of an attractive model, soft lighting, high quality, Instagram profile picture style, elegant pose, natural beauty, OnlyFans model aesthetic, clean background, professional photography",
      seed: -1,
      size: "512*512"
    });

    const options = {
      hostname: 'api.wavespeed.ai',
      path: '/api/v3/wavespeed-ai/flux-kontext-dev',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === 200 && result.data && result.data.id) {
            resolve(result.data.id);
          } else {
            reject(new Error('Failed to submit job: ' + data));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

async function pollForResult(jobId) {
  return new Promise((resolve, reject) => {
    const poll = () => {
      const options = {
        hostname: 'api.wavespeed.ai',
        path: `/api/v3/predictions/${jobId}/result`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            const status = result.data?.status || 'unknown';
            
            if (status === 'completed' && result.data?.outputs && result.data.outputs.length > 0) {
              resolve(result.data.outputs[0]);
            } else if (status === 'failed') {
              reject(new Error('Job failed: ' + (result.data?.error || 'Unknown error')));
            } else {
              // Still processing, wait and poll again
              setTimeout(poll, 5000); // Wait 5 seconds before polling again
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    };
    
    poll();
  });
}

async function downloadImage(imageUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(imageUrl, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function processImageWithWavespeed(imagePath, outputPath) {
  try {
    console.log(`  📤 Submitting to Wavespeed AI...`);
    const jobId = await submitJob(imagePath);
    console.log(`  ⏳ Job submitted: ${jobId}`);
    
    console.log(`  🔄 Waiting for completion...`);
    const imageUrl = await pollForResult(jobId);
    
    console.log(`  📥 Downloading result...`);
    await downloadImage(imageUrl, outputPath);
    
    return true;
  } catch (error) {
    throw error;
  }
}

async function processVideo(videoFile, index, total) {
  const videoPath = path.join(downloadsDir, videoFile);
  const baseName = path.parse(videoFile).name;
  const frameFileName = `${baseName}_frame.jpg`;
  const profileFileName = `${baseName}_profile.jpg`;
  
  const framePath = path.join(frameDir, frameFileName);
  const profilePath = path.join(profileDir, profileFileName);

  console.log(`\n[${index}/${total}] 🎬 Processing: ${videoFile}`);

  // Step 1: Extract frame (if not exists)
  if (fs.existsSync(framePath)) {
    console.log(`  ⏭️  Frame already exists: ${frameFileName}`);
  } else {
    console.log(`  🖼️  Extracting middle frame...`);
    const frameSuccess = await extractMiddleFrame(videoPath, framePath);
    if (!frameSuccess) {
      console.error(`  ❌ Failed to extract frame from ${videoFile}`);
      return false;
    }
  }

  // Step 2: Generate profile picture (if not exists)
  if (fs.existsSync(profilePath)) {
    console.log(`  ⏭️  Profile already exists: ${profileFileName}`);
  } else {
    console.log(`  🎨 Generating profile picture...`);
    try {
      await processImageWithWavespeed(framePath, profilePath);
      console.log(`  ✅ Generated profile: ${profileFileName}`);
    } catch (error) {
      console.error(`  ❌ Failed to generate profile: ${error.message}`);
      return false;
    }
  }

  return true;
}

async function processAllVideos() {
  if (!API_KEY) {
    console.error('❌ WAVESPEED_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Get all video files in downloads directory
  const files = fs.readdirSync(downloadsDir);
  const videoFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return videoExtensions.includes(ext);
  });

  if (videoFiles.length === 0) {
    console.log('📁 No video files found in downloads directory');
    return;
  }

  console.log('🚀 Starting video processing pipeline...');
  console.log(`📁 Found ${videoFiles.length} video files to process`);
  console.log(`📂 Frames will be saved to: ${frameDir}`);
  console.log(`📂 Profiles will be saved to: ${profileDir}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < videoFiles.length; i++) {
    const videoFile = videoFiles[i];
    
    try {
      const success = await processVideo(videoFile, i + 1, videoFiles.length);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Add delay between videos to avoid rate limiting
      if (i < videoFiles.length - 1) {
        console.log('⏸️  Waiting 3 seconds before next video...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`❌ Error processing ${videoFile}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Pipeline Summary:`);
  console.log(`✅ Successfully processed: ${successCount} videos`);
  console.log(`❌ Failed: ${errorCount} videos`);
  console.log(`📁 Frames directory: ${frameDir}`);
  console.log(`📁 Profiles directory: ${profileDir}`);
}

// Check if ffmpeg is available
execAsync('ffmpeg -version')
  .then(() => {
    console.log('✅ FFmpeg is available');
    processAllVideos();
  })
  .catch(() => {
    console.error('❌ FFmpeg is not installed or not in PATH');
    console.log('Please install FFmpeg to extract video frames');
    process.exit(1);
  });
