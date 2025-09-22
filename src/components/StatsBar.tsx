'use client';

import { HardDrive, Video, Calendar, FileVideo } from 'lucide-react';

interface StatsBarProps {
  totalVideos: number;
}

export default function StatsBar({ totalVideos }: StatsBarProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Video className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Total Videos</p>
            <p className="text-2xl font-bold text-gray-900">{totalVideos.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <FileVideo className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Unique Files</p>
            <p className="text-2xl font-bold text-gray-900">{totalVideos.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <HardDrive className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Storage Used</p>
            <p className="text-2xl font-bold text-gray-900">~938 MB</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Calendar className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Last Updated</p>
            <p className="text-2xl font-bold text-gray-900">Today</p>
          </div>
        </div>
      </div>
    </div>
  );
}



