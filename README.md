# PromptChan Scraper

A powerful web scraper for downloading videos and extracting metadata from promptchan.com/explore.

## Features

- 🔐 **Manual Login Support**: Opens a browser window for you to log in manually
- 📥 **Video Downloads**: Automatically downloads all videos from the explore page
- 💾 **Metadata Extraction**: Captures prompts, titles, descriptions, and other metadata
- 📊 **JSON Export**: Saves all data in structured JSON format
- 🎯 **Smart Scrolling**: Automatically scrolls to load more content
- 🛡️ **Error Handling**: Robust error handling and retry mechanisms

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Quick Start

```bash
npm start
```

This will:
1. Open a browser window
2. Navigate to promptchan.com
3. Wait for you to log in manually
4. Scrape the explore page
5. Download all videos
6. Save metadata to JSON

### Manual Execution

```bash
node src/index.js
```

## Configuration

Edit `config.json` to customize:
- Download directories
- Browser settings
- CSS selectors for data extraction
- Timeout values

## Output Structure

### Downloads Directory
```
downloads/
├── video_title_1_video_1234567890.mp4
├── video_title_2_video_1234567891.mp4
└── ...
```

### Metadata Directory
```
metadata/
└── promptchan_metadata_2024-01-15T10-30-45-123Z.json
```

### JSON Metadata Format
```json
{
  "scrapedAt": "2024-01-15T10:30:45.123Z",
  "totalVideos": 25,
  "source": "https://promptchan.com/explore",
  "videos": [
    {
      "id": "video_0_1705312245123",
      "videoUrl": "https://example.com/video.mp4",
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "title": "Video Title",
      "description": "Video description",
      "prompt": "User prompt text",
      "metadata": {
        "timestamp": "2024-01-15T10:30:45.123Z",
        "elementIndex": 0,
        "className": "video-item",
        "likes": "42",
        "views": "1.2k",
        "comments": "8"
      },
      "scrapedAt": "2024-01-15T10:30:45.123Z",
      "localPath": "./downloads/video_title_video_1234567890.mp4",
      "downloadStatus": "success"
    }
  ]
}
```

## Requirements

- Node.js 16+ 
- Valid promptchan.com account
- Internet connection
- Sufficient disk space for video downloads

## Troubleshooting

### Login Issues
- Make sure you have a valid account on promptchan.com
- Try logging in manually in your regular browser first
- Check your internet connection
- Ensure the login was successful before continuing

### Download Issues
- Check available disk space
- Verify internet connection stability
- Some videos might be protected or require special permissions

### Scraping Issues
- The website structure might have changed
- Update selectors in `config.json` if needed
- Check browser console for errors

## Legal Notice

This tool is for educational purposes only. Please respect the website's terms of service and robots.txt. Only scrape content you have permission to access.

## License

MIT License - see LICENSE file for details.


