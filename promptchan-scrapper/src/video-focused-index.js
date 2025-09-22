#!/usr/bin/env node

import VideoFocusedScraper from './video-focused-scraper.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            Video-Focused PromptChan Scraper                 ║
║                                                              ║
║  🎯 Target: 1000+ VIDEOS (not text items)                   ║
║  🔐 Manual login and navigation required                     ║
║  📥 Downloads ALL videos found                              ║
║  💾 Saves video metadata in JSON format                     ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting Video-Focused Scraper...'));
    console.log(chalk.yellow('\n📋 Instructions:'));
    console.log(chalk.yellow('   1. A browser window will open'));
    console.log(chalk.yellow('   2. Log in to promptchan.com manually'));
    console.log(chalk.yellow('   3. Navigate to the explore page'));
    console.log(chalk.yellow('   4. Wait 30 seconds for automatic scraping'));
    console.log(chalk.yellow('   5. The scraper will scroll extensively to find ALL videos'));
    console.log(chalk.yellow('   6. ALL videos will be downloaded automatically'));
    console.log(chalk.yellow('   7. Target: 1000+ actual video files\n'));

    const scraper = new VideoFocusedScraper();
    await scraper.run();

    console.log(chalk.green(`
🎉 Video-focused scraping completed!

📁 Files saved to:
   • Videos: ./downloads
   • Metadata: ./metadata

💡 Check the folders for downloaded videos and video metadata JSON files.
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


