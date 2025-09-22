#!/usr/bin/env node

import PersistentVideoScraper from './persistent-video-scraper.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            Persistent Video PromptChan Scraper               ║
║                                                              ║
║  🧹 Cleans up corrupted and duplicate files                  ║
║  🎯 Target: 1000+ VALID VIDEOS (not corrupted)              ║
║  🔄 Multiple sessions until target is reached                ║
║  📜 Ultra-aggressive scrolling (2000 attempts)               ║
║  🔐 Manual login and navigation required                     ║
║  📥 Downloads with real-time validation                      ║
║  💾 Saves video metadata in JSON format                     ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting Persistent Video Scraper...'));
    console.log(chalk.yellow('\n📋 Instructions:'));
    console.log(chalk.yellow('   1. A browser window will open'));
    console.log(chalk.yellow('   2. Log in to promptchan.com manually'));
    console.log(chalk.yellow('   3. Navigate to the explore page'));
    console.log(chalk.yellow('   4. Wait 30 seconds for automatic scraping'));
    console.log(chalk.yellow('   5. The scraper will run multiple sessions'));
    console.log(chalk.yellow('   6. Each session will scroll aggressively'));
    console.log(chalk.yellow('   7. Target: 1000+ VALID (non-corrupted) videos'));
    console.log(chalk.yellow('   8. Will keep trying until target is reached\n'));

    const scraper = new PersistentVideoScraper();
    await scraper.run();

    console.log(chalk.green(`
🎉 Persistent video scraping completed!

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


