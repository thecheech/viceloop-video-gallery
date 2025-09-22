import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';

class UltraVideoScraper {
  constructor() {
    this.baseUrl = 'https://promptchan.com';
    this.exploreUrl = 'https://promptchan.com/explore';
    this.downloadDir = './downloads';
    this.metadataDir = './metadata';
    this.browser = null;
    this.page = null;
    this.videoUrls = new Set();
    this.downloadedVideos = [];
    this.targetVideos = 1000; // Target 1000+ videos
    this.maxScrollAttempts = 1000; // Ultra-aggressive scrolling
    this.maxNoNewContent = 100; // Much higher threshold
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.downloadDir);
    await fs.ensureDir(this.metadataDir);
  }

  async init() {
    console.log(chalk.blue('🚀 Initializing Ultra Video Scraper...'));
    console.log(chalk.yellow(`🎯 Target: ${this.targetVideos} VIDEOS`));
    console.log(chalk.yellow(`📜 Max scroll attempts: ${this.maxScrollAttempts}`));
    
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
      
      // Set longer timeouts for ultra-extensive video hunting
      this.page.setDefaultTimeout(180000);
      this.page.setDefaultNavigationTimeout(180000);
      
      // Enable request interception to capture ALL video URLs
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        request.continue();
      });

      // Capture ALL network responses to find video URLs
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
      await this.init();
      
      console.log(chalk.yellow('🌐 Opening promptchan.com...'));
      await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
      
      console.log(chalk.cyan('👤 Please log in manually in the browser window...'));
      console.log(chalk.cyan('   After logging in, navigate to the explore page.'));
      console.log(chalk.yellow('⏰ Waiting 30 seconds for you to log in and navigate...'));
      
      // Wait 30 seconds for user to log in and navigate
      await new Promise((resolve) => {
        setTimeout(() => {
          console.log(chalk.blue('🔄 Starting ULTRA video hunting...'));
          resolve();
        }, 30000);
      });

      console.log(chalk.blue('🔍 Navigating to explore page...'));
      await this.page.goto(this.exploreUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);
      
      // ULTRA-aggressive scrolling to find ALL videos
      console.log(chalk.blue('📜 Starting ULTRA-aggressive scrolling to find 1000+ videos...'));
      await this.ultraScrollForVideos();
      
      // Extract video URLs from page content
      console.log(chalk.blue('🔍 Extracting video URLs from page content...'));
      await this.extractVideoUrlsFromPage();
      
      console.log(chalk.green(`✅ Found ${this.videoUrls.size} unique video URLs`));
      
      if (this.videoUrls.size > 0) {
        await this.saveVideoMetadata();
        console.log(chalk.green('💾 Video metadata saved successfully!'));
        
        console.log(chalk.blue('📥 Starting MASS video downloads...'));
        await this.downloadAllVideos();
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

    console.log(chalk.blue('📜 Starting ULTRA-aggressive scrolling for 1000+ videos...'));

    while (scrollAttempts < this.maxScrollAttempts && noNewContentCount < this.maxNoNewContent) {
      // Scroll to bottom
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for new content to load
      await this.page.waitForTimeout(200); // Very short wait for maximum speed

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
      if (currentVideoCount >= this.targetVideos) {
        console.log(chalk.green(`🎯 Target reached: ${currentVideoCount} videos found!`));
        break;
      }

      // If we've been stagnant for too long, try different scrolling strategies
      if (stagnantCount > 20) {
        console.log(chalk.yellow('🔄 Trying different scrolling strategies...'));
        
        // Try scrolling in smaller increments
        await this.page.evaluate(() => {
          window.scrollBy(0, 500);
        });
        await this.page.waitForTimeout(100);
        
        // Try scrolling to middle of page
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await this.page.waitForTimeout(100);
        
        // Try scrolling to top and back down
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

      // Try clicking "Load More" buttons if they exist
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
      
      // Extract video URLs from all possible sources
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
    console.log(chalk.blue(`📥 Downloading ${videoArray.length} videos...`));

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
          writer.on('finish', () => {
            console.log(chalk.green(`✅ Downloaded: ${filename}`));
            this.downloadedVideos.push({
              url: videoUrl,
              filename: filename,
              filepath: filepath,
              size: fs.statSync(filepath).size
            });
            resolve();
          });
          writer.on('error', (error) => {
            console.error(chalk.red(`❌ Failed to download video ${index + 1}:`), error.message);
            reject(error);
          });
        });

      } catch (error) {
        console.error(chalk.red(`❌ Failed to download video ${index + 1}:`), error.message);
        return null;
      }
    });

    // Download videos in smaller batches to avoid overwhelming the server
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

  async saveVideoMetadata() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `promptchan_ultra_videos_${timestamp}.json`;
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

export default UltraVideoScraper;


