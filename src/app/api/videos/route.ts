import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
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
  hasProfileImage?: boolean;
  modelName?: string;
  verified?: boolean;
  postMessage?: string;
  hashtags?: string[];
  likes?: number;
}

// Cache for video metadata to avoid repeated R2 calls
const videoMetadataCache = new Map<string, { exists: boolean; profileImageUrl?: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

function generateModelName(baseName: string): string {
  const hash = hashString(baseName);
  const index = hash % modelNames.length;
  return modelNames[index];
}

function generatePostMessage(baseName: string): string {
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

  const hash = hashString(baseName + 'message');
  const index = hash % messages.length;
  return messages[index];
}

// Helper function to get random hashtags with deterministic selection
function getRandomHashtags(hashtags: string[], count: number, baseName: string): string[] {
  const hash = hashString(baseName + 'hashtags');
  const random = seededRandom(hash);

  const shuffled = [...hashtags].sort(() => random() - 0.5);
  return shuffled.slice(0, count);
}

// Helper function to generate verified status
function generateVerified(baseName: string): boolean {
  const hash = hashString(baseName + 'verified');
  const random = seededRandom(hash);
  return random() > 0.3;
}

// Helper function to create a deterministic hash from string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Seeded random number generator for consistent results
function seededRandom(seed: number): () => number {
  let x = seed;
  return function() {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

// Helper function to generate random like count with deterministic value
function getRandomLikes(baseName: string): number {
  const hash = hashString(baseName + 'likes');
  const random = seededRandom(hash);

  const rand = random();
  if (rand < 0.1) {
    return Math.floor(random() * 5000) + 5000;
  } else if (rand < 0.3) {
    return Math.floor(random() * 4000) + 1000;
  } else if (rand < 0.6) {
    return Math.floor(random() * 500) + 500;
  } else {
    return Math.floor(random() * 400) + 100;
  }
}

// Enhanced profile image checking with caching
async function hasProfileImage(videoFilename: string, s3Client: S3Client): Promise<{ exists: boolean; profileImageUrl?: string }> {
  try {
    // Extract the base name without extension
    const baseName = videoFilename.replace(/\.[^/.]+$/, '');
    const cacheKey = `profile_${baseName}`;

    // Check cache first
    const cached = videoMetadataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { exists: cached.exists, profileImageUrl: cached.profileImageUrl };
    }

    const profileImageKey = `profiles/${baseName}_profile.jpg`;

    // Check if profile image exists in R2
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: profileImageKey,
      });

      await s3Client.send(headCommand);

      const result = {
        exists: true,
        profileImageUrl: `/api/profile-image/${encodeURIComponent(`${baseName}_profile.jpg`)}`
      };

      // Cache the result
      videoMetadataCache.set(cacheKey, {
        ...result,
        timestamp: Date.now()
      });

      return result;
    } catch {
      // Profile image doesn't exist in R2
      const result = { exists: false };

      // Cache the negative result too
      videoMetadataCache.set(cacheKey, {
        ...result,
        timestamp: Date.now()
      });

      return result;
    }
  } catch {
    console.error('Error checking profile image');
    return { exists: false };
  }
}

// Optimized video processing with batching
async function processVideosBatch(
  videoObjects: Array<{ Key?: string; Size?: number; LastModified?: Date }>,
  s3Client: S3Client,
  modelProfiles: Record<string, unknown>,
  availableHashtags: string[]
): Promise<VideoFile[]> {
  // Process videos in parallel batches to avoid overwhelming R2
  const BATCH_SIZE = 10;
  const results: VideoFile[] = [];

  for (let i = 0; i < videoObjects.length; i += BATCH_SIZE) {
    const batch = videoObjects.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (obj) => {
      const fileName = obj.Key!.split('/').pop() || '';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      // Check if profile image exists for this video
      const profileInfo = await hasProfileImage(fileName, s3Client);

      // Get model profile data
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const modelProfile = modelProfiles[baseName] as Record<string, unknown> || {};

      // Get deterministic hashtags and likes for this video
      const randomHashtags = getRandomHashtags(availableHashtags, 2, baseName);
      const randomLikes = getRandomLikes(baseName);

      // Generate a model name if not found in profiles
      const modelName = (modelProfile.modelName as string) || generateModelName(baseName);

      return {
        id: fileName,
        filename: fileName,
        size: obj.Size || 0,
        sizeFormatted: formatBytes(obj.Size || 0),
        extension: `.${ext}`,
        createdAt: obj.LastModified || new Date(),
        url: `/api/video/${encodeURIComponent(fileName)}`,
        profileImageUrl: profileInfo.profileImageUrl || "/viceloop-logo.jpg",
        hasProfileImage: profileInfo.exists,
        modelName: modelName,
        verified: (modelProfile.verified as boolean) || generateVerified(baseName),
        postMessage: (modelProfile.postMessage as string) || generatePostMessage(baseName),
        hashtags: randomHashtags,
        likes: randomLikes
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20'); // Reduced default limit
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

    // List all objects in the videos folder with pagination
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME!,
      Prefix: 'videos/',
      MaxKeys: Math.min(limit * 5, 200) // Increased to get more variety
    });

    const response = await s3Client.send(listCommand);
    const objects = response.Contents || [];

    // Load model profiles and hashtags once
    const modelProfiles = loadModelProfiles();

    // Load hashtags
    const hashtagsPath = path.join(process.cwd(), 'src', 'data', 'hashtags.json');
    const hashtagsData = fs.readFileSync(hashtagsPath, 'utf8');
    const availableHashtags = JSON.parse(hashtagsData);

    // Filter video files
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    const videoObjects = objects.filter(obj => {
      if (!obj.Key) return false;
      const fileName = obj.Key.split('/').pop() || '';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      return videoExtensions.includes(`.${ext}`);
    });

    // Process videos with optimized batching
    const videoFiles = await processVideosBatch(videoObjects, s3Client, modelProfiles, availableHashtags);

    // Filter videos and match search (include all videos, with or without profile images)
    const filteredVideos = videoFiles
      .filter(video =>
        search === '' ||
        video.filename.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by newest first

    // Shuffle the results for more variety in the feed
    const shuffledVideos = [...filteredVideos];
    for (let i = shuffledVideos.length - 1; i > 0; i--) {
      const hash = hashString(`shuffle_${page}_${i}`);
      const random = seededRandom(hash);
      const j = Math.floor(random() * (i + 1));
      [shuffledVideos[i], shuffledVideos[j]] = [shuffledVideos[j], shuffledVideos[i]];
    }

    // Calculate pagination
    const total = shuffledVideos.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVideos = shuffledVideos.slice(startIndex, endIndex);

    // Add performance metadata
    const performanceData = {
      cacheHitRate: videoMetadataCache.size > 0 ?
        Array.from(videoMetadataCache.values()).filter(c => Date.now() - c.timestamp < CACHE_TTL).length / videoMetadataCache.size : 0,
      processingTime: Date.now() - startTime,
      totalVideos: total,
      videosWithProfiles: videoFiles.filter(v => v.hasProfileImage).length
    };

    return NextResponse.json({
      videos: paginatedVideos,
      total,
      page,
      totalPages,
      limit,
      hasMore: page < totalPages,
      performance: performanceData
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
