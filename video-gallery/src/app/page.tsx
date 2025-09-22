'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface Video {
  id: string;
  filename: string;
  size: number;
  sizeFormatted: string;
  extension: string;
  createdAt: string;
  url: string;
}

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wheelLockRef = useRef<boolean>(false);
  const lastWheelAtRef = useRef<number>(0);

  const bannerMessages = [
    {
      text: "Create an AI model from your pics in minutes",
      url: "https://deepmode.com",
      bgColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    },
    {
      text: "Chat with an AI girl — she sends spicy vids",
      url: "https://clonella.com",
      bgColor: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
    },
    {
      text: "Swap any face into this video — try it now",
      url: "https://faceswapfun.com",
      bgColor: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
    }
  ];

  const safePlay = async (el: HTMLVideoElement | null) => {
    if (!el) return;
    try {
      await el.play();
    } catch (err: unknown) {
      // AbortError is benign when a pending play is interrupted by pause
      if (err instanceof Error && err.name !== 'AbortError') {
        console.debug('play suppressed:', err.message);
      }
    }
  };

  // Fetch videos
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch('/api/videos?page=1&limit=100');
        const data = await response.json();
        
        // Shuffle the videos array
        const shuffledVideos = [...data.videos].sort(() => Math.random() - 0.5);
        setVideos(shuffledVideos);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching videos:', error);
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  // Cycle through banner messages
  useEffect(() => {
    const bannerInterval = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % bannerMessages.length);
    }, 4000); // Change every 4 seconds

    return () => clearInterval(bannerInterval);
  }, [bannerMessages.length]);

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
        setCurrentVideoIndex(prev => Math.min(prev + 1, videos.length - 1));
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
  }, [videos.length]);

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
  }, [currentVideoIndex, isPlaying]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
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
            setCurrentVideoIndex(prev => prev + 1);
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
  }, [currentVideoIndex, videos.length]);

  const togglePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

  const goToNext = () => {
    if (currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex(prev => prev + 1);
    }
  };

  const goToPrevious = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading TikTok feed...</p>
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
      {/* Banner Pill */}
      <div className="banner-pill">
        <a 
          href={bannerMessages[currentBannerIndex].url}
          target="_blank"
          rel="noopener noreferrer"
          className="banner-link"
          style={{
            background: bannerMessages[currentBannerIndex].bgColor
          }}
        >
          {bannerMessages[currentBannerIndex].text}
        </a>
      </div>

      {/* Video Feed */}
      <div 
        className="video-feed"
        style={{
          transform: `translateY(-${currentVideoIndex * 100}vh)`
        }}
      >
        {videos.map((video, index) => (
          <div key={video.id} className="video-slide">
            <video
              ref={el => { videoRefs.current[index] = el; }}
              src={video.url}
              className="video-player"
              loop
              muted
              playsInline
              preload={Math.abs(index - currentVideoIndex) <= 1 ? "auto" : "none"}
              onClick={togglePlayPause}
              onLoadedMetadata={() => {
                if (index === currentVideoIndex && isPlaying) {
                  safePlay(videoRefs.current[index]);
                }
              }}
              onCanPlay={() => {
                if (index === currentVideoIndex && isPlaying) {
                  safePlay(videoRefs.current[index]);
                }
              }}
            />
            
            {/* Video overlay UI */}
            <div className="video-overlay">
              {/* Play/Pause indicator */}
              {!isPlaying && index === currentVideoIndex && (
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
                    <div className="video-info">
                      <div className="username">@viceloop</div>
                  <div className="description">
                    AI Porn
                  </div>
                </div>

                {/* Right side - action buttons */}
                <div className="action-buttons">
                  <button className="action-btn">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span>128</span>
                  </button>
                  
                  <button className="action-btn">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
                    </svg>
                    <span>Share</span>
                  </button>

                  <button className="action-btn profile-btn">
                    <div className="profile-pic">
                      <Image 
                        src="/viceloop-logo.jpg" 
                        alt="viceloop logo" 
                        width={64}
                        height={64}
                        className="viceloop-logo-img"
                        onLoad={() => console.log('Logo image loaded successfully')}
                        onError={(e) => console.error('Logo image failed to load:', e)}
                      />
                    </div>
                  </button>
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