#!/usr/bin/env node

import ProxyVideoScraper from './proxy-video-scraper.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            Proxy Video PromptChan Scraper                    ║
║                                                              ║
║  🌐 Uses proxy rotation to avoid rate limits                 ║
║  🧹 Cleans up corrupted and duplicate files                  ║
║  🎯 Target: 1000+ VALID VIDEOS (not corrupted)              ║
║  🔄 Retry failed downloads with different proxies            ║
║  ⏰ 2-minute timeout per video                               ║
║  📥 Downloads one video at a time to avoid rate limits       ║
║  🔐 Manual login and navigation required                     ║
║  📥 Downloads with real-time validation                      ║
║  💾 Saves video metadata in JSON format                     ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting Proxy Video Scraper...'));
    console.log(chalk.yellow('\n📋 Instructions:'));
    console.log(chalk.yellow('   1. A browser window will open'));
    console.log(chalk.yellow('   2. Log in to promptchan.com manually'));
    console.log(chalk.yellow('   3. Navigate to the explore page'));
    console.log(chalk.yellow('   4. Wait 30 seconds for automatic scraping'));
    console.log(chalk.yellow('   5. The scraper will use proxy rotation'));
    console.log(chalk.yellow('   6. Target: 1000+ VALID (non-corrupted) videos'));
    console.log(chalk.yellow('   7. Better rate limit handling with proxies\n'));

    console.log(chalk.cyan('🌐 Proxy Configuration:'));
    console.log(chalk.cyan('   • Add your proxy servers to the proxies array'));
    console.log(chalk.cyan('   • Format: "http://username:password@ip:port"'));
    console.log(chalk.cyan('   • Or: "http://ip:port" for free proxies'));
    console.log(chalk.cyan('   • Current proxies: Check proxy-video-scraper.js\n'));

    const scraper = new ProxyVideoScraper();
    await scraper.run();

    console.log(chalk.green(`
🎉 Proxy video scraping completed!

📁 Files saved to:
   • Videos: ./downloads
   • Metadata: ./metadata

💡 All videos are validated and corrupted files are removed.
🌐 Proxy rotation helps avoid rate limits and IP blocking.
🔄 Failed downloads are automatically retried with different proxies.
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


