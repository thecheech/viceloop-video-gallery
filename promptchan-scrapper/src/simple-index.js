#!/usr/bin/env node

import SimplePromptChanScraper from './simple-scraper.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                Simple PromptChan Scraper                     ║
║                                                              ║
║  🎯 Scrapes content from promptchan.com/explore              ║
║  🔐 Manual login and navigation required                     ║
║  💾 Saves metadata in JSON format                           ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting Simple PromptChan Scraper...'));
    console.log(chalk.yellow('\n📋 Instructions:'));
    console.log(chalk.yellow('   1. A browser window will open'));
    console.log(chalk.yellow('   2. Log in to promptchan.com manually'));
    console.log(chalk.yellow('   3. Navigate to the explore page'));
    console.log(chalk.yellow('   4. Press Enter in this terminal'));
    console.log(chalk.yellow('   5. The scraper will extract all visible content\n'));

    const scraper = new SimplePromptChanScraper();
    await scraper.run();

    console.log(chalk.green(`
🎉 Scraping completed!

📁 Files saved to:
   • Metadata: ./metadata

💡 Check the metadata JSON file for all extracted content.
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


