#!/usr/bin/env node

import MassPromptChanScraper from './mass-scraper.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║              Mass PromptChan Scraper                         ║
║                                                              ║
║  🎯 Target: ALL 1,303 items (no filtering)                  ║
║  🔐 Manual login and navigation required                     ║
║  📥 Downloads videos automatically                           ║
║  💾 Saves ALL metadata in JSON format                       ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting Mass PromptChan Scraper...'));
    console.log(chalk.yellow('\n📋 Instructions:'));
    console.log(chalk.yellow('   1. A browser window will open'));
    console.log(chalk.yellow('   2. Log in to promptchan.com manually'));
    console.log(chalk.yellow('   3. Navigate to the explore page'));
    console.log(chalk.yellow('   4. Wait 30 seconds for automatic scraping'));
    console.log(chalk.yellow('   5. The scraper will scroll extensively to find ALL items'));
    console.log(chalk.yellow('   6. NO filtering will be applied - captures everything'));
    console.log(chalk.yellow('   7. Videos will be downloaded automatically\n'));

    const scraper = new MassPromptChanScraper();
    await scraper.run();

    console.log(chalk.green(`
🎉 Mass scraping completed!

📁 Files saved to:
   • Videos: ./downloads
   • Metadata: ./metadata

💡 Check the folders for downloaded videos and comprehensive metadata JSON files.
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


