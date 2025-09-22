import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// Array of model names for fallback generation
const modelNames = [
  'LunaRoseX', 'SophiaMartinez', 'ChloeDubois', 'IsabellaRodriguez', 'EmmaThompson',
  'AmelieLaurent', 'ValentinaCruz', 'BellaSinclair', 'CamilaSantos', 'AriaJohnson',
  'LeaMoreau', 'MayaPatel', 'ScarlettWilde', 'NinaBlack', 'ElenaVasquez',
  'RavenStorm', 'JadeSummers', 'ZoeWilliams', 'AuroraBliss', 'SerenaMoon',
  'LilyThorn', 'RubyDiamond', 'SageWild', 'IvyRose', 'CrystalSky',
  'DiamondFox', 'MidnightStar', 'CrimsonFlame', 'VelvetTouch', 'SilkDreams',
  'AngelWings', 'DevilSmile', 'SugarRush', 'HoneyPot', 'CherryBomb',
  'PeachCream', 'VanillaBean', 'CinnamonSpice', 'MintFresh', 'LavenderLust',
  'RoseGold', 'SilverMoon', 'GoldenHour', 'PlatinumBlonde', 'CopperKiss',
  'EmeraldEyes', 'SapphireSoul', 'RubyLips', 'DiamondDust', 'PearlWhite'
];

export interface VideoFile {
  id: string;
  filename: string;
  size: number;
  sizeFormatted: string;
  extension: string;
  createdAt: Date;
  url: string;
  profileImageUrl?: string;
  modelName?: string;
  verified?: boolean;
  postMessage?: string;
  hashtags?: string[];
  likes?: number;
}

// Helper function to load model profiles
function loadModelProfiles() {
  try {
    const profilesPath = path.join(process.cwd(), 'src', 'data', 'onlyfans-models.json');
    const profilesData = fs.readFileSync(profilesPath, 'utf8');
    return JSON.parse(profilesData);
  } catch (error) {
    console.error('Error loading model profiles:', error);
    return {};
  }
}

// Helper function to load hashtags
function loadHashtags() {
  try {
    const hashtagsPath = path.join(process.cwd(), 'src', 'data', 'hashtags.json');
    const hashtagsData = fs.readFileSync(hashtagsPath, 'utf8');
    return JSON.parse(hashtagsData);
  } catch (error) {
    console.error('Error loading hashtags:', error);
    return ['#spicy', '#sluttymonday'];
  }
}

// Helper function to get random hashtags
function getRandomHashtags(hashtags: string[], count: number = 2): string[] {
  const shuffled = [...hashtags].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper function to generate random like count
function getRandomLikes(): number {
  // Generate likes between 100 and 9999 with some distribution
  const rand = Math.random();
  if (rand < 0.1) {
    // 10% chance for very high likes (5000-9999)
    return Math.floor(Math.random() * 5000) + 5000;
  } else if (rand < 0.3) {
    // 20% chance for high likes (1000-4999)
    return Math.floor(Math.random() * 4000) + 1000;
  } else if (rand < 0.6) {
    // 30% chance for medium likes (500-999)
    return Math.floor(Math.random() * 500) + 500;
  } else {
    // 40% chance for low likes (100-499)
    return Math.floor(Math.random() * 400) + 100;
  }
}

function generateModelName(baseName: string): string {
  // Use a hash of the baseName to ensure consistent names for the same video
  let hash = 0;
  for (let i = 0; i < baseName.length; i++) {
    const char = baseName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and modulo to get a positive index
  const index = Math.abs(hash) % modelNames.length;
  return modelNames[index];
}

function generatePostMessage(): string {
  const messages = [
    "I got a bit drunk and got convinced to do this thing 😈",
    "My legs are still shaking from this scene lol 💦",
    "Had to film this after my workout... still sweaty 🔥",
    "My roommate walked in on me filming this... oops! 😅",
    "This was supposed to be a quick tease but got carried away 🤭",
    "French girls know how to make everything look sexy 🇫🇷",
    "My ex would be so jealous if he saw this 😏",
    "Just got home from the club and couldn't resist 💋",
    "My neighbors probably heard me moaning... oops! 😈",
    "This toy is my new addiction... can't stop using it 🎯",
    "Spanish girls are the wildest... you'll see why 🇪🇸",
    "This storm outside got me in the mood... very wet 💦",
    "My roommate is gone for the weekend... time to play 🎮",
    "Just turned 21 and already addicted to this feeling 🎂",
    "My boss has no idea what I do on my lunch breaks 😈",
    "Just broke up with my boyfriend... this felt so good 💔",
    "My yoga session turned into something much more intense 🧘‍♀️",
    "French afternoon delight... couldn't wait for tonight 🇫🇷",
    "Check out my latest video! 🔥",
    "You won't believe what happened in this one... 😳",
    "My new favorite position... what do you think? 😏",
    "This was so intense I had to film it 📹",
    "My secret is out... I'm addicted to this 💕",
    "Just discovered this new trick... mind blown 🤯",
    "My friends would be shocked if they saw this 😱"
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

// Helper function to check if profile image exists for a video
function hasProfileImage(videoFilename: string): { exists: boolean; profileImageUrl?: string } {
  try {
    // Extract the base name without extension
    const baseName = videoFilename.replace(/\.[^/.]+$/, '');
    
    // Since all profile images are now in R2, we assume they exist
    // The profile image API will handle 404s if the image doesn't exist
    return {
      exists: true,
      profileImageUrl: `/api/profile-image/${encodeURIComponent(`${baseName}_profile.jpg`)}`
    };
  } catch (error) {
    console.error('Error checking profile image:', error);
    return { exists: false };
  }
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
    
    // Load model profiles and hashtags
    const modelProfiles = loadModelProfiles();
    const availableHashtags = loadHashtags();
    
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
        
        // Check if profile image exists for this video
        const profileInfo = hasProfileImage(fileName);
        
        // Get model profile data
        const baseName = fileName.replace(/\.[^/.]+$/, '');
        const modelProfile = modelProfiles[baseName] || {};
        
        // Get random hashtags and likes for this video
        const randomHashtags = getRandomHashtags(availableHashtags, 2);
        const randomLikes = getRandomLikes();
        
        // Generate a model name if not found in profiles
        const modelName = modelProfile.modelName || generateModelName(baseName);
        
        return {
          id: fileName,
          filename: fileName,
          size: obj.Size || 0,
          sizeFormatted: formatBytes(obj.Size || 0),
          extension: `.${ext}`,
          createdAt: obj.LastModified || new Date(),
          url: `/api/video/${encodeURIComponent(fileName)}`,
          profileImageUrl: profileInfo.profileImageUrl,
          hasProfileImage: profileInfo.exists,
          modelName: modelName,
          verified: modelProfile.verified || Math.random() > 0.3, // 70% chance of being verified
          postMessage: modelProfile.postMessage || generatePostMessage(),
          hashtags: randomHashtags,
          likes: randomLikes
        };
      })
      .filter(video => 
        // Only include videos that have profile images
        video.hasProfileImage && (
          search === '' || 
          video.filename.toLowerCase().includes(search.toLowerCase())
        )
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
