'use client';

import { useState } from 'react';
import { VideoFile } from '@/app/api/videos/route';
import { Play, Pause, Download, Calendar, HardDrive, FileVideo } from 'lucide-react';

interface VideoCardProps {
  video: VideoFile;
}

export default function VideoCard({ video }: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = video.url;
    link.download = video.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (date: Date | string) => {
    try {
      // Convert to Date object if it's not already
      const dateObj = date instanceof Date ? date : new Date(date);
      
      // Check if date is valid
      if (!dateObj || isNaN(dateObj.getTime())) {
        return 'Unknown date';
      }
      
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Video Container */}
      <div className="relative aspect-video bg-gray-100 group">
        {isPlaying ? (
          <video
            src={video.url}
            controls
            autoPlay
            className="w-full h-full object-cover"
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <div className="text-center">
              <FileVideo className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">{video.extension.toUpperCase()}</p>
            </div>
          </div>
        )}
        
        {/* Play Button Overlay */}
        {!isPlaying && (
          <button
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200"
          >
            <div className="bg-white bg-opacity-90 rounded-full p-3 group-hover:bg-opacity-100 transition-all duration-200">
              <Play className="h-6 w-6 text-gray-700 ml-1" />
            </div>
          </button>
        )}

        {/* Hover Actions */}
        {isHovered && !isPlaying && (
          <div className="absolute top-2 right-2 flex space-x-1">
            <button
              onClick={handleDownload}
              className="bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 transition-all duration-200"
              title="Download video"
            >
              <Download className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 text-sm mb-2 truncate" title={video.filename}>
          {video.filename}
        </h3>
        
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <HardDrive className="h-3 w-3" />
              <span>{video.sizeFormatted}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(video.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-3 flex space-x-2">
          <button
            onClick={handlePlayPause}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center space-x-1"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3 w-3" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                <span>Play</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleDownload}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center"
            title="Download video"
          >
            <Download className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
