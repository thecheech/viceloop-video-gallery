#!/usr/bin/env node

import PromptChanScraper from './PromptChanScraper.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                    PromptChan Scraper                        ║
║                                                              ║
║  🎯 Scrapes videos and metadata from promptchan.com/explore  ║
║  🔐 Handles manual login authentication                      ║
║  📥 Downloads all videos automatically                       ║
║  💾 Saves metadata in JSON format                           ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting PromptChan Scraper...'));
    console.log(chalk.cyan('📁 Using default directories:'));
    console.log(chalk.cyan('   • Downloads: ./downloads'));
    console.log(chalk.cyan('   • Metadata: ./metadata'));
    console.log(chalk.yellow('\n🔐 A browser window will open for you to log in manually.'));
    console.log(chalk.yellow('   After logging in, the scraper will continue automatically.\n'));

    // Initialize scraper with default settings
    const scraper = new PromptChanScraper({
      downloadDir: './downloads',
      metadataDir: './metadata'
    });

    // Run the scraper
    await scraper.run();

    console.log(chalk.green(`
🎉 Scraping completed successfully!

📁 Files saved to:
   • Videos: ${answers.downloadDir}
   • Metadata: ${answers.metadataDir}

💡 You can now view the downloaded videos and metadata JSON files.
`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    
    if (error.message.includes('Login')) {
      console.log(chalk.yellow(`
💡 Login Tips:
   • Make sure you have an account on promptchan.com
   • Check your internet connection
   • Try logging in manually in your regular browser first
   • Ensure the login was successful before continuing
`));
    }
    
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Scraping interrupted by user'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n👋 Scraping terminated'));
  process.exit(0);
});

// Run the main function
main().catch(console.error);
