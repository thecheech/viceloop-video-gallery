#!/usr/bin/env node

import RetryVideoScraper from './retry-video-scraper.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            Retry Video PromptChan Scraper                    ║
║                                                              ║
║  🧹 Cleans up corrupted and duplicate files                  ║
║  🎯 Target: 1000+ VALID VIDEOS (not corrupted)              ║
║  🔄 Retry failed downloads with exponential backoff          ║
║  ⏰ 2-minute timeout per video (vs 1-minute before)          ║
║  📥 Downloads one video at a time to avoid rate limits       ║
║  🔐 Manual login and navigation required                     ║
║  📥 Downloads with real-time validation                      ║
║  💾 Saves video metadata in JSON format                     ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting Retry Video Scraper...'));
    console.log(chalk.yellow('\n📋 Instructions:'));
    console.log(chalk.yellow('   1. A browser window will open'));
    console.log(chalk.yellow('   2. Log in to promptchan.com manually'));
    console.log(chalk.yellow('   3. Navigate to the explore page'));
    console.log(chalk.yellow('   4. Wait 30 seconds for automatic scraping'));
    console.log(chalk.yellow('   5. The scraper will retry failed downloads'));
    console.log(chalk.yellow('   6. Target: 1000+ VALID (non-corrupted) videos'));
    console.log(chalk.yellow('   7. Better timeout handling and rate limiting\n'));

    const scraper = new RetryVideoScraper();
    await scraper.run();

    console.log(chalk.green(`
🎉 Retry video scraping completed!

📁 Files saved to:
   • Videos: ./downloads
   • Metadata: ./metadata

💡 All videos are validated and corrupted files are removed.
🔄 Failed downloads are automatically retried with exponential backoff.
`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Scraping interrupted by user'));
  process.exit(0);
});

// Run the main function
main().catch(console.error);


