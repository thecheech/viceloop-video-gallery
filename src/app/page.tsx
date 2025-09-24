'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

interface Video {
  id: string;
  filename: string;
  size: number;
  sizeFormatted: string;
  extension: string;
  createdAt: string;
  url: string;
  profileImageUrl?: string;
  modelName?: string;
  verified?: boolean;
  postMessage?: string;
  hashtags?: string[];
  likes?: number;
  isLiked?: boolean;
}

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  // Removed isPlaying state - videos now always play without pause functionality
  // Removed banner state - using single DeepMode pill
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [showChatScreen, setShowChatScreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('4g');
  const [preloadRange, setPreloadRange] = useState(1); // How many videos to preload around current
  const [isExitingChat, setIsExitingChat] = useState(false); // Track when exiting chat screen
  const [isEnteringChat, setIsEnteringChat] = useState(false); // Track when entering chat screen
  const [hasUserInteracted, setHasUserInteracted] = useState(false); // Track first user interaction for mobile auto-play
  const [showPlayButton, setShowPlayButton] = useState(false); // Show tap-to-play button when auto-play fails
  const [videoCount, setVideoCount] = useState(0); // Track how many videos we've viewed
  const [showComments, setShowComments] = useState(false); // Show/hide comments section
  const [comments, setComments] = useState<Record<string, Array<{id: string, text: string, author: string, timestamp: number}>>>({}); // Comments for each video
  const [newComment, setNewComment] = useState(''); // New comment input
  const [videoLoadingStates, setVideoLoadingStates] = useState<Record<string, boolean>>({}); // Track which videos are loading
  const [currentPage, setCurrentPage] = useState(1); // Track current page for pagination
  const [hasMoreVideos, setHasMoreVideos] = useState(true); // Track if more videos are available
  const [currentBatch, setCurrentBatch] = useState(1); // Track current batch number
  const [batchSize] = useState(15); // Number of videos per batch
  const [batchThreshold] = useState(5); // Load next batch when this many videos remain in current batch
  const [allBatches, setAllBatches] = useState<Record<number, Video[]>>({}); // Store all loaded batches
  const [isLoadingNextBatch, setIsLoadingNextBatch] = useState(false); // Track if we're loading the next batch
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wheelLockRef = useRef<boolean>(false);
  const lastWheelAtRef = useRef<number>(0);
  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null); // For lazy loading

  // Removed banner messages - now using single DeepMode pill

  // Comment management functions
  const toggleComments = () => {
    setShowComments(prev => !prev);
  };

  const addComment = (videoId: string) => {
    if (newComment.trim()) {
      const comment = {
        id: Date.now().toString(),
        text: newComment.trim(),
        author: 'You',
        timestamp: Date.now()
      };
      
      setComments(prev => ({
        ...prev,
        [videoId]: [...(prev[videoId] || []), comment]
      }));
      
      setNewComment('');
    }
  };

  const getCommentCount = (videoId: string) => {
    return comments[videoId]?.length || 0;
  };

  // Video loading state management
  const setVideoLoading = (videoId: string, isLoading: boolean) => {
    if (!isLoading) {
      // Add a small delay before hiding the spinner to prevent flashing
      setTimeout(() => {
        setVideoLoadingStates(prev => ({
          ...prev,
          [videoId]: false
        }));
      }, 300);
    } else {
      setVideoLoadingStates(prev => ({
        ...prev,
        [videoId]: isLoading
      }));
    }
  };

  const isVideoLoading = (videoId: string) => {
    return videoLoadingStates[videoId] || false;
  };

  const safePlay = async (el: HTMLVideoElement | null) => {
    if (!el) return;
    try {
      await el.play();
    } catch (err: unknown) {
      // Show a tap-to-play overlay on first auto-play failure
      if (err instanceof Error && err.name === 'NotAllowedError' && !hasUserInteracted) {
        setShowPlayButton(true);
      }
    }
  };

  // Toggle like for a video
  const toggleLike = (videoId: string) => {
    setLikedVideos(prev => {
      const newLikedVideos = new Set(prev);
      if (newLikedVideos.has(videoId)) {
        newLikedVideos.delete(videoId);
      } else {
        newLikedVideos.add(videoId);
      }
      return newLikedVideos;
    });
  };

  // Detect connection type for optimized preloading
  useEffect(() => {
    const connection = (navigator as Navigator & { 
      connection?: { 
        effectiveType?: string;
        addEventListener?: (event: string, handler: () => void) => void;
        removeEventListener?: (event: string, handler: () => void) => void;
      } 
    }).connection || 
    (navigator as Navigator & { 
      mozConnection?: { 
        effectiveType?: string;
        addEventListener?: (event: string, handler: () => void) => void;
        removeEventListener?: (event: string, handler: () => void) => void;
      } 
    }).mozConnection || 
    (navigator as Navigator & { 
      webkitConnection?: { 
        effectiveType?: string;
        addEventListener?: (event: string, handler: () => void) => void;
        removeEventListener?: (event: string, handler: () => void) => void;
      } 
    }).webkitConnection;
    
    if (connection && connection.addEventListener) {
      setConnectionType(connection.effectiveType || '4g');
      const updateConnection = () => {
        setConnectionType(connection.effectiveType || '4g');
      };
      connection.addEventListener('change', updateConnection);
      return () => connection.removeEventListener?.('change', updateConnection);
    }
  }, []);

  // Adjust preload range based on connection type
  useEffect(() => {
    if (connectionType === 'slow-2g' || connectionType === '2g') {
      setPreloadRange(1); // Only preload adjacent video on slow connections
    } else if (connectionType === '3g') {
      setPreloadRange(1); // Only preload adjacent video on 3G too
    } else {
      setPreloadRange(1); // Only preload adjacent video on fast connections too
    }
  }, [connectionType]);

  // Fetch videos with batch loading
  const fetchVideos = useCallback(async (page: number, batchNumber: number) => {
    try {
      setIsLoadingNextBatch(true);
      const response = await fetch(`/api/videos?page=${page}&limit=${batchSize}`);
      const data = await response.json();

      if (data.videos.length === 0) {
        setHasMoreVideos(false);
        setIsLoadingNextBatch(false);
        return;
      }

      // Shuffle the videos array
      const shuffledVideos = [...data.videos].sort(() => Math.random() - 0.5);

      // Store videos in the specific batch
      setAllBatches(prev => ({
        ...prev,
        [batchNumber]: shuffledVideos
      }));

      // Initialize loading states for new videos
      const initialLoadingStates: Record<string, boolean> = {};
      shuffledVideos.forEach(video => {
        initialLoadingStates[video.id] = true; // Start with videos as loading
      });
      setVideoLoadingStates(prev => ({ ...prev, ...initialLoadingStates }));

      setIsLoadingNextBatch(false);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setIsLoadingNextBatch(false);
    }
  }, [batchSize]);

  // Helper function to get current batch videos
  const getCurrentBatchVideos = useCallback(() => {
    return allBatches[currentBatch] || [];
  }, [allBatches, currentBatch]);

  // Helper function to load next batch when needed
  const loadNextBatchIfNeeded = useCallback((currentVideoIndex: number) => {
    const currentBatchVideos = getCurrentBatchVideos();
    const videosInCurrentBatch = currentBatchVideos.length;

    // If we're within the threshold and have more videos available, load next batch
    if (currentVideoIndex >= videosInCurrentBatch - batchThreshold &&
        hasMoreVideos &&
        !isLoadingNextBatch &&
        !allBatches[currentBatch + 1]) {

      const nextBatchNumber = currentBatch + 1;
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchVideos(nextPage, nextBatchNumber);
    }
  }, [getCurrentBatchVideos, currentBatch, hasMoreVideos, isLoadingNextBatch, allBatches, currentPage, fetchVideos, batchThreshold]);

  // Initial fetch
  useEffect(() => {
    fetchVideos(1, 1);
    // Small delay to ensure video container is fully rendered before setting loading to false
    setTimeout(() => {
      setLoading(false);
    }, 100);
  }, [fetchVideos]);

  // Ensure touch events are properly set up after loading is complete
  useEffect(() => {
    if (!loading && !showChatScreen && !isEnteringChat && !isExitingChat && getCurrentBatchVideos().length > 0) {
      // Force re-render of touch event handlers after initial load or chat transitions
      const container = containerRef.current;
      if (container) {
        // Add a small delay to ensure DOM is fully updated
        setTimeout(() => {
          // This will trigger the touch event useEffect to re-run
          setCurrentVideoIndex(prev => prev);
        }, 50);
      }
    }
  }, [loading, showChatScreen, isEnteringChat, isExitingChat, getCurrentBatchVideos]);

  // Initialize sample comments for demonstration
  useEffect(() => {
    const currentBatchVideos = getCurrentBatchVideos();
    if (currentBatchVideos.length > 0) {
      const sampleComments = {
        [currentBatchVideos[0]?.id]: [
          {
            id: '1',
            text: 'Average\nNo ring?',
            author: 'Average',
            timestamp: Date.now() - 17 * 60000 // 17 minutes ago
          },
          {
            id: '2',
            text: 'I recognize that art style...',
            author: '-XyZen-xM',
            timestamp: Date.now() - 20 * 60000 // 20 minutes ago
          },
          {
            id: '3',
            text: 'pls make Roblox Catalog avatar creation plsss',
            author: 'Sebastian',
            timestamp: Date.now() - 15 * 60000 // 15 minutes ago
          },
          {
            id: '4',
            text: 'I came...',
            author: 'fwuffles',
            timestamp: Date.now() - 16 * 60000 // 16 minutes ago
          },
          {
            id: '5',
            text: 'I LOVE HOW YOU DREW SEBASTIAN[happy]',
            author: '-Frye★Anguilla-',
            timestamp: Date.now() - 31 * 60000 // 31 minutes ago
          },
          {
            id: '6',
            text: 'this is painter approved!!',
            author: 'p.AI.nter',
            timestamp: Date.now() - 12 * 60000 // 12 minutes ago
          }
        ]
      };
      setComments(sampleComments);
    }
  }, [videos]);

  // Intersection Observer for lazy loading next batch
  useEffect(() => {
    if (!hasMoreVideos || loading || isLoadingNextBatch) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreVideos) {
          loadNextBatchIfNeeded(currentVideoIndex);
        }
      },
      { threshold: 0.1 }
    );

    // Observe the last video element of current batch
    const currentBatchVideos = getCurrentBatchVideos();
    const lastVideoIndex = currentBatchVideos.length - 1;
    const lastVideoElement = containerRef.current?.querySelector(`.video-slide:nth-child(${lastVideoIndex + 1})`);
    if (lastVideoElement) {
      observer.observe(lastVideoElement);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [getCurrentBatchVideos, hasMoreVideos, loading, isLoadingNextBatch, currentVideoIndex, loadNextBatchIfNeeded]);

  // Help first video load on mobile devices
  useEffect(() => {
    const currentBatchVideos = getCurrentBatchVideos();
    if (currentBatchVideos.length > 0 && currentVideoIndex === 0) {
      const firstVideo = videoRefs.current[0];
      if (firstVideo) {
        // Small delay to ensure video element is ready, only if not already loaded
        setTimeout(() => {
          if (firstVideo.readyState < 3) { // Not loaded enough
            firstVideo.load();
          }
        }, 100);
      }
    }
  }, [getCurrentBatchVideos, currentVideoIndex]);

  // Handle play button click
  const handlePlayButtonClick = () => {
    setHasUserInteracted(true);
    setShowPlayButton(false);
    const currentVideo = videoRefs.current[currentVideoIndex];
    if (currentVideo) {
      safePlay(currentVideo);
    }
  };

  // Removed banner cycling - using single DeepMode pill

  // Handle scroll navigation (throttled, one step per gesture)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const now = performance.now();
      const minIntervalMs = 450;

      if (wheelLockRef.current && now - lastWheelAtRef.current < minIntervalMs) {
        return;
      }

      wheelLockRef.current = true;
      lastWheelAtRef.current = now;

      if (e.deltaY > 10) {
        const currentBatchVideos = getCurrentBatchVideos();
        const videosInCurrentBatch = currentBatchVideos.length;
        const newIndex = (currentVideoIndex + 1) % videosInCurrentBatch; // Loop back to 0 when reaching the end
        if (newIndex !== currentVideoIndex) {
          const newVideoCount = videoCount + 1;
          setVideoCount(newVideoCount);

          // Check if we should show chat screen every 5 videos BEFORE moving to next video
          if (newVideoCount % 5 === 0 && !showChatScreen) {
            // Show chat screen with current video model (the 5th video)
            setIsEnteringChat(true);
            if (newIndex < videosInCurrentBatch && videoRefs.current[newIndex]) {
              videoRefs.current[newIndex]!.preload = "auto";
            }
            // Show chat screen after a brief delay to allow preloading
            setTimeout(() => {
              setShowChatScreen(true);
              setIsEnteringChat(false);
            }, 200);
          } else {
            // Normal navigation
            setCurrentVideoIndex(newIndex);
            loadNextBatchIfNeeded(newIndex);
          }
        }
      } else if (e.deltaY < -10) {
        setCurrentVideoIndex(prev => Math.max(prev - 1, 0));
      }

      setTimeout(() => {
        wheelLockRef.current = false;
      }, minIntervalMs);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [getCurrentBatchVideos, currentVideoIndex, showChatScreen, videoCount, loadNextBatchIfNeeded]);

  // Handle video play with debounce to avoid AbortError (no pause functionality)
  useEffect(() => {

    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }

    const currentEl = videoRefs.current[currentVideoIndex] || null;
    if (!currentEl) return;

    // Always play the current video (no pause functionality)
    // Small delay to ensure DOM is ready before playing
    playTimeoutRef.current = setTimeout(() => {
      safePlay(currentEl);
    }, 200);

    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
    };
  }, [currentVideoIndex, showChatScreen, safePlay]);

  // Removed togglePlayPause function - videos now always play without pause functionality

  const goToNext = useCallback(() => {
    setHasUserInteracted(true);
    setShowPlayButton(false);
    const currentBatchVideos = getCurrentBatchVideos();
    const videosInCurrentBatch = currentBatchVideos.length;

    // Check if we're at the end of the current batch
    if (currentVideoIndex >= videosInCurrentBatch - 1) {
      // Move to next batch if it exists
      if (allBatches[currentBatch + 1]) {
        // Clean up current batch from memory (except keep current video temporarily for smooth transition)
        setTimeout(() => {
          setAllBatches(prev => {
            const newBatches = { ...prev };
            delete newBatches[currentBatch]; // Remove current batch from memory
            return newBatches;
          });
        }, 1000); // Clean up after 1 second to allow smooth transition

        setCurrentBatch(prev => prev + 1);
        setCurrentVideoIndex(0); // Start at first video of next batch

        // Load next batch if needed
        loadNextBatchIfNeeded(0);
      } else {
        // Load next batch
        loadNextBatchIfNeeded(currentVideoIndex);
        // Stay at current index until next batch loads
        return;
      }
    } else {
      const newIndex = currentVideoIndex + 1;
      const newVideoCount = videoCount + 1;
      setVideoCount(newVideoCount);

      // Show chat screen every 5 videos (only if not already showing)
      if (newVideoCount % 5 === 0 && !showChatScreen) {
        // Show chat screen with current video model (the 5th video)
        setIsEnteringChat(true);
        if (newIndex < videosInCurrentBatch && videoRefs.current[newIndex]) {
          videoRefs.current[newIndex]!.preload = "auto";
        }
        // Show chat screen after a brief delay to allow preloading
        setTimeout(() => {
          setShowChatScreen(true);
          setIsEnteringChat(false);
        }, 200);
      } else {
        // Normal navigation
        setCurrentVideoIndex(newIndex);
        loadNextBatchIfNeeded(newIndex);
      }
    }
  }, [currentVideoIndex, getCurrentBatchVideos, allBatches, currentBatch, videoCount, showChatScreen, loadNextBatchIfNeeded]);

  const goToPrevious = useCallback(() => {
    setHasUserInteracted(true);
    setShowPlayButton(false);

    // Check if we're at the beginning of the current batch
    if (currentVideoIndex === 0) {
      // Move to previous batch if it exists
      if (currentBatch > 1 && allBatches[currentBatch - 1]) {
        const prevBatch = currentBatch - 1;
        const prevBatchVideos = allBatches[prevBatch];
        if (prevBatchVideos) {
          // Clean up current batch from memory
          setTimeout(() => {
            setAllBatches(prev => {
              const newBatches = { ...prev };
              delete newBatches[currentBatch]; // Remove current batch from memory
              return newBatches;
            });
          }, 1000);

          setCurrentBatch(prevBatch);
          setCurrentVideoIndex(prevBatchVideos.length - 1); // Go to last video of previous batch
        }
      } else {
        // If no previous batch, just go to last video of current batch
        const currentBatchVideos = getCurrentBatchVideos();
        setCurrentVideoIndex(currentBatchVideos.length - 1);
      }
    } else {
      setCurrentVideoIndex(prev => prev - 1);
    }
  }, [currentVideoIndex, currentBatch, allBatches, getCurrentBatchVideos]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // If comments are showing, allow easy exit
      if (showComments) {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            setShowComments(false);
            break;
        }
        return;
      }

      // If chat screen is showing, allow easy exit
      if (showChatScreen) {
        switch (e.key) {
          case 'Escape':
          case 'ArrowUp':
          case 'ArrowDown':
          case ' ':
            e.preventDefault();
            setShowChatScreen(false);
            break;
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goToNext();
          break;
        // Removed spacebar pause functionality - videos now always play without pause
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [goToNext, goToPrevious, showChatScreen, showComments]);

  // Navigation functions that don't increment video count (for chat screen navigation)
  const navigateToNext = useCallback(() => {
    setHasUserInteracted(true);
    setShowPlayButton(false);
    setIsExitingChat(true);
    setIsTransitioning(true);
    const currentBatchVideos = getCurrentBatchVideos();
    const videosInCurrentBatch = currentBatchVideos.length;

    // Smooth transition without interrupting preloading
    setTimeout(() => {
      const nextIndex = (currentVideoIndex + 1) % videosInCurrentBatch;
      setCurrentVideoIndex(nextIndex);
      loadNextBatchIfNeeded(nextIndex);
      setTimeout(() => {
        setIsTransitioning(false);
        setIsExitingChat(false);
      }, 300);
    }, 100);
  }, [getCurrentBatchVideos, currentVideoIndex, loadNextBatchIfNeeded]);

  const navigateToPrevious = useCallback(() => {
    setHasUserInteracted(true);
    setShowPlayButton(false);
    setIsExitingChat(true);
    setIsTransitioning(true);
    const currentBatchVideos = getCurrentBatchVideos();
    const videosInCurrentBatch = currentBatchVideos.length;

    // Smooth transition without interrupting preloading
    setTimeout(() => {
      const prevIndex = currentVideoIndex === 0 ? videosInCurrentBatch - 1 : currentVideoIndex - 1;
      setCurrentVideoIndex(prevIndex);
      setTimeout(() => {
        setIsTransitioning(false);
        setIsExitingChat(false);
      }, 300);
    }, 100);
  }, [getCurrentBatchVideos, currentVideoIndex]);

  // Handle swipe gestures for regular video navigation
  useEffect(() => {
    // Don't add touch handlers when chat screen is showing or during transitions
    if (showChatScreen || loading || isEnteringChat || isExitingChat) return;

    let startY = 0;
    let startTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      // Only track touches on the video container, navigation areas, or when no specific target is found
      const target = e.target as HTMLElement;
      if (target.closest('.video-feed') || target.closest('.nav-controls') || !target.closest('video')) {
        startY = e.touches[0].clientY;
        startTime = Date.now();
        console.log('👆 Touch started on:', target.className || target.tagName);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!startY) return;

      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();
      const deltaY = startY - endY;
      const deltaTime = endTime - startTime;

      // Only register swipe if it's quick enough and has enough distance
      if (deltaTime < 400 && Math.abs(deltaY) > 30) {
        // Prevent default to avoid scrolling interference
        e.preventDefault();
        console.log('📱 Swipe detected:', deltaY > 0 ? 'up' : 'down', 'deltaY:', deltaY, 'deltaTime:', deltaTime);

        if (deltaY > 0) {
          // Swipe up - go to next video (batch-aware navigation)
          goToNext();
        } else {
          // Swipe down - go to previous video
          goToPrevious();
        }
      } else {
        console.log('❌ Swipe too slow or too short:', deltaTime, Math.abs(deltaY));
      }

      startY = 0;
      startTime = 0;
    };

    const container = containerRef.current;
    if (container) {
      console.log('🎯 Attaching touch events for video navigation');
      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    return () => {
      if (container) {
        console.log('🧹 Removing touch events for video navigation');
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [goToNext, goToPrevious, showChatScreen, loading, isEnteringChat, isExitingChat, getCurrentBatchVideos, currentVideoIndex]);

  // Handle swipe gestures for chat screen
  useEffect(() => {
    if (!showChatScreen) return;

    let startY = 0;
    let startTime = 0;

    const handleChatTouchStart = (e: TouchEvent) => {
      // Only track touches on the chat screen
      const target = e.target as HTMLElement;
      if (target.closest('.chat-screen')) {
        startY = e.touches[0].clientY;
        startTime = Date.now();
      }
    };

    const handleChatTouchEnd = (e: TouchEvent) => {
      if (!startY) return;

      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();
      const deltaY = startY - endY;
      const deltaTime = endTime - startTime;
      const currentBatchVideos = getCurrentBatchVideos();
      const videosInCurrentBatch = currentBatchVideos.length;

      // Only register swipe if it's quick enough and has enough distance
      if (deltaTime < 400 && Math.abs(deltaY) > 30) {
        // Prevent default to avoid scrolling interference
        e.preventDefault();

        if (deltaY > 0) {
          // Swipe up - go to next video (batch-aware navigation)
          setShowChatScreen(false);
          const nextIndex = (currentVideoIndex + 1) % videosInCurrentBatch;
          setCurrentVideoIndex(nextIndex);
          loadNextBatchIfNeeded(nextIndex);
        } else {
          // Swipe down - go to previous video (batch-aware navigation)
          setShowChatScreen(false);
          const prevIndex = currentVideoIndex === 0 ? videosInCurrentBatch - 1 : currentVideoIndex - 1;
          setCurrentVideoIndex(prevIndex);
        }
      }

      startY = 0;
      startTime = 0;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleChatTouchStart, { passive: false });
      container.addEventListener('touchend', handleChatTouchEnd, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleChatTouchStart);
        container.removeEventListener('touchend', handleChatTouchEnd);
      }
    };
  }, [showChatScreen, getCurrentBatchVideos, currentVideoIndex, loadNextBatchIfNeeded]);

  // Auto-timeout for chat screen to prevent getting stuck
  useEffect(() => {
    if (showChatScreen) {
      // Clear any existing timeout
      if (chatTimeoutRef.current) {
        clearTimeout(chatTimeoutRef.current);
      }

      // Set auto-timeout to exit chat screen after 10 seconds
      chatTimeoutRef.current = setTimeout(() => {
        setShowChatScreen(false);
      }, 10000);

      return () => {
        if (chatTimeoutRef.current) {
          clearTimeout(chatTimeoutRef.current);
        }
      };
    }
  }, [showChatScreen]);

  // Reset pagination and observer on page changes (for debugging pagination issues)
  useEffect(() => {
    // Disconnect and reconnect observer when currentVideoIndex changes significantly
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Re-observe the last video element after updates
    setTimeout(() => {
      if (observerRef.current && hasMoreVideos) {
        const lastVideoElement = containerRef.current?.querySelector('.video-slide:last-child');
        if (lastVideoElement) {
          observerRef.current.observe(lastVideoElement);
        }
      }
    }, 100);
  }, [currentVideoIndex, getCurrentBatchVideos]);

  const currentBatchVideos = getCurrentBatchVideos();

  if (loading && currentBatchVideos.length === 0) {
    return (
      <div className="viceloop-loading">
        <div className="viceloop-loading-content">
          <h1 className="viceloop-loading-title">ViceLoop is Loading</h1>
          <div className="viceloop-loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  if (currentBatchVideos.length === 0 && !hasMoreVideos) {
    return (
      <div className="empty-state">
        <h3>No videos found</h3>
        <p>Upload some videos to see them here!</p>
      </div>
    );
  }

  // Show chat screen every 5 videos
  if (showChatScreen && getCurrentBatchVideos().length > 0) {
    const currentVideo = getCurrentBatchVideos()[currentVideoIndex];
    return (
      <div 
        className="chat-screen"
        onClick={() => window.open('https://clonella.com', '_blank')}
      >
        <div className="chat-screen-content">
          <div className="chat-model-info">
            <div className="chat-profile-image">
              <div className="chat-profile-ring">
                <Image 
                  src={currentVideo.profileImageUrl || "/viceloop-logo.jpg"} 
                  alt="profile picture" 
                  width={140}
                  height={140}
                  className="chat-profile-pic"
                />
              </div>
              <div className="chat-live-indicator">
                <div className="chat-live-dot"></div>
                <span>Online Now</span>
              </div>
            </div>
            
            <div className="chat-model-details">
              <div className="chat-username-row">
                <h2 className="chat-model-name">@{currentVideo.modelName || 'Unknown Model'}</h2>
                {currentVideo.verified && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DA1F2" className="chat-verified-badge">
                    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.47 0-.92.082-1.33.23C14.412 2.58 13.26 2 12 2s-2.412.58-3.25 1.33C8.34 3.082 7.89 3 7.42 3c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.875 9.55 1 10.92 1 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .47 0 .92-.082 1.33-.23C9.588 21.42 10.74 22 12 22s2.412-.58 3.25-1.33c.41.148.86.23 1.33.23 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4C21.625 15.45 22.5 14.08 22.5 12.5zM12 17.5c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
                    <path d="M12 6.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"/>
                  </svg>
                )}
              </div>
              {currentVideo.verified && (
                <div className="chat-verified-text">Trusted creator on Clonella</div>
              )}
            </div>
          </div>
          
            <div className="chat-message">
              <h1 className="chat-title">She&apos;s free to chat. Don&apos;t miss your chance!</h1>
            </div>

          <div className="chat-actions">
            <a 
              href="https://clonella.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="chat-button chat-cta-button"
            >
              <span className="chat-button-text">Chat Now</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="chat-arrow">
                <path d="M8.59 16.59L13.17 12L8.59 7.41L10 6l6 6-6 6-1.41-1.41z"/>
              </svg>
            </a>
          </div>
        </div>
        
        {/* Navigation arrows for chat screen */}
        <div className="nav-controls">
          <button
            className="nav-btn nav-up"
            onClick={(e) => {
              e.stopPropagation();
              setShowChatScreen(false);
              // Always allow going back (batch-aware navigation)
              goToPrevious();
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
            </svg>
          </button>
          
          <button
            className="nav-btn nav-down"
            onClick={(e) => {
              e.stopPropagation();
              setShowChatScreen(false);
              // Always allow going forward (batch-aware navigation)
              goToNext();
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tiktok-container" ref={containerRef}>
      {/* DeepMode Pill */}
      <div className="deepmode-pill-top">
        <a 
          href="https://deepmode.com"
          target="_blank"
          rel="noopener noreferrer"
          className="deepmode-link"
        >
          <span className="created-text">Created with</span>
          <span className="deepmode-text">DeepMode</span>
        </a>
      </div>

      {/* Video Feed */}
      <div
        className="video-feed"
        style={{
          transform: `translateY(-${currentVideoIndex * 100}dvh)`
        }}
      >
        {getCurrentBatchVideos().map((video, index) => (
          <div key={video.id} className={`video-slide ${isTransitioning ? 'transitioning' : ''}`}>
            <video
              ref={el => { videoRefs.current[index] = el; }}
              src={video.url}
              className="video-player"
              loop
              muted
              playsInline
              preload={
                isExitingChat
                  ? (index === currentVideoIndex + 1 ? "auto" : "none")
                  : isEnteringChat
                    ? (index === currentVideoIndex + 1 ? "auto" : "none")
                    : Math.abs(index - currentVideoIndex) <= preloadRange
                      ? (connectionType === 'slow-2g' || connectionType === '2g' ? "metadata" : "auto")
                      : "none"
              }
              // Removed onClick handler - videos now always play without pause functionality
              onLoadStart={() => {
                setVideoLoading(video.id, true);
              }}
              onLoadedData={() => {
                setVideoLoading(video.id, false);
                if (index === currentVideoIndex && !isTransitioning) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onLoadedMetadata={() => {
                if (index === currentVideoIndex && !isTransitioning) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onCanPlay={() => {
                setVideoLoading(video.id, false);
                if (index === currentVideoIndex && !isTransitioning) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onCanPlayThrough={() => {
                setVideoLoading(video.id, false);
                if (index === currentVideoIndex && !isTransitioning) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onWaiting={() => {
                setVideoLoading(video.id, true);
              }}
              onPlaying={() => {
                setVideoLoading(video.id, false);
              }}
              onError={() => {
                setVideoLoading(video.id, false);
              }}
              onStalled={() => {
                setVideoLoading(video.id, true);
              }}
            />
            
            {/* Video Loading Spinner - Don't show when video is playing in loop */}
            {(() => {
              const videoElement = videoRefs.current[index];
              return isVideoLoading(video.id) && index === currentVideoIndex && videoElement && videoElement.paused && videoElement.readyState < 3;
            })() && (
              <div className="video-loading-spinner-overlay">
                <div className="video-loading-spinner-container">
                  <div className="video-loading-spinner-ring"></div>
                  <div className="video-loading-spinner-ring"></div>
                  <div className="video-loading-spinner-ring"></div>
                </div>
              </div>
            )}
            
            {isTransitioning && index === currentVideoIndex && (
              <div className="transition-overlay">
                <div className="transition-spinner"></div>
              </div>
            )}

             {/* ViceLoop Play Button - Mobile */}
             {showPlayButton && index === currentVideoIndex && (
               <div className="viceloop-play-overlay" onClick={handlePlayButtonClick}>
                 <div className="viceloop-play-button">
                   <div className="play-button-core">
                     <div className="play-icon-minimal">
                       <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                         <path d="M8 5v14l11-7z"/>
                       </svg>
                     </div>
                     <div className="play-ring-minimal"></div>
                     <div className="play-pulse-minimal"></div>
                   </div>
                 </div>
               </div>
             )}
            
            {/* Video overlay UI */}
            <div className="video-overlay">
              {/* Removed Play/Pause indicator - videos now always play without pause functionality */}

              {/* Bottom info section */}
              <div className="bottom-section">
                {/* Left side - video info - clickable link to clonella.com */}
                <a 
                  href="https://clonella.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="video-info-link"
                >
                  <div className="video-info">
                    <div className="user-profile">
                      <div className="profile-image-small">
                        <Image 
                          src={video.profileImageUrl || "/viceloop-logo.jpg"} 
                          alt="profile picture" 
                          width={40}
                          height={40}
                          className="profile-pic-small"
                        />
                      </div>
                      <div className="user-details">
                        <div className="username">
                          @{video.modelName || 'unknownmodel'}
                          {video.verified && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DA1F2" className="verified-badge">
                              <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.47 0-.92.082-1.33.23C14.412 2.58 13.26 2 12 2s-2.412.58-3.25 1.33C8.34 3.082 7.89 3 7.42 3c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.875 9.55 1 10.92 1 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .47 0 .92-.082 1.33-.23C9.588 21.42 10.74 22 12 22s2.412-.58 3.25-1.33c.41.148.86.23 1.33.23 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4C21.625 15.45 22.5 14.08 22.5 12.5zM12 17.5c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
                              <path d="M12 6.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="description">
                      {video.postMessage || 'Check out my latest video! 🔥'}
                    </div>
                    <div className="hashtags">
                      {video.hashtags?.map((tag, tagIndex) => (
                        <span key={tagIndex} className="hashtag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </a>

                {/* Right side - action buttons */}
                <div className="action-buttons">
                  <div className="social-buttons">
                    <button 
                      className="action-btn"
                      onClick={() => toggleLike(video.id)}
                    >
                      <svg 
                        width="32" 
                        height="32" 
                        viewBox="0 0 24 24" 
                        fill={likedVideos.has(video.id) ? "#ff4757" : "white"}
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                      <span>{likedVideos.has(video.id) ? (video.likes || 0) + 1 : video.likes || 0}</span>
                    </button>
                    
                    <button 
                      className="action-btn"
                      onClick={() => toggleComments()}
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                        <path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                      </svg>
                      <span>{getCommentCount(video.id)}</span>
                    </button>
                    
                    <button className="action-btn">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
                      </svg>
                      <span>Share</span>
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator for more videos */}
        {isLoadingNextBatch && (
          <div className="loading-more-videos">
            <div className="video-loading-spinner-container">
              <div className="video-loading-spinner-ring"></div>
              <div className="video-loading-spinner-ring"></div>
              <div className="video-loading-spinner-ring"></div>
            </div>
          </div>
        )}
      </div>

      {/* TikTok-style Comments Side Panel */}
      {showComments && getCurrentBatchVideos().length > 0 && (
        <div 
          className="tiktok-comments-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowComments(false);
            }
          }}
        >
          <div className="tiktok-comments-panel">
            <div className="tiktok-comments-header">
              <h3 className="tiktok-comments-title">Comments ({getCommentCount(getCurrentBatchVideos()[currentVideoIndex]?.id)})</h3>
              <button 
                className="tiktok-comments-close"
                onClick={() => setShowComments(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <div className="tiktok-comments-list">
              {comments[getCurrentBatchVideos()[currentVideoIndex]?.id]?.map((comment) => (
                <div key={comment.id} className="tiktok-comment-item">
                  <div className="tiktok-comment-avatar">
                    <div className="tiktok-avatar-circle">
                      {comment.author.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  
                  <div className="tiktok-comment-content">
                    <div className="tiktok-comment-header">
                      <span className="tiktok-comment-username">{comment.author}</span>
                      <span className="tiktok-comment-timestamp">
                        {(() => {
                          const now = Date.now();
                          const diff = now - comment.timestamp;
                          const minutes = Math.floor(diff / 60000);
                          const hours = Math.floor(minutes / 60);
                          const days = Math.floor(hours / 24);
                          
                          if (days > 0) return `${days}d`;
                          if (hours > 0) return `${hours}h`;
                          if (minutes > 0) return `${minutes}m`;
                          return 'now';
                        })()}
                      </span>
                    </div>
                    
                    <div className="tiktok-comment-text">{comment.text}</div>
                    
                    <div className="tiktok-comment-actions">
                      <button className="tiktok-comment-reply">Reply</button>
                      <button className="tiktok-comment-like">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                        <span className="tiktok-like-count">{Math.floor(Math.random() * 10)}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {(!comments[getCurrentBatchVideos()[currentVideoIndex]?.id] || comments[getCurrentBatchVideos()[currentVideoIndex]?.id].length === 0) && (
                <div className="tiktok-no-comments">
                  <div className="tiktok-no-comments-text">No comments yet.</div>
                  <div className="tiktok-no-comments-subtext">Be the first to comment!</div>
                </div>
              )}
            </div>
            
            <div className="tiktok-comments-input">
              <div className="tiktok-input-container">
                <input
                  type="text"
                  placeholder="Add comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addComment(getCurrentBatchVideos()[currentVideoIndex]?.id);
                    }
                  }}
                  className="tiktok-comment-input"
                />
                <div className="tiktok-input-actions">
                  <button className="tiktok-emoji-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </button>
                  <button
                    className="tiktok-post-btn"
                    onClick={() => addComment(getCurrentBatchVideos()[currentVideoIndex]?.id)}
                    disabled={!newComment.trim()}
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation controls */}
      <div className="nav-controls">
        <button
          className="nav-btn nav-up"
          onClick={goToPrevious}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
          </svg>
        </button>
        
        <button
          className="nav-btn nav-down"
          onClick={goToNext}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
          </svg>
        </button>
      </div>

    </div>
  );
}