import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

class SizeBasedDuplicateRemover {
  constructor() {
    this.downloadDir = './downloads';
    this.duplicates = [];
    this.removedCount = 0;
    this.totalSize = 0;
  }

  async run() {
    try {
      console.log(chalk.blue('🔍 Starting size-based duplicate removal...'));
      
      // Get all files in downloads directory
      const files = await fs.readdir(this.downloadDir);
      const videoFiles = files.filter(file => 
        file.endsWith('.mp4') || 
        file.endsWith('.webm') || 
        file.endsWith('.mov') || 
        file.endsWith('.avi') || 
        file.endsWith('.mkv') || 
        file.endsWith('.flv') || 
        file.endsWith('.wmv')
      );

      console.log(chalk.cyan(`📁 Found ${videoFiles.length} video files to check`));

      // Group files by size
      const sizeGroups = {};
      
      for (const file of videoFiles) {
        const filePath = path.join(this.downloadDir, file);
        try {
          const stats = await fs.stat(filePath);
          const size = stats.size;
          
          if (!sizeGroups[size]) {
            sizeGroups[size] = [];
          }
          sizeGroups[size].push({
            filename: file,
            filepath: filePath,
            size: size
          });
        } catch (error) {
          console.log(chalk.red(`❌ Error reading ${file}: ${error.message}`));
        }
      }

      // Find duplicates (groups with more than 1 file)
      const duplicateGroups = Object.entries(sizeGroups).filter(([size, files]) => files.length > 1);
      
      console.log(chalk.yellow(`🔍 Found ${duplicateGroups.length} size groups with duplicates`));

      // Process each duplicate group
      for (const [size, files] of duplicateGroups) {
        console.log(chalk.blue(`\n📊 Size group: ${this.formatBytes(parseInt(size))} (${files.length} files)`));
        
        // Keep the first file, remove the rest
        const keepFile = files[0];
        const removeFiles = files.slice(1);
        
        console.log(chalk.green(`✅ Keeping: ${keepFile.filename}`));
        
        for (const file of removeFiles) {
          try {
            await fs.remove(file.filepath);
            console.log(chalk.red(`🗑️  Removed: ${file.filename}`));
            this.removedCount++;
            this.totalSize += file.size;
            
            this.duplicates.push({
              kept: keepFile.filename,
              removed: file.filename,
              size: file.size
            });
          } catch (error) {
            console.log(chalk.red(`❌ Error removing ${file.filename}: ${error.message}`));
          }
        }
      }

      // Summary
      console.log(chalk.green(`\n🎉 Duplicate removal completed!`));
      console.log(chalk.cyan(`📊 Summary:`));
      console.log(chalk.cyan(`   • Files checked: ${videoFiles.length}`));
      console.log(chalk.cyan(`   • Duplicate groups found: ${duplicateGroups.length}`));
      console.log(chalk.cyan(`   • Files removed: ${this.removedCount}`));
      console.log(chalk.cyan(`   • Space saved: ${this.formatBytes(this.totalSize)}`));
      
      // Show remaining files count
      const remainingFiles = await fs.readdir(this.downloadDir);
      const remainingVideoFiles = remainingFiles.filter(file => 
        file.endsWith('.mp4') || 
        file.endsWith('.webm') || 
        file.endsWith('.mov') || 
        file.endsWith('.avi') || 
        file.endsWith('.mkv') || 
        file.endsWith('.flv') || 
        file.endsWith('.wmv')
      );
      
      console.log(chalk.cyan(`   • Remaining unique videos: ${remainingVideoFiles.length}`));

      // Save duplicate report
      if (this.duplicates.length > 0) {
        await this.saveDuplicateReport();
      }

    } catch (error) {
      console.error(chalk.red('❌ Error during duplicate removal:'), error.message);
    }
  }

  async saveDuplicateReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `duplicate_removal_report_${timestamp}.json`;
    const filepath = path.join('./metadata', filename);

    const report = {
      removedAt: new Date().toISOString(),
      totalDuplicatesRemoved: this.removedCount,
      spaceSaved: this.totalSize,
      duplicates: this.duplicates
    };

    await fs.ensureDir('./metadata');
    await fs.writeJson(filepath, report, { spaces: 2 });
    console.log(chalk.green(`💾 Duplicate report saved to: ${filepath}`));
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default SizeBasedDuplicateRemover;

