import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

class VideoCleanup {
  constructor() {
    this.downloadDir = './downloads';
    this.corruptedFiles = [];
    this.duplicateFiles = [];
    this.validFiles = [];
  }

  async run() {
    console.log(chalk.blue('🧹 Starting video cleanup and validation...'));
    
    try {
      // Get all files in downloads directory
      const files = await fs.readdir(this.downloadDir);
      console.log(chalk.cyan(`📁 Found ${files.length} files to check`));

      // Check each file
      for (const file of files) {
        const filePath = path.join(this.downloadDir, file);
        await this.checkFile(filePath);
      }

      // Remove corrupted files
      await this.removeCorruptedFiles();
      
      // Remove duplicates
      await this.removeDuplicates();
      
      // Report results
      this.reportResults();

    } catch (error) {
      console.error(chalk.red('❌ Cleanup failed:'), error.message);
    }
  }

  async checkFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      
      // Check if file is corrupted (0 bytes or very small)
      if (stats.size === 0) {
        this.corruptedFiles.push({ path: filePath, reason: 'Empty file (0 bytes)' });
        return;
      }

      // Check if file is too small to be a valid video (less than 1KB)
      if (stats.size < 1024) {
        this.corruptedFiles.push({ path: filePath, reason: `Too small (${stats.size} bytes)` });
        return;
      }

      // Check file extension
      const ext = path.extname(fileName).toLowerCase();
      const validExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
      
      if (!validExtensions.includes(ext)) {
        this.corruptedFiles.push({ path: filePath, reason: `Invalid video extension: ${ext}` });
        return;
      }

      // Check for duplicates based on file size and name pattern
      const fileKey = `${stats.size}-${fileName.split('_')[1]}`; // Use size + middle part of filename
      
      if (this.validFiles.find(f => f.key === fileKey)) {
        this.duplicateFiles.push({ path: filePath, reason: 'Duplicate file' });
        return;
      }

      // File is valid
      this.validFiles.push({
        path: filePath,
        size: stats.size,
        key: fileKey,
        name: fileName
      });

    } catch (error) {
      this.corruptedFiles.push({ path: filePath, reason: `Error reading file: ${error.message}` });
    }
  }

  async removeCorruptedFiles() {
    console.log(chalk.yellow(`🗑️  Removing ${this.corruptedFiles.length} corrupted files...`));
    
    for (const file of this.corruptedFiles) {
      try {
        await fs.remove(file.path);
        console.log(chalk.red(`❌ Deleted: ${path.basename(file.path)} (${file.reason})`));
      } catch (error) {
        console.error(chalk.red(`Failed to delete ${file.path}:`), error.message);
      }
    }
  }

  async removeDuplicates() {
    console.log(chalk.yellow(`🗑️  Removing ${this.duplicateFiles.length} duplicate files...`));
    
    for (const file of this.duplicateFiles) {
      try {
        await fs.remove(file.path);
        console.log(chalk.red(`❌ Deleted: ${path.basename(file.path)} (${file.reason})`));
      } catch (error) {
        console.error(chalk.red(`Failed to delete ${file.path}:`), error.message);
      }
    }
  }

  reportResults() {
    console.log(chalk.green('\n📊 Cleanup Results:'));
    console.log(chalk.green(`✅ Valid videos: ${this.validFiles.length}`));
    console.log(chalk.red(`❌ Corrupted files removed: ${this.corruptedFiles.length}`));
    console.log(chalk.yellow(`🔄 Duplicate files removed: ${this.duplicateFiles.length}`));
    
    // Show file size distribution
    const totalSize = this.validFiles.reduce((sum, file) => sum + file.size, 0);
    const avgSize = this.validFiles.length > 0 ? Math.round(totalSize / this.validFiles.length) : 0;
    
    console.log(chalk.cyan(`📏 Total size: ${this.formatBytes(totalSize)}`));
    console.log(chalk.cyan(`📏 Average file size: ${this.formatBytes(avgSize)}`));
    
    // Show size distribution
    const sizeRanges = {
      'Very Small (<1MB)': 0,
      'Small (1-10MB)': 0,
      'Medium (10-50MB)': 0,
      'Large (50-100MB)': 0,
      'Very Large (>100MB)': 0
    };
    
    this.validFiles.forEach(file => {
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB < 1) sizeRanges['Very Small (<1MB)']++;
      else if (sizeMB < 10) sizeRanges['Small (1-10MB)']++;
      else if (sizeMB < 50) sizeRanges['Medium (10-50MB)']++;
      else if (sizeMB < 100) sizeRanges['Large (50-100MB)']++;
      else sizeRanges['Very Large (>100MB)']++;
    });
    
    console.log(chalk.blue('\n📈 Size Distribution:'));
    Object.entries(sizeRanges).forEach(([range, count]) => {
      if (count > 0) {
        console.log(chalk.blue(`   ${range}: ${count} files`));
      }
    });
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getValidVideoCount() {
    return this.validFiles.length;
  }
}

export default VideoCleanup;


