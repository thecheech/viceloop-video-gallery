#!/usr/bin/env node

import ValidatedVideoScraper from './validated-video-scraper.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            Validated Video PromptChan Scraper                ║
║                                                              ║
║  🧹 Cleans up corrupted and duplicate files                  ║
║  🎯 Target: 1000+ VALID VIDEOS (not corrupted)              ║
║  🔐 Manual login and navigation required                     ║
║  📥 Downloads with real-time validation                      ║
║  💾 Saves video metadata in JSON format                     ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting Validated Video Scraper...'));
    console.log(chalk.yellow('\n📋 Instructions:'));
    console.log(chalk.yellow('   1. A browser window will open'));
    console.log(chalk.yellow('   2. Log in to promptchan.com manually'));
    console.log(chalk.yellow('   3. Navigate to the explore page'));
    console.log(chalk.yellow('   4. Wait 30 seconds for automatic scraping'));
    console.log(chalk.yellow('   5. The scraper will clean up existing files first'));
    console.log(chalk.yellow('   6. Then download new videos with validation'));
    console.log(chalk.yellow('   7. Target: 1000+ VALID (non-corrupted) videos\n'));

    const scraper = new ValidatedVideoScraper();
    await scraper.run();

    console.log(chalk.green(`
🎉 Validated video scraping completed!

📁 Files saved to:
   • Videos: ./downloads
   • Metadata: ./metadata

💡 All videos are validated and corrupted files are removed.
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


