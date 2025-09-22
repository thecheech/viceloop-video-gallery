import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import VideoCleanup from './video-cleanup.js';

class PersistentVideoScraper {
  constructor() {
    this.baseUrl = 'https://promptchan.com';
    this.exploreUrl = 'https://promptchan.com/explore';
    this.downloadDir = './downloads';
    this.metadataDir = './metadata';
    this.browser = null;
    this.page = null;
    this.videoUrls = new Set();
    this.downloadedVideos = [];
    this.targetVideos = 1000;
    this.maxScrollAttempts = 2000; // Even more aggressive
    this.maxNoNewContent = 200; // Much higher threshold
    this.sessionCount = 0;
    this.maxSessions = 10; // Try multiple sessions
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.downloadDir);
    await fs.ensureDir(this.metadataDir);
  }

  async init() {
    console.log(chalk.blue(`🚀 Initializing Persistent Video Scraper (Session ${this.sessionCount + 1})...`));
    console.log(chalk.yellow(`🎯 Target: ${this.targetVideos} VALID VIDEOS`));
    
    try {
      this.browser = await puppeteer.launch({
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--disable-default-apps',
          '--disable-extensions'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set longer timeouts
      this.page.setDefaultTimeout(300000);
      this.page.setDefaultNavigationTimeout(300000);
      
      // Enable request interception
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        request.continue();
      });

      // Capture video URLs
      this.page.on('response', async (response) => {
        const url = response.url();
        if (this.isVideoUrl(url)) {
          this.videoUrls.add(url);
          console.log(chalk.green(`📹 Found video: ${url}`));
        }
      });
      
      console.log(chalk.green('✅ Browser initialized successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize browser:'), error.message);
      throw error;
    }
  }

  isVideoUrl(url) {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    const videoKeywords = ['video', 'media', 'stream', 'play', 'content', 'generated_videos'];
    
    return videoExtensions.some(ext => url.toLowerCase().includes(ext)) ||
           videoKeywords.some(keyword => url.toLowerCase().includes(keyword)) ||
           url.includes('generated_videos') ||
           url.includes('assets/explore') ||
           url.includes('assets/static') ||
           url.includes('bucket.aicloudnetservices.com');
  }

  async run() {
    try {
      // First, clean up existing files
      console.log(chalk.blue('🧹 Cleaning up existing files...'));
      const cleanup = new VideoCleanup();
      await cleanup.run();
      
      let currentValidVideos = cleanup.getValidVideoCount();
      console.log(chalk.cyan(`📊 Current valid videos: ${currentValidVideos}`));
      
      while (currentValidVideos < this.targetVideos && this.sessionCount < this.maxSessions) {
        this.sessionCount++;
        console.log(chalk.blue(`\n🔄 Starting session ${this.sessionCount}/${this.maxSessions}`));
        
        try {
          await this.init();
          
          console.log(chalk.yellow('🌐 Opening promptchan.com...'));
          await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
          
          if (this.sessionCount === 1) {
            console.log(chalk.cyan('👤 Please log in manually in the browser window...'));
            console.log(chalk.cyan('   After logging in, navigate to the explore page.'));
            console.log(chalk.yellow('⏰ Waiting 30 seconds for you to log in and navigate...'));
            
            // Wait for user to log in
            await new Promise((resolve) => {
              setTimeout(() => {
                console.log(chalk.blue('🔄 Starting persistent video hunting...'));
                resolve();
              }, 30000);
            });
          }

          console.log(chalk.blue('🔍 Navigating to explore page...'));
          await this.page.goto(this.exploreUrl, { waitUntil: 'domcontentloaded' });
          await this.page.waitForTimeout(5000); // Wait longer for content to load
          
          // Ultra-aggressive scrolling
          console.log(chalk.blue('📜 Starting ULTRA-aggressive scrolling...'));
          await this.ultraScrollForVideos();
          
          // Extract video URLs
          console.log(chalk.blue('🔍 Extracting video URLs from page content...'));
          await this.extractVideoUrlsFromPage();
          
          console.log(chalk.green(`✅ Found ${this.videoUrls.size} unique video URLs in this session`));
          
          if (this.videoUrls.size > 0) {
            await this.saveVideoMetadata();
            console.log(chalk.green('💾 Video metadata saved successfully!'));
            
            console.log(chalk.blue('📥 Starting VALIDATED video downloads...'));
            await this.downloadAllVideos();
            
            // Clean up after downloading
            console.log(chalk.blue('🧹 Cleanup after downloading...'));
            const sessionCleanup = new VideoCleanup();
            await sessionCleanup.run();
            
            currentValidVideos = sessionCleanup.getValidVideoCount();
            console.log(chalk.green(`🎉 Session ${this.sessionCount} complete: ${currentValidVideos} valid videos!`));
            
            if (currentValidVideos >= this.targetVideos) {
              console.log(chalk.green(`🎉 TARGET ACHIEVED! ${currentValidVideos} valid videos!`));
              break;
            }
            
            const remaining = this.targetVideos - currentValidVideos;
            console.log(chalk.yellow(`🎯 Still need ${remaining} more videos. Starting next session...`));
          } else {
            console.log(chalk.red('❌ No videos found in this session!'));
          }

        } catch (error) {
          console.error(chalk.red(`❌ Session ${this.sessionCount} failed:`), error.message);
        } finally {
          if (this.browser) {
            await this.browser.close();
            this.browser = null;
          }
        }
        
        // Wait between sessions
        if (currentValidVideos < this.targetVideos && this.sessionCount < this.maxSessions) {
          console.log(chalk.yellow('⏳ Waiting 10 seconds before next session...'));
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      // Final cleanup
      console.log(chalk.blue('\n🧹 Final cleanup...'));
      const finalCleanup = new VideoCleanup();
      await finalCleanup.run();
      
      const finalValidVideos = finalCleanup.getValidVideoCount();
      console.log(chalk.green(`\n🎉 FINAL RESULT: ${finalValidVideos} valid videos!`));
      
      if (finalValidVideos >= this.targetVideos) {
        console.log(chalk.green(`🎉 MISSION ACCOMPLISHED! Target of ${this.targetVideos} videos achieved!`));
      } else {
        console.log(chalk.yellow(`⚠️  Target not fully achieved. Got ${finalValidVideos}/${this.targetVideos} videos.`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Persistent video scraping failed:'), error.message);
    }
  }

  async ultraScrollForVideos() {
    let previousHeight = 0;
    let scrollAttempts = 0;
    let noNewContentCount = 0;
    let lastVideoCount = 0;
    let stagnantCount = 0;

    console.log(chalk.blue('📜 Starting ULTRA-aggressive scrolling...'));

    while (scrollAttempts < this.maxScrollAttempts && noNewContentCount < this.maxNoNewContent) {
      // Multiple scrolling strategies
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.page.waitForTimeout(100);
      
      await this.page.evaluate(() => {
        window.scrollBy(0, 1000);
      });
      await this.page.waitForTimeout(100);
      
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.page.waitForTimeout(200);

      // Check if new content was loaded
      const newHeight = await this.page.evaluate(() => document.body.scrollHeight);
      
      if (newHeight === previousHeight) {
        noNewContentCount++;
        console.log(chalk.yellow(`⏳ No new content (${noNewContentCount}/${this.maxNoNewContent})`));
      } else {
        noNewContentCount = 0;
        previousHeight = newHeight;
        console.log(chalk.blue(`📜 Scrolled to height: ${newHeight}px`));
      }

      scrollAttempts++;

      // Check video count progress
      const currentVideoCount = this.videoUrls.size;
      if (currentVideoCount === lastVideoCount) {
        stagnantCount++;
      } else {
        stagnantCount = 0;
        lastVideoCount = currentVideoCount;
      }

      // Progress indicator
      if (scrollAttempts % 50 === 0) {
        console.log(chalk.cyan(`📊 Scroll progress: ${scrollAttempts}/${this.maxScrollAttempts} | Videos found: ${currentVideoCount} | Stagnant: ${stagnantCount}`));
      }

      // Check if we have enough videos
      if (currentVideoCount >= this.targetVideos * 3) { // Get 3x more than needed
        console.log(chalk.green(`🎯 Target reached: ${currentVideoCount} videos found!`));
        break;
      }

      // Try different scrolling strategies if stagnant
      if (stagnantCount > 30) {
        console.log(chalk.yellow('🔄 Trying different scrolling strategies...'));
        
        // Scroll to middle
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await this.page.waitForTimeout(500);
        
        // Scroll to top
        await this.page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        await this.page.waitForTimeout(500);
        
        // Scroll to bottom
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.page.waitForTimeout(500);
        
        // Try clicking load more buttons
        try {
          const loadMoreButtons = await this.page.$$('button[class*="load"], button[class*="more"], [class*="load-more"], [class*="show-more"], button');
          for (const button of loadMoreButtons.slice(0, 5)) {
            try {
              await button.click();
              await this.page.waitForTimeout(1000);
            } catch (e) {
              // Ignore click errors
            }
          }
        } catch (error) {
          // Ignore errors
        }
        
        stagnantCount = 0;
      }

      // Try refreshing the page every 500 scrolls
      if (scrollAttempts % 500 === 0 && scrollAttempts > 0) {
        console.log(chalk.yellow('🔄 Refreshing page to load more content...'));
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);
      }
    }

    console.log(chalk.green(`📜 Scrolling completed after ${scrollAttempts} attempts`));
  }

  async extractVideoUrlsFromPage() {
    try {
      console.log(chalk.blue('🔍 Extracting video URLs from page content...'));
      
      const videoUrls = await this.page.evaluate(() => {
        const urls = new Set();
        
        // Find all video elements
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          if (video.src) urls.add(video.src);
          if (video.currentSrc) urls.add(video.currentSrc);
          if (video.poster) urls.add(video.poster);
        });

        // Find all elements with video-related data attributes
        const videoElements = document.querySelectorAll('[data-video], [data-src], [data-url], [data-media], [data-poster]');
        videoElements.forEach(el => {
          const attrs = ['data-video', 'data-src', 'data-url', 'data-media', 'data-poster'];
          attrs.forEach(attr => {
            if (el.dataset[attr]) {
              urls.add(el.dataset[attr]);
            }
          });
        });

        // Find all elements with video-related classes
        const videoClassElements = document.querySelectorAll('[class*="video"], [class*="media"], [class*="player"], [class*="content"]');
        videoClassElements.forEach(el => {
          if (el.src) urls.add(el.src);
          if (el.href) urls.add(el.href);
        });

        // Find all links that might be videos
        const links = document.querySelectorAll('a[href*="video"], a[href*="media"], a[href*="mp4"], a[href*="webm"], a[href*="mov"]');
        links.forEach(link => {
          if (link.href) urls.add(link.href);
        });

        // Find all elements with background videos
        const bgElements = document.querySelectorAll('[style*="video"], [style*="mp4"], [style*="webm"], [style*="mov"]');
        bgElements.forEach(el => {
          const style = el.getAttribute('style') || '';
          const videoMatch = style.match(/url\(['"]?([^'"]*\.(mp4|webm|mov|avi))['"]?\)/gi);
          if (videoMatch) {
            videoMatch.forEach(match => {
              const url = match.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
              urls.add(url);
            });
          }
        });

        // Look for video URLs in all text content
        const allText = document.body.textContent || '';
        const urlRegex = /https?:\/\/[^\s]+\.(mp4|webm|mov|avi|mkv|flv|wmv)/gi;
        const matches = allText.match(urlRegex);
        if (matches) {
          matches.forEach(url => urls.add(url));
        }

        return Array.from(urls);
      });

      // Add found URLs to our set
      videoUrls.forEach(url => {
        if (this.isVideoUrl(url)) {
          this.videoUrls.add(url);
        }
      });

      console.log(chalk.blue(`📊 Extracted ${videoUrls.length} potential video URLs from page`));

    } catch (error) {
      console.error(chalk.red('❌ Error extracting video URLs:'), error.message);
    }
  }

  async downloadAllVideos() {
    const videoArray = Array.from(this.videoUrls);
    console.log(chalk.blue(`📥 Downloading ${videoArray.length} videos with validation...`));

    const downloadPromises = videoArray.map(async (videoUrl, index) => {
      try {
        console.log(chalk.blue(`📥 Downloading video ${index + 1}/${videoArray.length}...`));
        
        const response = await axios({
          method: 'GET',
          url: videoUrl,
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 60000 // Longer timeout
        });

        const extension = this.getFileExtension(videoUrl);
        const filename = `video_${index + 1}_${Date.now()}.${extension}`;
        const filepath = path.join(this.downloadDir, filename);
        const writer = fs.createWriteStream(filepath);
        
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', async () => {
            // Validate the downloaded file
            try {
              const stats = await fs.stat(filepath);
              if (stats.size > 1024) { // At least 1KB
                console.log(chalk.green(`✅ Downloaded: ${filename} (${this.formatBytes(stats.size)})`));
                this.downloadedVideos.push({
                  url: videoUrl,
                  filename: filename,
                  filepath: filepath,
                  size: stats.size
                });
              } else {
                console.log(chalk.red(`❌ Corrupted: ${filename} (${stats.size} bytes)`));
                await fs.remove(filepath);
              }
            } catch (error) {
              console.log(chalk.red(`❌ Error validating: ${filename}`));
              await fs.remove(filepath);
            }
            resolve();
          });
          writer.on('error', async (error) => {
            console.error(chalk.red(`❌ Failed to download video ${index + 1}:`), error.message);
            await fs.remove(filepath);
            reject(error);
          });
        });

      } catch (error) {
        console.error(chalk.red(`❌ Failed to download video ${index + 1}:`), error.message);
        return null;
      }
    });

    // Download videos in smaller batches
    const batchSize = 2;
    for (let i = 0; i < downloadPromises.length; i += batchSize) {
      const batch = downloadPromises.slice(i, i + batchSize);
      await Promise.allSettled(batch);
      
      // Small delay between batches
      if (i + batchSize < downloadPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const successful = this.downloadedVideos.length;
    const failed = videoArray.length - successful;
    
    console.log(chalk.green(`🎉 Download complete: ${successful} successful, ${failed} failed`));
  }

  getFileExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const extension = path.extname(pathname).slice(1);
      return extension || 'mp4';
    } catch {
      return 'mp4';
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async saveVideoMetadata() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `promptchan_persistent_videos_${timestamp}.json`;
    const filepath = path.join(this.metadataDir, filename);

    const metadata = {
      scrapedAt: new Date().toISOString(),
      session: this.sessionCount,
      totalVideos: this.videoUrls.size,
      downloadedVideos: this.downloadedVideos.length,
      targetVideos: this.targetVideos,
      source: this.exploreUrl,
      videoUrls: Array.from(this.videoUrls),
      downloadedFiles: this.downloadedVideos
    };

    await fs.writeJson(filepath, metadata, { spaces: 2 });
    console.log(chalk.green(`💾 Video metadata saved to: ${filepath}`));
    
    return filepath;
  }
}

export default PersistentVideoScraper;


