import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';

class SimplePromptChanScraper {
  constructor() {
    this.baseUrl = 'https://promptchan.com';
    this.exploreUrl = 'https://promptchan.com/explore';
    this.downloadDir = './downloads';
    this.metadataDir = './metadata';
    this.browser = null;
    this.page = null;
    this.scrapedData = [];
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.downloadDir);
    await fs.ensureDir(this.metadataDir);
  }

  async init() {
    console.log(chalk.blue('🚀 Initializing Simple PromptChan Scraper...'));
    
    try {
      // Try with minimal configuration first
      this.browser = await puppeteer.launch({
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log(chalk.green('✅ Browser initialized successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize browser:'), error.message);
      throw error;
    }
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
          console.log(chalk.blue('🔄 Continuing with scraping...'));
          resolve();
        }, 30000);
      });

      console.log(chalk.blue('🔍 Navigating to explore page...'));
      await this.page.goto(this.exploreUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000); // Wait for page to load
      
      console.log(chalk.blue('🔍 Starting to scrape the explore page...'));
      await this.scrapePage();
      
      console.log(chalk.green(`✅ Found ${this.scrapedData.length} items`));
      
      if (this.scrapedData.length > 0) {
        await this.saveMetadata();
        console.log(chalk.green('💾 Metadata saved successfully!'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Scraping failed:'), error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async scrapePage() {
    try {
      // Get all video elements
      const videos = await this.page.evaluate(() => {
        const videoElements = document.querySelectorAll('video, [data-video], .video-item, .post-item, [class*="video"], [class*="post"]');
        const results = [];

        videoElements.forEach((element, index) => {
          try {
            let videoUrl = null;
            let thumbnailUrl = null;
            let title = '';
            let description = '';
            let prompt = '';

            // Find video URL
            if (element.tagName === 'VIDEO') {
              videoUrl = element.src || element.currentSrc;
              if (element.poster) thumbnailUrl = element.poster;
            } else {
              const video = element.querySelector('video');
              if (video) {
                videoUrl = video.src || video.currentSrc;
                if (video.poster) thumbnailUrl = video.poster;
              }
            }

            // Look for video URL in data attributes
            if (!videoUrl) {
              videoUrl = element.dataset.video || element.dataset.src || element.dataset.url;
            }

            // Extract text content
            const textContent = element.textContent || '';
            
            // Try to find title
            const titleSelectors = ['h1', 'h2', 'h3', '.title', '.post-title', '[data-title]'];
            for (const selector of titleSelectors) {
              const titleEl = element.querySelector(selector);
              if (titleEl && titleEl.textContent.trim()) {
                title = titleEl.textContent.trim();
                break;
              }
            }

            // If no title found, use first line of text content
            if (!title && textContent) {
              title = textContent.split('\n')[0].trim().substring(0, 100);
            }

            // Look for prompt
            const promptSelectors = ['.prompt', '.user-prompt', '[data-prompt]', '.message', '.content'];
            for (const selector of promptSelectors) {
              const promptEl = element.querySelector(selector);
              if (promptEl && promptEl.textContent.trim()) {
                prompt = promptEl.textContent.trim();
                break;
              }
            }

            // If no specific prompt found, use description
            if (!prompt && textContent) {
              prompt = textContent.trim().substring(0, 500);
            }

            if (videoUrl || title || prompt) {
              results.push({
                id: `item_${index}_${Date.now()}`,
                videoUrl,
                thumbnailUrl,
                title: title || 'Untitled',
                description: textContent.substring(0, 1000),
                prompt: prompt || 'No prompt found',
                metadata: {
                  className: element.className,
                  id: element.id,
                  dataAttributes: { ...element.dataset },
                  textLength: textContent.length
                },
                scrapedAt: new Date().toISOString()
              });
            }
          } catch (error) {
            console.error('Error processing element:', error);
          }
        });

        return results;
      });

      this.scrapedData = videos;
      console.log(chalk.blue(`📊 Extracted ${videos.length} items`));

    } catch (error) {
      console.error(chalk.red('❌ Error scraping page:'), error.message);
    }
  }

  async saveMetadata() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `promptchan_metadata_${timestamp}.json`;
    const filepath = path.join(this.metadataDir, filename);

    const metadata = {
      scrapedAt: new Date().toISOString(),
      totalItems: this.scrapedData.length,
      source: this.exploreUrl,
      items: this.scrapedData
    };

    await fs.writeJson(filepath, metadata, { spaces: 2 });
    console.log(chalk.green(`💾 Metadata saved to: ${filepath}`));
    
    return filepath;
  }
}

export default SimplePromptChanScraper;
