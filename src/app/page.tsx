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
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [videoLoadingStates, setVideoLoadingStates] = useState<Record<string, boolean>>({});
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [videoErrors, setVideoErrors] = useState<Set<string>>(new Set());
  
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentPageRef = useRef(1);
  const loadTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Enhanced video loading with simplified timeout management
  const setVideoLoading = (videoId: string, isLoading: boolean) => {
    setVideoLoadingStates(prev => ({
      ...prev,
      [videoId]: isLoading
    }));
  };

  const isVideoLoading = (videoId: string) => {
    return videoLoadingStates[videoId] || false;
  };

  // Mark video as failed
  const markVideoAsError = useCallback((videoId: string) => {
    setVideoErrors(prev => new Set(prev).add(videoId));
    setVideoLoading(videoId, false);
    
    // Clear any timeout for this video
    const timeout = loadTimeoutsRef.current.get(videoId);
    if (timeout) {
      clearTimeout(timeout);
      loadTimeoutsRef.current.delete(videoId);
    }
  }, []);

  // Check if video has failed
  const hasVideoError = useCallback((videoId: string) => {
    return videoErrors.has(videoId);
  }, [videoErrors]);

  // Retry video loading
  const retryVideo = useCallback((videoId: string, index: number) => {
    setVideoErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(videoId);
      return newSet;
    });
    
    const videoElement = videoRefs.current[index];
    if (videoElement) {
      setVideoLoading(videoId, true);
      
      // Clear the video and reload
      videoElement.src = '';
      videoElement.load();
      
      setTimeout(() => {
        const video = videos[index];
        if (video) {
          videoElement.src = video.url;
        }
      }, 500);
    }
  }, [videos]);

  // Enhanced video timeout management
  const setupVideoTimeout = useCallback((videoId: string) => {
    // Clear existing timeout
    const existingTimeout = loadTimeoutsRef.current.get(videoId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new timeout (10 seconds - reduced from 15)
    const timeout = setTimeout(() => {
      console.warn(`Video timeout: ${videoId}`);
      markVideoAsError(videoId);
    }, 10000);
    
    loadTimeoutsRef.current.set(videoId, timeout);
  }, [markVideoAsError]);

  // Clear video timeout
  const clearVideoTimeout = useCallback((videoId: string) => {
    const timeout = loadTimeoutsRef.current.get(videoId);
    if (timeout) {
      clearTimeout(timeout);
      loadTimeoutsRef.current.delete(videoId);
    }
  }, []);

  // Safe play function with enhanced error handling
  const safePlay = useCallback(async (el: HTMLVideoElement | null) => {
    if (!el) return;
    
    try {
      // Ensure video is ready to play
      if (el.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        await el.play();
      } else {
        // Wait for video to be ready
        const playWhenReady = () => {
          if (el.readyState >= 2) {
            el.play().catch(console.warn);
            el.removeEventListener('loadeddata', playWhenReady);
          }
        };
        el.addEventListener('loadeddata', playWhenReady);
      }
    } catch (err: unknown) {
      console.warn('Video play failed:', err);
    }
  }, []);

  // Fetch videos with pagination
  const fetchVideos = async (page = 1, append = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      }
      
      const response = await fetch(`/api/videos?page=${page}&limit=20`);
      const data = await response.json();
      
      if (page === 1) {
        // First load - shuffle and set videos
        const shuffledVideos = [...data.videos].sort(() => Math.random() - 0.5);
        setVideos(shuffledVideos);
        
        // Initialize loading states
        const initialLoadingStates: Record<string, boolean> = {};
        shuffledVideos.forEach(video => {
          initialLoadingStates[video.id] = false; // Start as false, will be set on loadstart
        });
        setVideoLoadingStates(initialLoadingStates);
      } else {
        // Append new videos for infinite scroll
        setVideos(prev => [...prev, ...data.videos]);
      }
      
      setHasMoreVideos(data.hasMore);
      currentPageRef.current = page;
      setLoading(false);
      setIsLoadingMore(false);
      
    } catch (error) {
      console.error('Error fetching videos:', error);
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Load more videos when approaching the end
  const loadMoreVideos = useCallback(() => {
    if (!isLoadingMore && hasMoreVideos && currentVideoIndex >= videos.length - 5) {
      fetchVideos(currentPageRef.current + 1, true);
    }
  }, [currentVideoIndex, videos.length, isLoadingMore, hasMoreVideos]);

  // Initial video fetch
  useEffect(() => {
    fetchVideos();
  }, []);

  // Load more videos when needed
  useEffect(() => {
    loadMoreVideos();
  }, [currentVideoIndex, loadMoreVideos]);

  // Enhanced video play/pause with better state management
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

    // Play current video with delay
    playTimeoutRef.current = setTimeout(() => {
      safePlay(currentEl);
    }, 100);

    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
    };
  }, [currentVideoIndex, isPlaying, safePlay]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      loadTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      loadTimeoutsRef.current.clear();
    };
  }, []);

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
        {videos.map((video, index) => (
          <div key={video.id} className="video-slide">
            {/* Video Error State */}
            {hasVideoError(video.id) && index === currentVideoIndex && (
              <div className="video-error-state">
                <div className="video-error-content">
                  <div className="video-error-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                  </div>
                  <div className="video-error-text">Video failed to load</div>
                  <button 
                    className="video-retry-btn"
                    onClick={() => retryVideo(video.id, index)}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Video Thumbnail Placeholder */}
            {isVideoLoading(video.id) && index === currentVideoIndex && !hasVideoError(video.id) && (
              <div className="video-thumbnail-placeholder">
                <div className="video-thumbnail-content">
                  <Image 
                    src={video.profileImageUrl || "/viceloop-logo.jpg"} 
                    alt="Video thumbnail" 
                    width={200}
                    height={200}
                    className="video-thumbnail-image"
                  />
                  <div className="video-thumbnail-overlay">
                    <div className="video-loading-spinner-container">
                      <div className="video-loading-spinner-ring"></div>
                      <div className="video-loading-spinner-ring"></div>
                      <div className="video-loading-spinner-ring"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <video
              ref={el => { videoRefs.current[index] = el; }}
              src={video.url}
              className="video-player"
              loop
              muted
              playsInline
              preload={
                Math.abs(index - currentVideoIndex) <= 1 ? "auto" : "none"
              }
              onClick={() => setIsPlaying(prev => !prev)}
              onLoadStart={() => {
                setVideoLoading(video.id, true);
                setupVideoTimeout(video.id);
              }}
              onLoadedData={() => {
                setVideoLoading(video.id, false);
                clearVideoTimeout(video.id);
              }}
              onCanPlay={() => {
                setVideoLoading(video.id, false);
                clearVideoTimeout(video.id);
                if (index === currentVideoIndex && isPlaying) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onError={() => {
                console.error(`Video error: ${video.id}`);
                markVideoAsError(video.id);
              }}
              onStalled={() => {
                console.warn(`Video stalled: ${video.id}`);
                // Give it a bit more time, but not too long
                setTimeout(() => {
                  if (isVideoLoading(video.id)) {
                    markVideoAsError(video.id);
                  }
                }, 5000);
              }}
              style={{
                display: hasVideoError(video.id) ? 'none' : 'block'
              }}
            />
            
            {/* Video Loading Spinner */}
            {isVideoLoading(video.id) && index === currentVideoIndex && !hasVideoError(video.id) && (
              <div className="video-loading-spinner-overlay">
                <div className="video-loading-spinner-container">
                  <div className="video-loading-spinner-ring"></div>
                  <div className="video-loading-spinner-ring"></div>
                  <div className="video-loading-spinner-ring"></div>
                </div>
              </div>
            )}
            
            {/* Video overlay UI */}
            <div className="video-overlay">
              {/* Play/Pause indicator */}
              {!isPlaying && index === currentVideoIndex && !hasVideoError(video.id) && (
                <div className="play-pause-indicator">
                  <div className="play-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              )}

              {/* Bottom info section */}
              <div className="bottom-section">
                {/* Left side - video info */}
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
                      onClick={() => {
                        setLikedVideos(prev => {
                          const newLikedVideos = new Set(prev);
                          if (newLikedVideos.has(video.id)) {
                            newLikedVideos.delete(video.id);
                          } else {
                            newLikedVideos.add(video.id);
                          }
                          return newLikedVideos;
                        });
                      }}
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
                    
                    <button className="action-btn">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                        <path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                      </svg>
                      <span>0</span>
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

      {/* Navigation controls */}
      <div className="nav-controls">
        <button 
          className="nav-btn nav-up"
          onClick={() => setCurrentVideoIndex(prev => Math.max(prev - 1, 0))}
          disabled={currentVideoIndex === 0}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
          </svg>
        </button>
        
        <button 
          className="nav-btn nav-down"
          onClick={() => {
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

      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="loading-more-indicator">
          <div className="loading-more-spinner"></div>
          <span>Loading more videos...</span>
        </div>
      )}
    </div>
  );
}