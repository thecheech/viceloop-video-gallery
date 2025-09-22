import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import VideoCleanup from './video-cleanup.js';

class ValidatedVideoScraper {
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
    this.maxScrollAttempts = 1000;
    this.maxNoNewContent = 100;
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.downloadDir);
    await fs.ensureDir(this.metadataDir);
  }

  async init() {
    console.log(chalk.blue('🚀 Initializing Validated Video Scraper...'));
    console.log(chalk.yellow(`🎯 Target: ${this.targetVideos} VALID VIDEOS`));
    
    try {
      this.browser = await puppeteer.launch({
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set longer timeouts
      this.page.setDefaultTimeout(180000);
      this.page.setDefaultNavigationTimeout(180000);
      
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
      
      const currentValidVideos = cleanup.getValidVideoCount();
      console.log(chalk.cyan(`📊 Current valid videos: ${currentValidVideos}`));
      
      if (currentValidVideos >= this.targetVideos) {
        console.log(chalk.green(`🎉 Target already achieved! ${currentValidVideos} valid videos found.`));
        return;
      }

      const remainingVideos = this.targetVideos - currentValidVideos;
      console.log(chalk.yellow(`🎯 Need ${remainingVideos} more videos`));

      await this.init();
      
      console.log(chalk.yellow('🌐 Opening promptchan.com...'));
      await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
      
      console.log(chalk.cyan('👤 Please log in manually in the browser window...'));
      console.log(chalk.cyan('   After logging in, navigate to the explore page.'));
      console.log(chalk.yellow('⏰ Waiting 30 seconds for you to log in and navigate...'));
      
      // Wait for user to log in
      await new Promise((resolve) => {
        setTimeout(() => {
          console.log(chalk.blue('🔄 Starting validated video hunting...'));
          resolve();
        }, 30000);
      });

      console.log(chalk.blue('🔍 Navigating to explore page...'));
      await this.page.goto(this.exploreUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);
      
      // Ultra-aggressive scrolling
      console.log(chalk.blue('📜 Starting ultra-aggressive scrolling...'));
      await this.ultraScrollForVideos();
      
      // Extract video URLs
      console.log(chalk.blue('🔍 Extracting video URLs from page content...'));
      await this.extractVideoUrlsFromPage();
      
      console.log(chalk.green(`✅ Found ${this.videoUrls.size} unique video URLs`));
      
      if (this.videoUrls.size > 0) {
        await this.saveVideoMetadata();
        console.log(chalk.green('💾 Video metadata saved successfully!'));
        
        console.log(chalk.blue('📥 Starting VALIDATED video downloads...'));
        await this.downloadAllVideos();
        
        // Clean up again after downloading
        console.log(chalk.blue('🧹 Final cleanup after downloading...'));
        const finalCleanup = new VideoCleanup();
        await finalCleanup.run();
        
        const finalValidVideos = finalCleanup.getValidVideoCount();
        console.log(chalk.green(`🎉 Final result: ${finalValidVideos} valid videos!`));
        
        if (finalValidVideos < this.targetVideos) {
          console.log(chalk.yellow(`⚠️  Still need ${this.targetVideos - finalValidVideos} more videos. Consider running again.`));
        }
      } else {
        console.log(chalk.red('❌ No videos found!'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Video scraping failed:'), error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async ultraScrollForVideos() {
    let previousHeight = 0;
    let scrollAttempts = 0;
    let noNewContentCount = 0;
    let lastVideoCount = 0;
    let stagnantCount = 0;

    console.log(chalk.blue('📜 Starting ultra-aggressive scrolling...'));

    while (scrollAttempts < this.maxScrollAttempts && noNewContentCount < this.maxNoNewContent) {
      // Scroll to bottom
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for new content
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
      if (scrollAttempts % 25 === 0) {
        console.log(chalk.cyan(`📊 Scroll progress: ${scrollAttempts}/${this.maxScrollAttempts} | Videos found: ${currentVideoCount} | Stagnant: ${stagnantCount}`));
      }

      // Check if we have enough videos
      if (currentVideoCount >= this.targetVideos * 2) { // Get more than needed to account for corrupted files
        console.log(chalk.green(`🎯 Target reached: ${currentVideoCount} videos found!`));
        break;
      }

      // Try different scrolling strategies if stagnant
      if (stagnantCount > 20) {
        console.log(chalk.yellow('🔄 Trying different scrolling strategies...'));
        
        await this.page.evaluate(() => {
          window.scrollBy(0, 500);
        });
        await this.page.waitForTimeout(100);
        
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await this.page.waitForTimeout(100);
        
        await this.page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        await this.page.waitForTimeout(100);
        
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.page.waitForTimeout(100);
        
        stagnantCount = 0;
      }

      // Try clicking "Load More" buttons
      if (scrollAttempts % 50 === 0) {
        try {
          const loadMoreButtons = await this.page.$$('button[class*="load"], button[class*="more"], [class*="load-more"], [class*="show-more"]');
          for (const button of loadMoreButtons) {
            await button.click();
            await this.page.waitForTimeout(500);
          }
        } catch (error) {
          // Ignore errors
        }
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
          timeout: 30000
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
    const batchSize = 3;
    for (let i = 0; i < downloadPromises.length; i += batchSize) {
      const batch = downloadPromises.slice(i, i + batchSize);
      await Promise.allSettled(batch);
      
      // Small delay between batches
      if (i + batchSize < downloadPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
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
    const filename = `promptchan_validated_videos_${timestamp}.json`;
    const filepath = path.join(this.metadataDir, filename);

    const metadata = {
      scrapedAt: new Date().toISOString(),
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

export default ValidatedVideoScraper;


