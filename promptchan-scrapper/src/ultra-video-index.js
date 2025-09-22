#!/usr/bin/env node

import UltraVideoScraper from './ultra-video-scraper.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            Ultra Video PromptChan Scraper                    ║
║                                                              ║
║  🎯 Target: 1000+ VIDEOS (ultra-aggressive)                 ║
║  🔐 Manual login and navigation required                     ║
║  📥 Downloads ALL videos found                              ║
║  💾 Saves video metadata in JSON format                     ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting Ultra Video Scraper...'));
    console.log(chalk.yellow('\n📋 Instructions:'));
    console.log(chalk.yellow('   1. A browser window will open'));
    console.log(chalk.yellow('   2. Log in to promptchan.com manually'));
    console.log(chalk.yellow('   3. Navigate to the explore page'));
    console.log(chalk.yellow('   4. Wait 30 seconds for automatic scraping'));
    console.log(chalk.yellow('   5. The scraper will scroll ULTRA-aggressively'));
    console.log(chalk.yellow('   6. Up to 1000 scroll attempts to find 1000+ videos'));
    console.log(chalk.yellow('   7. Multiple scrolling strategies will be used'));
    console.log(chalk.yellow('   8. ALL videos will be downloaded automatically\n'));

    const scraper = new UltraVideoScraper();
    await scraper.run();

    console.log(chalk.green(`
🎉 Ultra video scraping completed!

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


