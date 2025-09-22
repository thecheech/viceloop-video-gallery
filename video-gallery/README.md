# Video Gallery

A Next.js application to browse and manage scraped videos from the downloads folder.

## Features

- 🎥 **Video Gallery**: Browse all videos in a responsive grid layout
- 🔍 **Search**: Search videos by filename
- 📄 **Pagination**: Navigate through large collections of videos
- ▶️ **Video Player**: Built-in video player with play/pause controls
- 📥 **Download**: Download videos directly from the browser
- 📊 **Statistics**: View collection statistics and file information
- 📱 **Responsive**: Works on desktop, tablet, and mobile devices

## Getting Started

### Prerequisites

- Node.js 18+ 
- Videos in the `../downloads` folder

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
video-gallery/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── videos/route.ts          # API endpoint for fetching videos
│   │   │   └── video/[filename]/route.ts # API endpoint for serving video files
│   │   ├── globals.css                  # Global styles
│   │   ├── layout.tsx                   # Root layout
│   │   └── page.tsx                     # Main page component
│   └── components/
│       ├── VideoCard.tsx                # Individual video card component
│       ├── Pagination.tsx               # Pagination component
│       ├── SearchBar.tsx                # Search input component
│       └── StatsBar.tsx                 # Statistics display component
├── public/                              # Static assets
└── package.json
```

## API Endpoints

### GET /api/videos
Fetch paginated list of videos with optional search.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 12)
- `search` (string): Search query for filename filtering

**Response:**
```json
{
  "videos": [
    {
      "id": "video_1.mp4",
      "filename": "video_1.mp4",
      "size": 3145728,
      "sizeFormatted": "3.0 MB",
      "extension": ".mp4",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "url": "/api/video/video_1.mp4"
    }
  ],
  "total": 350,
  "page": 1,
  "totalPages": 30,
  "limit": 12
}
```

### GET /api/video/[filename]
Serve video file with proper headers for streaming.

**Parameters:**
- `filename` (string): Name of the video file

**Response:** Video file stream with appropriate content-type headers.

## Features in Detail

### Video Cards
- Hover to reveal play button
- Click to play/pause video
- Download button for each video
- File size and creation date display
- Responsive design

### Search
- Real-time search with debouncing
- Searches video filenames
- Clear search functionality

### Pagination
- Smart pagination with ellipsis for large page counts
- Previous/Next navigation
- Configurable items per page (6, 12, 24, 48)

### Statistics
- Total video count
- Storage usage estimate
- Last updated information

## Customization

### Styling
The app uses Tailwind CSS for styling. You can customize the appearance by modifying:
- `src/app/globals.css` for global styles
- Component files for component-specific styles

### Video Path
The app looks for videos in `../downloads` folder. To change this, modify the `downloadsPath` in:
- `src/app/api/videos/route.ts`
- `src/app/api/video/[filename]/route.ts`

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Lazy loading for video thumbnails
- Debounced search to reduce API calls
- Efficient pagination
- Optimized video streaming with proper headers

## Troubleshooting

### No videos showing
1. Check that the `../downloads` folder exists
2. Verify that video files are in the correct format (.mp4, .webm, .mov, etc.)
3. Check the browser console for any errors

### Videos not playing
1. Ensure video files are not corrupted
2. Check that the file format is supported by the browser
3. Verify file permissions

### Performance issues
1. Reduce the number of items per page
2. Use search to filter results
3. Check file sizes - very large files may take time to load