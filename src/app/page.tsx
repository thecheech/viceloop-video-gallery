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
  const [isPlaying, setIsPlaying] = useState(true);
  // Removed banner state - using single DeepMode pill
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [showChatScreen, setShowChatScreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('4g');
  const [preloadRange, setPreloadRange] = useState(1); // How many videos to preload around current
  const [isExitingChat, setIsExitingChat] = useState(false); // Track when exiting chat screen
  const [isEnteringChat, setIsEnteringChat] = useState(false); // Track when entering chat screen
  const [videoCount, setVideoCount] = useState(0); // Track how many videos we've viewed
  const [showComments, setShowComments] = useState(false); // Show/hide comments section
  const [comments, setComments] = useState<Record<string, Array<{id: string, text: string, author: string, timestamp: number}>>>({}); // Comments for each video
  const [newComment, setNewComment] = useState(''); // New comment input
  const [videoLoadingStates, setVideoLoadingStates] = useState<Record<string, boolean>>({}); // Track which videos are loading
  const [videoLoadedStates, setVideoLoadedStates] = useState<Record<string, boolean>>({}); // Track which videos have loaded at least once
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wheelLockRef = useRef<boolean>(false);
  const lastWheelAtRef = useRef<number>(0);
  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Removed banner messages - now using single DeepMode pill

  // Comment management functions
  const toggleComments = () => {
    setShowComments(prev => !prev);
  };

  const addComment = (videoId: string) => {
    if (newComment.trim()) {
      const comment = {
        id: typeof window !== 'undefined' ? Date.now().toString() : Math.random().toString(),
        text: newComment.trim(),
        author: 'You',
        timestamp: typeof window !== 'undefined' ? Date.now() : Date.now()
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
      // Only show loading spinner if video hasn't loaded yet (prevent spinner during loops)
      const hasLoaded = videoLoadedStates[videoId] || false;
      if (!hasLoaded) {
        setVideoLoadingStates(prev => ({
          ...prev,
          [videoId]: isLoading
        }));
      }
    }
  };

  const isVideoLoading = (videoId: string) => {
    return videoLoadingStates[videoId] || false;
  };

  const setVideoLoaded = (videoId: string, hasLoaded: boolean) => {
    setVideoLoadedStates(prev => ({
      ...prev,
      [videoId]: hasLoaded
    }));
  };

  const safePlay = useCallback(async (el: HTMLVideoElement | null) => {
    if (!el) return;
    try {
      await el.play();
    } catch (err: unknown) {
      // Videos should autoplay without user interaction
      console.warn('Video play failed:', err);
    }
  }, []);

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

  // Fetch videos
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch('/api/videos?page=1&limit=100');
        const data = await response.json();
        
        // Shuffle the videos array
        // Shuffle videos client-side only to avoid hydration mismatch
        const shuffledVideos = typeof window !== 'undefined'
          ? [...data.videos].sort(() => Math.random() - 0.5)
          : data.videos;
        setVideos(shuffledVideos);
        
        // Initialize loading states for all videos
        const initialLoadingStates: Record<string, boolean> = {};
        shuffledVideos.forEach((video: Video) => {
          initialLoadingStates[video.id] = true; // Start with all videos as loading
        });
        setVideoLoadingStates(initialLoadingStates);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching videos:', error);
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  // Initialize sample comments for demonstration
  useEffect(() => {
    if (videos.length > 0) {
      const sampleComments = {
        [videos[0]?.id]: [
          {
            id: '1',
            text: 'Average\nNo ring?',
            author: 'Average',
            timestamp: typeof window !== 'undefined' ? Date.now() - 17 * 60000 : 1700000000000
          },
          {
            id: '2',
            text: 'I recognize that art style...',
            author: '-XyZen-xM',
            timestamp: typeof window !== 'undefined' ? Date.now() - 20 * 60000 : 1700000000000
          },
          {
            id: '3',
            text: 'pls make Roblox Catalog avatar creation plsss',
            author: 'Sebastian',
            timestamp: typeof window !== 'undefined' ? Date.now() - 15 * 60000 : 1700000000000
          },
          {
            id: '4',
            text: 'I came...',
            author: 'fwuffles',
            timestamp: typeof window !== 'undefined' ? Date.now() - 16 * 60000 : 1700000000000
          },
          {
            id: '5',
            text: 'I LOVE HOW YOU DREW SEBASTIAN[happy]',
            author: '-Frye★Anguilla-',
            timestamp: typeof window !== 'undefined' ? Date.now() - 31 * 60000 : 1700000000000
          },
          {
            id: '6',
            text: 'this is painter approved!!',
            author: 'p.AI.nter',
            timestamp: typeof window !== 'undefined' ? Date.now() - 12 * 60000 : 1700000000000
          }
        ]
      };
      setComments(sampleComments);
    }
  }, [videos]);

  // Help first video load on mobile devices
  useEffect(() => {
    if (videos.length > 0 && currentVideoIndex === 0) {
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
  }, [videos, currentVideoIndex]);


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
        const newIndex = Math.min(currentVideoIndex + 1, videos.length - 1);
        if (newIndex !== currentVideoIndex) {
          const newVideoCount = videoCount + 1;
          setVideoCount(newVideoCount);
          
          // Check if we should show chat screen every 5 videos BEFORE moving to next video
          if (newVideoCount % 5 === 0 && !showChatScreen) {
            // Show chat screen with current video model (the 5th video)
            setIsEnteringChat(true);
            const nextVideoIndex = newIndex;
            if (nextVideoIndex < videos.length && videoRefs.current[nextVideoIndex]) {
              videoRefs.current[nextVideoIndex]!.preload = "auto";
            }
            // Show chat screen after a brief delay to allow preloading
            setTimeout(() => {
              setShowChatScreen(true);
              setIsEnteringChat(false);
            }, 200);
          } else {
            // Normal navigation
            setCurrentVideoIndex(newIndex);
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
  }, [videos.length, currentVideoIndex, showChatScreen, videoCount]);

  // Handle video play/pause with debounce to avoid AbortError
  useEffect(() => {
    // Pause all non-active videos first
    videoRefs.current.forEach((video, index) => {
      if (video && index !== currentVideoIndex) {
        if (!video.paused) video.pause();
      }
    });

    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }

    const currentEl = videoRefs.current[currentVideoIndex] || null;
    if (!currentEl) return;

    if (!isPlaying) {
      currentEl.pause();
      return;
    }

    // Small delay so pauses settle before playing current
    playTimeoutRef.current = setTimeout(() => {
      safePlay(currentEl);
    }, 200);

    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
    };
  }, [currentVideoIndex, isPlaying, showChatScreen, safePlay]);

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
          if (currentVideoIndex > 0) {
            setCurrentVideoIndex(prev => prev - 1);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentVideoIndex < videos.length - 1) {
            const newIndex = currentVideoIndex + 1;
            const newVideoCount = videoCount + 1;
            setVideoCount(newVideoCount);
            
            // Check if we should show chat screen every 5 videos BEFORE moving to next video
            if (newVideoCount % 5 === 0 && !showChatScreen) {
              // Show chat screen with current video model (the 5th video)
              setIsEnteringChat(true);
              const nextVideoIndex = newIndex;
              if (nextVideoIndex < videos.length && videoRefs.current[nextVideoIndex]) {
                videoRefs.current[nextVideoIndex]!.preload = "auto";
              }
              // Show chat screen after a brief delay to allow preloading
              setTimeout(() => {
                setShowChatScreen(true);
                setIsEnteringChat(false);
              }, 200);
            } else {
              // Normal navigation
              setCurrentVideoIndex(newIndex);
            }
          }
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [currentVideoIndex, videos.length, showChatScreen, videoCount, showComments]);

  const togglePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

  const goToNext = useCallback(() => {
    if (currentVideoIndex < videos.length - 1) {
      const newIndex = currentVideoIndex + 1;
      const newVideoCount = videoCount + 1;
      setVideoCount(newVideoCount);
      
      // Show chat screen every 5 videos (only if not already showing)
      if (newVideoCount % 5 === 0 && !showChatScreen) {
        // Show chat screen with current video model (the 5th video)
        setIsEnteringChat(true);
        const nextVideoIndex = newIndex;
        if (nextVideoIndex < videos.length && videoRefs.current[nextVideoIndex]) {
          videoRefs.current[nextVideoIndex]!.preload = "auto";
        }
        // Show chat screen after a brief delay to allow preloading
        setTimeout(() => {
          setShowChatScreen(true);
          setIsEnteringChat(false);
        }, 200);
      } else {
        // Normal navigation
        setCurrentVideoIndex(newIndex);
      }
    }
  }, [currentVideoIndex, videos.length, showChatScreen, videoCount]);

  const goToPrevious = useCallback(() => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(prev => prev - 1);
    }
  }, [currentVideoIndex]);


  // Navigation functions that don't increment video count (for chat screen navigation)
  const navigateToNext = useCallback(() => {
    if (currentVideoIndex < videos.length - 1) {
      setIsExitingChat(true);
      setIsTransitioning(true);
      // Smooth transition without interrupting preloading
      setTimeout(() => {
        setCurrentVideoIndex(prev => prev + 1);
        setTimeout(() => {
          setIsTransitioning(false);
          setIsExitingChat(false);
        }, 300);
      }, 100);
    }
  }, [currentVideoIndex, videos.length]);

  const navigateToPrevious = useCallback(() => {
    if (currentVideoIndex > 0) {
      setIsExitingChat(true);
      setIsTransitioning(true);
      // Smooth transition without interrupting preloading
      setTimeout(() => {
        setCurrentVideoIndex(prev => prev - 1);
        setTimeout(() => {
          setIsTransitioning(false);
          setIsExitingChat(false);
        }, 300);
      }, 100);
    }
  }, [currentVideoIndex]);

  // Handle swipe gestures for regular video navigation
  useEffect(() => {
    // Don't add touch handlers when chat screen is showing
    if (showChatScreen) return;

    let startY = 0;
    let startTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!startY) return;

      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();
      const deltaY = startY - endY;
      const deltaTime = endTime - startTime;

      // Only register swipe if it's quick enough and has enough distance
      if (deltaTime < 300 && Math.abs(deltaY) > 50) {
        if (deltaY > 0) {
          // Swipe up - go to next video
          goToNext();
        } else {
          // Swipe down - go to previous video
          goToPrevious();
        }
      }

      startY = 0;
      startTime = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [goToNext, goToPrevious, showChatScreen]);

  // Handle swipe gestures for chat screen
  useEffect(() => {
    if (!showChatScreen) return;

    let startY = 0;
    let startTime = 0;

    const handleChatTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startTime = Date.now();
    };

    const handleChatTouchEnd = (e: TouchEvent) => {
      if (!startY) return;

      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();
      const deltaY = startY - endY;
      const deltaTime = endTime - startTime;

      // Only register swipe if it's quick enough and has enough distance
      if (deltaTime < 300 && Math.abs(deltaY) > 50) {
        if (deltaY > 0) {
          // Swipe up - go to next video
          setShowChatScreen(false);
          if (currentVideoIndex < videos.length - 1) {
            setCurrentVideoIndex(prev => prev + 1);
          }
        } else {
          // Swipe down - go to previous video
          setShowChatScreen(false);
          if (currentVideoIndex > 0) {
            setCurrentVideoIndex(prev => prev - 1);
          }
        }
      }

      startY = 0;
      startTime = 0;
    };

    document.addEventListener('touchstart', handleChatTouchStart, { passive: true });
    document.addEventListener('touchend', handleChatTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleChatTouchStart);
      document.removeEventListener('touchend', handleChatTouchEnd);
    };
  }, [showChatScreen, navigateToNext, navigateToPrevious, currentVideoIndex, videos.length]);

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

  if (loading) {
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

  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <h3>No videos found</h3>
        <p>Upload some videos to see them here!</p>
      </div>
    );
  }

  // Show chat screen every 5 videos
  if (showChatScreen && videos.length > 0) {
    const currentVideo = videos[currentVideoIndex];
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
              // Always allow going back, even if at video 0
              if (currentVideoIndex > 0) {
                setCurrentVideoIndex(prev => prev - 1);
              }
            }}
            disabled={currentVideoIndex === 0}
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
              // Always allow going forward, even if at last video
              if (currentVideoIndex < videos.length - 1) {
                setCurrentVideoIndex(prev => prev + 1);
              }
            }}
            disabled={currentVideoIndex === videos.length - 1}
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
    <div className="tiktok-container" ref={containerRef} suppressHydrationWarning={true}>
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
        {videos.map((video, index) => (
          <div
            key={video.id}
            className={`video-slide ${isTransitioning ? 'transitioning' : ''}`}
            data-current={index === currentVideoIndex}
          >
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
                    : index === 0 || Math.abs(index - currentVideoIndex) <= preloadRange 
                      ? (connectionType === 'slow-2g' || connectionType === '2g' ? "metadata" : "auto")
                      : "none"
              }
              onClick={index === currentVideoIndex ? togglePlayPause : undefined}
              onLoadStart={() => {
                setVideoLoading(video.id, true);
              }}
              onLoadedData={() => {
                setVideoLoading(video.id, false);
                // Mark video as loaded for the first time
                setVideoLoaded(video.id, true);
                // Auto-play when loaded (but only for current video to avoid conflicts)
                if (index === currentVideoIndex && isPlaying && !isTransitioning) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onLoadedMetadata={() => {
                // Auto-play when metadata is loaded (but only for current video to avoid conflicts)
                if (index === currentVideoIndex && isPlaying && !isTransitioning) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onCanPlay={() => {
                setVideoLoading(video.id, false);
                // Mark video as loaded for the first time
                setVideoLoaded(video.id, true);
                // Auto-play when video can play (but only for current video to avoid conflicts)
                if (index === currentVideoIndex && isPlaying && !isTransitioning) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onCanPlayThrough={() => {
                setVideoLoading(video.id, false);
                // Mark video as loaded for the first time
                setVideoLoaded(video.id, true);
                // Auto-play when video can play through (but only for current video to avoid conflicts)
                if (index === currentVideoIndex && isPlaying && !isTransitioning) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onWaiting={() => {
                // Only show loading if video hasn't loaded yet (prevent spinner during loop buffering)
                const hasLoaded = videoLoadedStates[video.id] || false;
                if (!hasLoaded) {
                  setVideoLoading(video.id, true);
                }
              }}
              onPlaying={() => {
                setVideoLoading(video.id, false);
              }}
              onError={() => {
                setVideoLoading(video.id, false);
              }}
              onStalled={() => {
                // Only show loading if video hasn't loaded yet
                const hasLoaded = videoLoadedStates[video.id] || false;
                if (!hasLoaded) {
                  setVideoLoading(video.id, true);
                }
              }}
              onEnded={() => {
                // Reset loaded state when video actually ends (not looping)
                setVideoLoaded(video.id, false);
              }}
            />
            
            {/* Video Loading Spinner */}
            {isVideoLoading(video.id) && index === currentVideoIndex && (
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

            
            {/* Video overlay UI */}
            <div className="video-overlay">

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
      </div>

      {/* TikTok-style Comments Side Panel */}
      {showComments && videos.length > 0 && (
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
              <h3 className="tiktok-comments-title">Comments ({getCommentCount(videos[currentVideoIndex]?.id)})</h3>
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
              {comments[videos[currentVideoIndex]?.id]?.map((comment) => (
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
                        <span className="tiktok-like-count" suppressHydrationWarning={true}>
                          {typeof window !== 'undefined' ? Math.floor(Math.random() * 10) : 5}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {(!comments[videos[currentVideoIndex]?.id] || comments[videos[currentVideoIndex]?.id].length === 0) && (
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
                      addComment(videos[currentVideoIndex]?.id);
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
                    onClick={() => addComment(videos[currentVideoIndex]?.id)}
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
          disabled={currentVideoIndex === 0}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
          </svg>
        </button>
        
        <button 
          className="nav-btn nav-down"
          onClick={goToNext}
          disabled={currentVideoIndex === videos.length - 1}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
          </svg>
        </button>
      </div>

    </div>
  );
}