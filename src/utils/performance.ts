// Performance monitoring and optimization utilities

export interface PerformanceMetrics {
  videoLoadTime: number;
  connectionType: string;
  preloadCount: number;
  memoryUsage: number;
  cacheHitRate: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private videoLoadTimes: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Track video loading performance
  trackVideoLoad(videoId: string, startTime: number): void {
    const loadTime = Date.now() - startTime;
    this.videoLoadTimes.set(videoId, loadTime);
    
    // Log slow loading videos
    if (loadTime > 3000) {
      console.warn(`Slow video load detected: ${videoId} took ${loadTime}ms`);
    }
  }

  // Get average load time
  getAverageLoadTime(): number {
    const times = Array.from(this.videoLoadTimes.values());
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  // Track memory usage
  trackMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as PerformanceWithMemory).memory;
      return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    }
    return 0;
  }

  // Get connection type with enhanced detection
  getConnectionType(): string {
    const connection = (navigator as NavigatorWithConnection).connection || 
    (navigator as NavigatorWithConnection).mozConnection || 
    (navigator as NavigatorWithConnection).webkitConnection;
    
    if (connection) {
      let detectedType = connection.effectiveType || '4g';
      
      // Enhanced detection based on downlink speed
      if (connection.downlink) {
        if (connection.downlink < 0.5) detectedType = 'slow-2g';
        else if (connection.downlink < 1) detectedType = '2g';
        else if (connection.downlink < 2) detectedType = '3g';
        else if (connection.downlink < 10) detectedType = '4g';
        else detectedType = '5g';
      }
      
      return detectedType;
    }
    
    return '4g'; // Default fallback
  }

  // Get optimal preload count based on connection and performance
  getOptimalPreloadCount(): number {
    const connectionType = this.getConnectionType();
    const avgLoadTime = this.getAverageLoadTime();
    const memoryUsage = this.trackMemoryUsage();
    
    // Base preload count by connection
    const basePreload = {
      'slow-2g': 0,
      '2g': 0,
      '3g': 1,
      '4g': 2,
      '5g': 3,
      'default': 2
    }[connectionType] || 2;
    
    // Adjust based on performance
    let adjustedPreload = basePreload;
    
    // Reduce if videos are loading slowly
    if (avgLoadTime > 2000) {
      adjustedPreload = Math.max(0, adjustedPreload - 1);
    }
    
    // Reduce if memory usage is high
    if (memoryUsage > 0.8) {
      adjustedPreload = Math.max(0, adjustedPreload - 1);
    }
    
    // Increase if everything is performing well
    if (avgLoadTime < 1000 && memoryUsage < 0.5) {
      adjustedPreload = Math.min(3, adjustedPreload + 1);
    }
    
    return adjustedPreload;
  }

  // Clean up old metrics
  cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    // Clean up old video load times
    for (const [videoId, loadTime] of this.videoLoadTimes.entries()) {
      if (now - loadTime > maxAge) {
        this.videoLoadTimes.delete(videoId);
      }
    }
  }

  // Get performance report
  getPerformanceReport(): PerformanceMetrics {
    return {
      videoLoadTime: this.getAverageLoadTime(),
      connectionType: this.getConnectionType(),
      preloadCount: this.getOptimalPreloadCount(),
      memoryUsage: this.trackMemoryUsage(),
      cacheHitRate: 0 // This would be set by the API
    };
  }
}

// Video memory management utility
export class VideoMemoryManager {
  private static instance: VideoMemoryManager;
  private loadedVideos: Set<string> = new Set();
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  private cleanupDistance = 5;

  static getInstance(): VideoMemoryManager {
    if (!VideoMemoryManager.instance) {
      VideoMemoryManager.instance = new VideoMemoryManager();
    }
    return VideoMemoryManager.instance;
  }

  // Register a video element
  registerVideo(videoId: string, element: HTMLVideoElement): void {
    this.loadedVideos.add(videoId);
    this.videoElements.set(videoId, element);
  }

  // Unregister a video element
  unregisterVideo(videoId: string): void {
    this.loadedVideos.delete(videoId);
    this.videoElements.delete(videoId);
  }

  // Clean up videos that are far from current position
  cleanupDistantVideos(currentIndex: number, allVideos: string[]): void {
    const videosToCleanup: string[] = [];
    
    allVideos.forEach((videoId, index) => {
      if (Math.abs(index - currentIndex) > this.cleanupDistance) {
        videosToCleanup.push(videoId);
      }
    });
    
    videosToCleanup.forEach(videoId => {
      const element = this.videoElements.get(videoId);
      if (element) {
        // Clear video source to free memory
        element.src = '';
        element.load();
        
        // Remove from tracking
        this.unregisterVideo(videoId);
      }
    });
  }

  // Get memory usage info
  getMemoryInfo(): { loadedCount: number; totalElements: number } {
    return {
      loadedCount: this.loadedVideos.size,
      totalElements: this.videoElements.size
    };
  }

  // Force cleanup of all videos
  forceCleanup(): void {
    this.videoElements.forEach((element) => {
      element.src = '';
      element.load();
    });
    
    this.loadedVideos.clear();
    this.videoElements.clear();
  }
}

// Preload strategy based on connection and performance
export const PRELOAD_STRATEGY = {
  'slow-2g': 0,
  '2g': 0,
  '3g': 1,
  '4g': 2,
  '5g': 3,
  'default': 2
} as const;

// Video loading optimization
export class VideoLoader {
  private static instance: VideoLoader;
  private loadingVideos: Set<string> = new Set();
  private loadTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly LOAD_TIMEOUT = 15000; // 15 seconds - increased timeout
  private retryAttempts: Map<string, number> = new Map();
  private readonly MAX_RETRIES = 2;

  static getInstance(): VideoLoader {
    if (!VideoLoader.instance) {
      VideoLoader.instance = new VideoLoader();
    }
    return VideoLoader.instance;
  }

  // Load video with timeout and error handling
  async loadVideo(
    videoElement: HTMLVideoElement, 
    videoUrl: string, 
    videoId: string,
    onLoadStart?: () => void,
    onLoadComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.loadingVideos.has(videoId)) {
      return; // Already loading
    }

    this.loadingVideos.add(videoId);
    onLoadStart?.();

    // Set up timeout
    const timeout = setTimeout(() => {
      this.handleVideoError(videoId, videoElement, videoUrl, onError, 'timeout');
    }, this.LOAD_TIMEOUT);

    this.loadTimeouts.set(videoId, timeout);

    try {
      // Set up video element for optimal loading
      videoElement.preload = 'metadata';
      videoElement.crossOrigin = 'anonymous';
      
      // Add event listeners
      const handleCanPlay = () => {
        this.loadingVideos.delete(videoId);
        clearTimeout(timeout);
        this.loadTimeouts.delete(videoId);
        this.retryAttempts.delete(videoId);
        onLoadComplete?.();
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
        videoElement.removeEventListener('stalled', handleStalled);
      };
      
      const handleError = () => {
        this.handleVideoError(videoId, videoElement, videoUrl, onError, 'error');
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
        videoElement.removeEventListener('stalled', handleStalled);
      };
      
      const handleStalled = () => {
        console.warn(`Video stalled: ${videoId}`);
        // Don't immediately fail on stall, but start timeout
        setTimeout(() => {
          if (this.loadingVideos.has(videoId)) {
            this.handleVideoError(videoId, videoElement, videoUrl, onError, 'stalled');
          }
        }, 5000);
      };
      
      videoElement.addEventListener('canplay', handleCanPlay);
      videoElement.addEventListener('error', handleError);
      videoElement.addEventListener('stalled', handleStalled);
      
      // Set source and start loading
      videoElement.src = videoUrl;
      
    } catch (error) {
      this.handleVideoError(videoId, videoElement, videoUrl, onError, 'exception');
    }
  }

  private handleVideoError(
    videoId: string, 
    videoElement: HTMLVideoElement, 
    videoUrl: string, 
    onError?: (error: Error) => void,
    errorType: string = 'unknown'
  ): void {
    this.loadingVideos.delete(videoId);
    const timeout = this.loadTimeouts.get(videoId);
    if (timeout) {
      clearTimeout(timeout);
      this.loadTimeouts.delete(videoId);
    }

    const currentRetries = this.retryAttempts.get(videoId) || 0;
    
    if (currentRetries < this.MAX_RETRIES) {
      // Retry loading
      this.retryAttempts.set(videoId, currentRetries + 1);
      console.warn(`Retrying video load: ${videoId} (attempt ${currentRetries + 1}/${this.MAX_RETRIES})`);
      
      // Wait a bit before retrying
      setTimeout(() => {
        // Clear the video and try again
        videoElement.src = '';
        videoElement.load();
        
        setTimeout(() => {
          this.loadVideo(videoElement, videoUrl, videoId, undefined, undefined, onError);
        }, 1000);
      }, 2000);
    } else {
      // Max retries reached
      this.retryAttempts.delete(videoId);
      console.error(`Video failed to load after ${this.MAX_RETRIES} retries: ${videoId} (${errorType})`);
      onError?.(new Error(`Video load failed: ${videoId} (${errorType})`));
    }
  }

  // Check if video is currently loading
  isLoading(videoId: string): boolean {
    return this.loadingVideos.has(videoId);
  }

  // Cancel loading for a video
  cancelLoading(videoId: string): void {
    const timeout = this.loadTimeouts.get(videoId);
    if (timeout) {
      clearTimeout(timeout);
      this.loadTimeouts.delete(videoId);
    }
    this.loadingVideos.delete(videoId);
    this.retryAttempts.delete(videoId);
  }

  // Clean up all loading operations
  cleanup(): void {
    this.loadTimeouts.forEach(timeout => clearTimeout(timeout));
    this.loadTimeouts.clear();
    this.loadingVideos.clear();
    this.retryAttempts.clear();
  }
}

// Type definitions for browser APIs
interface PerformanceWithMemory extends Performance {
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    addEventListener?: (event: string, handler: () => void) => void;
    removeEventListener?: (event: string, handler: () => void) => void;
  };
  mozConnection?: {
    effectiveType?: string;
    downlink?: number;
    addEventListener?: (event: string, handler: () => void) => void;
    removeEventListener?: (event: string, handler: () => void) => void;
  };
  webkitConnection?: {
    effectiveType?: string;
    downlink?: number;
    addEventListener?: (event: string, handler: () => void) => void;
    removeEventListener?: (event: string, handler: () => void) => void;
  };
}

// Export singleton instances
export const performanceMonitor = PerformanceMonitor.getInstance();
export const videoMemoryManager = VideoMemoryManager.getInstance();
export const videoLoader = VideoLoader.getInstance();