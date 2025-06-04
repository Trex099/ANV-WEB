import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
// @ts-ignore
import styles from './NetflixBackground.module.css';

interface Poster {
  id: string;
  imageUrl: string;
  altText: string;
}

interface NetflixBackgroundProps {
  imageUrls?: string[];
}

// A simple hook to get window size
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState<{
    width: number | undefined;
    height: number | undefined;
  }> ({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    // Debounce resize events to improve performance
    let timeoutId: ReturnType<typeof setTimeout>;
    function handleResize() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 150); // Debounce threshold
    }
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Call handler right away so state gets updated with initial window size
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);
  return windowSize;
};

// Fallback default images to use if custom images aren't available
const fallbackImages = [
  'https://picsum.photos/id/96/350/525',
  'https://picsum.photos/id/1060/350/525',
  'https://picsum.photos/id/110/350/525',
  'https://picsum.photos/id/1047/350/525',
  'https://picsum.photos/id/237/350/525',
  'https://picsum.photos/id/26/350/525',
  'https://picsum.photos/id/27/350/525',
  'https://picsum.photos/id/28/350/525',
];

// Create a stable session-wide cache for poster objects to prevent refreshing
// Using sessionStorage for persistence across component remounts
const getPosterCache = (): Map<string, Poster[]> => {
  try {
    const cachedData = sessionStorage.getItem('netflix-grid-poster-cache');
    if (cachedData) {
      return new Map(JSON.parse(cachedData));
    }
  } catch (e) {
    console.error('Error accessing poster cache:', e);
  }
  return new Map<string, Poster[]>();
};

// Load cache from sessionStorage if available to persist across re-renders
const POSTER_CACHE = getPosterCache();

// Save cache to sessionStorage for persistence
const savePosterCache = (cache: Map<string, Poster[]>) => {
  try {
    // Only save the first few entries to prevent storage bloat
    const entries = Array.from(cache.entries()).slice(0, 20);
    sessionStorage.setItem('netflix-grid-poster-cache', JSON.stringify(entries));
  } catch (e) {
    console.error('Error saving poster cache:', e);
  }
};

// Fixed version of the hook that accepts null values
const useIsInViewport = (ref: React.RefObject<HTMLDivElement | null>) => {
  const [isIntersecting, setIsIntersecting] = useState(true);

  useEffect(() => {
    // Only observe if Intersection Observer API is available and ref is valid
    if (typeof IntersectionObserver === 'undefined' || !ref.current) {
      setIsIntersecting(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [ref]);

  return isIntersecting;
};

// Custom hook to load and scan directory for images
const useCustomImages = () => {
  const [customImages, setCustomImages] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Check for cached images first to improve load time and avoid refreshes
  const cachedImageList = useMemo(() => {
    try {
      const cachedImages = sessionStorage.getItem('netflix-grid-custom-images');
      if (cachedImages) {
        return JSON.parse(cachedImages);
      }
    } catch (e) {
      console.error('Error loading cached images:', e);
    }
    return null;
  }, []);

  // This function will check if an image URL is valid
  const checkImageURL = useCallback(async (url: string): Promise<boolean> => {
    // Performance improvement: Check sessionStorage first
    const cacheKey = `img-check-${url}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached === 'true';
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        sessionStorage.setItem(cacheKey, 'true');
        resolve(true);
      };
      img.onerror = () => {
        sessionStorage.setItem(cacheKey, 'false');
        resolve(false);
      };
      img.src = url;
    });
  }, []);

  useEffect(() => {
    // Use cached images if available
    if (cachedImageList) {
      setCustomImages(cachedImageList);
      setIsLoaded(true);
      return;
    }
    
    // Function to load custom images from directory
    const loadCustomImages = async () => {
      try {
        // In a real app, this would ideally be handled server-side
        // Here we'll use a pattern to look for images
        const customImageList: string[] = [];
        const foundIndices: Set<number> = new Set();
        
        // Look for sequentially named images in the custom folder
        for (let i = 1; i <= 32; i++) {
          const possibleExtensions = ['jpg', 'jpeg', 'png', 'webp'];
          let foundImage = false;
          
          for (const ext of possibleExtensions) {
            // Try the optimized version first (WebP format)
            const optimizedPath = `/images/netflix-grid/optimized/image-${i}.webp`;
            let exists = await checkImageURL(optimizedPath);
            
            if (exists) {
              customImageList.push(optimizedPath);
              foundIndices.add(i);
              foundImage = true;
              break;
            }
            
            // If optimized isn't available, check original
            const imagePath = `/images/netflix-grid/image-${i}.${ext}`;
            exists = await checkImageURL(imagePath);
            
            if (exists) {
              customImageList.push(imagePath);
              foundIndices.add(i);
              foundImage = true;
              break;
            }
          }
          
          // Don't block UI thread for too long when checking images
          if (i % 4 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        // Only add fallback images for indices that weren't found
        // This ensures consistent image positions even if custom images are added later
        let fallbackIndex = 0;
        for (let i = 1; i <= 32; i++) {
          if (!foundIndices.has(i)) {
            // Use consistent, deterministic fallback image assignment
            const picSumId = ((i * 37) % 200) + 1; // Deterministic ID generation
            customImageList.push(`https://picsum.photos/id/${picSumId}/350/525`);
            fallbackIndex++;
          }
        }
        
        // Cache the result for future loads
        try {
          sessionStorage.setItem('netflix-grid-custom-images', JSON.stringify(customImageList));
        } catch (e) {
          console.error('Error caching image list:', e);
        }
        
        setCustomImages(customImageList);
      } catch (error) {
        console.error("Failed to load custom images:", error);
        // Fall back to default image set if there's an error
        setCustomImages(fallbackImages);
      } finally {
        setIsLoaded(true);
      }
    };

    loadCustomImages();
  }, [cachedImageList, checkImageURL]);

  return { customImages, isCustomImagesLoaded: isLoaded };
};

// Custom hook for aggressively preloading images
const useImagePreloader = (images: string[]) => {
  useEffect(() => {
    // Skip if no images
    if (!images || images.length === 0) return;
    
    // Check if we've already preloaded in this session
    const preloadKey = 'netflix-grid-preloaded';
    const hasPreloaded = sessionStorage.getItem(preloadKey);
    if (hasPreloaded) return;
    
    // Function to preload a single image
    const preloadImage = (src: string): Promise<void> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Continue even if error
        img.src = src;
      });
    };
    
    // Preload in batches to avoid overwhelming browser
    const preloadBatch = async (batch: string[]) => {
      const promises = batch.map(src => preloadImage(src));
      await Promise.all(promises);
    };
    
    // Start preloading
    const batchSize = 5;
    const preloadAll = async () => {
      // First preload the first visible images with high priority
      const firstBatch = images.slice(0, 10);
      await preloadBatch(firstBatch);
      
      // Then preload the rest in background
      for (let i = 10; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        // Small delay to avoid blocking main thread
        await new Promise(r => setTimeout(r, 100));
        preloadBatch(batch).catch(() => {}); // Ignore errors in background loading
      }
      
      // Mark as preloaded
      sessionStorage.setItem(preloadKey, 'true');
    };
    
    preloadAll().catch(console.error);
  }, [images]);
};

// PosterRow component to minimize re-renders
const PosterRow = React.memo(({ 
  rowIndex, 
  isScrollLeft, 
  zTranslate, 
  posters,
  isMobile
}: { 
  rowIndex: number, 
  isScrollLeft: boolean, 
  zTranslate: number, 
  posters: Poster[],
  isMobile: boolean
}) => {
  return (
    <div
      className={`${styles.posterRow} ${isScrollLeft ? styles.scrollLeft : styles.scrollRight}`}
      style={{
        transform: `translateZ(${zTranslate}px) translateX(${isScrollLeft ? '0px' : '-20px'})`,
        willChange: 'transform'
      }}
    >
      {posters.map((poster, posterIndex) => {
        // Deterministic, non-random transformations
        const baseAngle = ((posterIndex * 30) + (rowIndex * 45)) % 360;
        const rotateY = isMobile ? 0 : Math.sin(baseAngle * Math.PI / 180) * 4;
        const rotateX = isMobile ? 0 : Math.cos(baseAngle * Math.PI / 180) * 1.5;
        
        // Very subtle transformations to avoid performance issues on mobile
        const transform = isMobile 
          ? '' 
          : `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
        
        return (
          <div
            key={poster.id} // Use stable ID to prevent refreshes
            className={styles.posterItem}
            style={{
              backgroundImage: `url(${poster.imageUrl})`,
              transform,
              zIndex: 4 - rowIndex,
            }}
            aria-label={poster.altText}
            data-row={rowIndex}
            data-position={posterIndex}
          />
        );
      })}
    </div>
  );
});

const NetflixBackground: React.FC<NetflixBackgroundProps> = ({
  imageUrls,
}) => {
  const { width: windowWidth } = useWindowSize();
  const backgroundRef = useRef<HTMLDivElement>(null);
  const isInViewport = useIsInViewport(backgroundRef);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const { customImages, isCustomImagesLoaded } = useCustomImages();
  
  // Detect if we're on desktop for optimizations
  const isDesktop = useMemo(() => (windowWidth || 0) >= 1025, [windowWidth]);
  const isMobile = useMemo(() => (windowWidth || 0) < 768, [windowWidth]);
  
  // Set images as loaded when custom images are ready
  useEffect(() => {
    if (isCustomImagesLoaded) {
      setImagesLoaded(true);
    }
  }, [isCustomImagesLoaded]);

  // Memoize configuration to prevent useless recalculations
  const { rowConfig } = useMemo(() => {
    // Fixed to exactly 4 rows as requested
    const rowCount = 4;
    
    // Determine how many posters per row based on screen size
    const postersPerRow = !windowWidth ? 8 : 
                         windowWidth < 480 ? 6 :
                         windowWidth < 768 ? 7 :
                         windowWidth < 1024 ? 8 :
                         windowWidth < 1440 ? 9 : 10;
    
    // Determine total visible count (approximate)
    const totalVisible = rowCount * postersPerRow;
    
    // Create configuration for each row - important to keep this stable
    const rowConfig = Array(rowCount).fill(0).map((_, index) => ({
      // Alternating scroll direction
      isScrollLeft: index % 2 === 0,
      // Slight variations in number of posters per row
      posterCount: postersPerRow + (index % 2 === 0 ? 1 : -1),
    }));
    
    return { 
      rowConfig,
      totalVisiblePosters: totalVisible
    };
  }, [windowWidth]);

  // Memoize images to ensure stability
  const availableImages = useMemo(() => {
    if (imageUrls && imageUrls.length > 0) {
      return imageUrls;
    }
    
    if (customImages.length > 0) {
      return customImages;
    }
    
    return fallbackImages;
  }, [imageUrls, customImages]);
  
  // Initialize poster arrays only once across renders
  const rowPosters = useMemo(() => {
    return rowConfig.map((config, rowIndex) => {
      // Generate a stable cache key that won't change between renders
      const cacheKey = `${availableImages.length}-row-${rowIndex}-${config.posterCount}`;

      // Return cached posters if available to prevent refreshes
      if (POSTER_CACHE.has(cacheKey)) {
        return POSTER_CACHE.get(cacheKey)!;
      }
      
      // Calculate stable multiplier
      const posterMultiplier = isDesktop ? 3 : 2.5;
      const totalPosters = Math.ceil(config.posterCount * posterMultiplier);
      
      // Create new posters with stable IDs and positions
      const rowPosters: Poster[] = [];
      // Use a stable, deterministic starting offset based on row
      const startOffset = (rowIndex * 7) % Math.max(1, availableImages.length);
      
      for (let i = 0; i < totalPosters; i++) {
        // Ensure consistent image selection for the same position
        const imageIndex = (startOffset + i) % availableImages.length;
        rowPosters.push({
          // Create a stable ID that won't change between renders
          id: `poster-${rowIndex}-${i}-${imageIndex}`,
          imageUrl: availableImages[imageIndex],
          altText: `Poster ${i + 1} in row ${rowIndex + 1}`,
        });
      }
      
      // Cache and return
      POSTER_CACHE.set(cacheKey, rowPosters);
      
      // Save cache to sessionStorage occasionally
      if (rowIndex === 0) {
        savePosterCache(POSTER_CACHE);
      }
      
      return rowPosters;
    });
  }, [availableImages, rowConfig, isDesktop]);

  // Optimize mobile performance by disabling some animations
  useEffect(() => {
    if (isMobile) {
      // Mobile optimization - add a class to the body for CSS targeting
      document.body.classList.add('netflix-grid-mobile');
    } else {
      document.body.classList.remove('netflix-grid-mobile');
    }
    
    return () => {
      document.body.classList.remove('netflix-grid-mobile');
    };
  }, [isMobile]);

  // After the useCustomImages hook, add this new hook:
  useImagePreloader(availableImages);

  if (!imagesLoaded) {
    // Simple loading state
    return <div ref={backgroundRef} className={styles.netflixBackground}></div>;
  }

  return (
    <div ref={backgroundRef} className={styles.netflixBackground}>
      <div className={styles.perspectiveContainer}>
        <div className={styles.gridContainer}>
          {rowConfig.map((config, rowIndex) => {
            // Calculate depth based on row index
            const rowDepth = isMobile ? 25 - (rowIndex * 3) : 35 - (rowIndex * 4);
            const zTranslate = -rowIndex * rowDepth;
            
            return (
              <PosterRow
                key={`row-${rowIndex}`}
                rowIndex={rowIndex}
                isScrollLeft={config.isScrollLeft}
                zTranslate={zTranslate}
                posters={rowPosters[rowIndex]}
                isMobile={isMobile}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Prevent unnecessary re-renders with memo
export default React.memo(NetflixBackground); 