#!/usr/bin/env node

import SmartRateLimitScraper from './smart-rate-limit-scraper.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            Smart Rate Limit Video Scraper                    ║
║                                                              ║
║  🧠 Smart rate limiting without proxies                      ║
║  🧹 Cleans up corrupted and duplicate files                  ║
║  🎯 Target: 1000+ VALID VIDEOS (not corrupted)              ║
║  🔄 Multiple sessions with smart backoff                     ║
║  ⏰ 3-minute timeout per video                               ║
║  📥 Smart delays based on success/failure                    ║
║  🔐 Manual login and navigation required                     ║
║  📥 Downloads with real-time validation                      ║
║  💾 Saves video metadata in JSON format                     ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting Smart Rate Limit Video Scraper...'));
    console.log(chalk.yellow('\n📋 Instructions:'));
    console.log(chalk.yellow('   1. A browser window will open'));
    console.log(chalk.yellow('   2. Log in to promptchan.com manually'));
    console.log(chalk.yellow('   3. Navigate to the explore page'));
    console.log(chalk.yellow('   4. Wait 30 seconds for automatic scraping'));
    console.log(chalk.yellow('   5. The scraper will use smart rate limiting'));
    console.log(chalk.yellow('   6. Target: 1000+ VALID (non-corrupted) videos'));
    console.log(chalk.yellow('   7. Multiple sessions with smart backoff\n'));

    console.log(chalk.cyan('🧠 Smart Rate Limiting Features:'));
    console.log(chalk.cyan('   • 5-second delay between successful downloads'));
    console.log(chalk.cyan('   • 10-second delay between failed downloads'));
    console.log(chalk.cyan('   • Up to 5-minute wait for rate limit errors'));
    console.log(chalk.cyan('   • Up to 1-minute wait for other errors'));
    console.log(chalk.cyan('   • Multiple sessions to avoid IP blocking\n'));

    const scraper = new SmartRateLimitScraper();
    await scraper.run();

    console.log(chalk.green(`
🎉 Smart rate limit video scraping completed!

📁 Files saved to:
   • Videos: ./downloads
   • Metadata: ./metadata

💡 All videos are validated and corrupted files are removed.
🧠 Smart rate limiting helps avoid getting blocked.
🔄 Multiple sessions with smart backoff for better success rates.
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


