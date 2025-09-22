#!/usr/bin/env node

import SizeBasedDuplicateRemover from './size-based-duplicate-remover.js';
import chalk from 'chalk';

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            Size-Based Duplicate Video Remover                ║
║                                                              ║
║  🔍 Finds videos with identical file sizes                   ║
║  🗑️  Removes duplicates (keeps first occurrence)            ║
║  📊 Reports space saved and files removed                    ║
║  💾 Saves detailed duplicate report                          ║
╚══════════════════════════════════════════════════════════════╝
`));

async function main() {
  try {
    console.log(chalk.blue('🚀 Starting size-based duplicate removal...'));
    console.log(chalk.yellow('\n📋 This will:'));
    console.log(chalk.yellow('   1. Scan all video files in ./downloads'));
    console.log(chalk.yellow('   2. Group files by exact byte size'));
    console.log(chalk.yellow('   3. Remove duplicates (keep first occurrence)'));
    console.log(chalk.yellow('   4. Report space saved and files removed\n'));

    const remover = new SizeBasedDuplicateRemover();
    await remover.run();

    console.log(chalk.green(`
🎉 Duplicate removal completed!

📁 Check ./metadata for detailed duplicate report
💡 All videos with identical file sizes have been deduplicated
`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);

