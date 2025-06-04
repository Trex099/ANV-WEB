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

// Create a global constant that will never change once initialized
// This maintains perfect stability across renders
const GLOBAL_IMAGE_MANIFEST = {
  customImages: [] as string[],
  loaded: false,
  initialCheck: false
};

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

// This function checks if an image exists, with caching for performance
// It's defined outside of hooks to maintain consistent reference
const checkImageExists = async (url: string): Promise<boolean> => {
  // Use a global cache key that persists across sessions
  const cacheKey = `img-check-${url}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached === 'true';

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      localStorage.setItem(cacheKey, 'true');
      resolve(true);
    };
    img.onerror = () => {
      localStorage.setItem(cacheKey, 'false');
      resolve(false);
    };
    img.src = url;
  });
};

// Generate a manifest of all available custom images (runs once at module level)
const generateImageManifest = async () => {
  // Check if we've already generated the manifest
  if (GLOBAL_IMAGE_MANIFEST.initialCheck) {
    return GLOBAL_IMAGE_MANIFEST.customImages;
  }

  // Mark as checked to prevent duplicate work
  GLOBAL_IMAGE_MANIFEST.initialCheck = true;

  // Try to load manifest from storage first (fastest path)
  try {
    const cachedManifest = localStorage.getItem('netflix-grid-manifest');
    if (cachedManifest) {
      const parsed = JSON.parse(cachedManifest);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        GLOBAL_IMAGE_MANIFEST.customImages = parsed;
        GLOBAL_IMAGE_MANIFEST.loaded = true;
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading image manifest:', e);
  }

  // If no cache, check all possible images
  const customImages: string[] = [];
  const checkPromises: Promise<void>[] = [];
  const foundIndices = new Set<number>();

  // Check all possible image indices
  for (let i = 1; i <= 32; i++) {
    const possibleExtensions = ['webp', 'jpg', 'jpeg', 'png'];
    
    // First priority: Check optimized WebP images
    const optimizedPath = `/images/netflix-grid/optimized/image-${i}.webp`;
    const checkOptimized = checkImageExists(optimizedPath).then(exists => {
      if (exists) {
        customImages.push(optimizedPath);
        foundIndices.add(i);
      }
    });
    checkPromises.push(checkOptimized);
    
    // Only check original if optimized wasn't found
    const checkOriginals = async () => {
      if (foundIndices.has(i)) return;
      
      for (const ext of possibleExtensions) {
        const path = `/images/netflix-grid/image-${i}.${ext}`;
        const exists = await checkImageExists(path);
        if (exists) {
          customImages.push(path);
          foundIndices.add(i);
          break;
        }
      }
    };
    
    const origCheck = checkOptimized.then(() => checkOriginals());
    checkPromises.push(origCheck);
  }

  // Wait for all checks to complete
  await Promise.all(checkPromises);

  // For missing indices, use STABLE fallback images (crucial for consistency)
  for (let i = 1; i <= 32; i++) {
    if (!foundIndices.has(i)) {
      // Use a deterministic mapping to fallback images
      // The crucial part is this must always return the SAME image for the SAME index
      const fallbackIndex = (i % fallbackImages.length);
      customImages.push(fallbackImages[fallbackIndex]);
    }
  }

  // Cache manifest for future use
  try {
    localStorage.setItem('netflix-grid-manifest', JSON.stringify(customImages));
  } catch (e) {
    console.error('Error saving image manifest:', e);
  }

  // Update global reference for future use
  GLOBAL_IMAGE_MANIFEST.customImages = customImages;
  GLOBAL_IMAGE_MANIFEST.loaded = true;
  
  return customImages;
};

// Call this immediately to start loading on page load
generateImageManifest().catch(console.error);

// Custom hook to provide images from the manifest
const useImageManifest = (propImages?: string[]) => {
  // If props provided, always use those first
  if (propImages && propImages.length > 0) {
    return { 
      images: propImages, 
      isLoaded: true 
    };
  }
  
  const [isLoaded, setIsLoaded] = useState(GLOBAL_IMAGE_MANIFEST.loaded);
  const [images, setImages] = useState(GLOBAL_IMAGE_MANIFEST.customImages);
  
  useEffect(() => {
    // If manifest is already loaded, use it immediately
    if (GLOBAL_IMAGE_MANIFEST.loaded) {
      setImages(GLOBAL_IMAGE_MANIFEST.customImages);
      setIsLoaded(true);
      return;
    }
    
    // Otherwise wait for the manifest generation to complete
    const loadManifest = async () => {
      const manifest = await generateImageManifest();
      setImages(manifest);
      setIsLoaded(true);
    };
    
    loadManifest().catch(console.error);
    
    // Check every 100ms if the manifest is loaded (for race conditions)
    const interval = setInterval(() => {
      if (GLOBAL_IMAGE_MANIFEST.loaded) {
        setImages(GLOBAL_IMAGE_MANIFEST.customImages);
        setIsLoaded(true);
        clearInterval(interval);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, []);
  
  return { images, isLoaded };
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
  // Prepare row for animation before it renders
  const rowRef = useRef<HTMLDivElement>(null);
  
  // Use this effect to prepare the animation
  useEffect(() => {
    if (!rowRef.current) return;
    
    // Apply transform properties before animation starts to improve performance
    const row = rowRef.current;
    
    // Force a reflow to ensure the will-change property is applied before animation
    void row.offsetHeight;
    
    // Add a class that will start the animation with a slight delay
    setTimeout(() => {
      row.classList.add(isScrollLeft ? styles.scrollLeftActive : styles.scrollRightActive);
    }, rowIndex * 120); // Staggered animation start
  }, [rowIndex, isScrollLeft]);
  
  return (
    <div
      ref={rowRef}
      className={`${styles.posterRow} ${isScrollLeft ? styles.scrollLeft : styles.scrollRight}`}
      style={{
        transform: `translateZ(${zTranslate}px) translateX(${isScrollLeft ? '0px' : '-20px'})`,
        willChange: 'transform'
      }}
      data-row-index={rowIndex}
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
            key={poster.id}
            className={styles.posterItem}
            style={{
              backgroundImage: `url(${poster.imageUrl})`,
              transform,
              zIndex: 4 - rowIndex,
              animationDelay: `${posterIndex * 50}ms`,
            }}
            aria-label={poster.altText}
            data-row={rowIndex}
            data-position={posterIndex}
            data-image-url={poster.imageUrl}
          />
        );
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  // We only want to re-render if essential props change
  return (
    prevProps.rowIndex === nextProps.rowIndex &&
    prevProps.isScrollLeft === nextProps.isScrollLeft &&
    prevProps.zTranslate === nextProps.zTranslate &&
    prevProps.posters === nextProps.posters &&
    prevProps.isMobile === nextProps.isMobile
  );
});

// Add a loading state component that appears quickly
const LoadingState = () => (
  <div className={styles.netflixBackground}>
    <div className={styles.loadingOverlay}>
      <div className={styles.loadingSpinner} />
    </div>
  </div>
);

const NetflixBackground: React.FC<NetflixBackgroundProps> = React.memo(({
  imageUrls,
}) => {
  const { width: windowWidth } = useWindowSize();
  const backgroundRef = useRef<HTMLDivElement>(null);
  const isInViewport = useIsInViewport(backgroundRef);
  const [renderContent, setRenderContent] = useState(false);
  
  // Use the manifest-based approach instead of dynamic loading
  const { images: manifestImages, isLoaded: manifestLoaded } = useImageManifest(imageUrls);
  
  // Detect if we're on desktop for optimizations
  const isDesktop = useMemo(() => (windowWidth || 0) >= 1025, [windowWidth]);
  const isMobile = useMemo(() => (windowWidth || 0) < 768, [windowWidth]);
  
  // This ensures we have the manifest loaded before showing content
  useEffect(() => {
    if (manifestLoaded) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setRenderContent(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [manifestLoaded]);

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
    
    // Create configuration for each row - important to keep this stable
    const rowConfig = Array(rowCount).fill(0).map((_, index) => ({
      // Alternating scroll direction
      isScrollLeft: index % 2 === 0,
      // Slight variations in number of posters per row
      posterCount: postersPerRow + (index % 2 === 0 ? 1 : -1),
    }));
    
    return { 
      rowConfig,
      totalVisiblePosters: rowCount * postersPerRow
    };
  }, [windowWidth]);
  
  // Aggressively preload images
  useImagePreloader(manifestImages);

  // Initialize poster arrays only once across renders with perfect stability
  const rowPosters = useMemo(() => {
    // Don't create rows until we have the images
    if (!manifestLoaded || manifestImages.length === 0) {
      return [];
    }
    
    return rowConfig.map((config, rowIndex) => {
      // Generate a stable, permanent cache key that won't change
      const cacheKey = `stable-row-${rowIndex}-${config.posterCount}`;
      
      // If we have a cached version, use it for perfect stability
      if (POSTER_CACHE.has(cacheKey)) {
        return POSTER_CACHE.get(cacheKey)!;
      }
      
      // Calculate stable multiplier and poster count
      const posterMultiplier = isDesktop ? 3 : 2.5;
      const totalPosters = Math.ceil(config.posterCount * posterMultiplier);
      
      // Create new posters with truly stable IDs and positions
      const rowPosters: Poster[] = [];
      
      // Use a deterministic, stable offset based on row
      const startOffset = (rowIndex * 7) % Math.max(1, manifestImages.length);
      
      for (let i = 0; i < totalPosters; i++) {
        // Ensure completely consistent image selection
        // This is the critical part - we need to use the same formula every time
        const imageIndex = (startOffset + i) % manifestImages.length;
        const imageUrl = manifestImages[imageIndex];
        
        // Create truly stable IDs that won't change between renders
        // The critical part is including both rowIndex and i in the ID
        const stableId = `stable-poster-${rowIndex}-${i}-${imageIndex}`;
        
        rowPosters.push({
          id: stableId,
          imageUrl,
          altText: `Poster ${i + 1} in row ${rowIndex + 1}`,
        });
      }
      
      // Cache and return - this is important as we never want these to change
      POSTER_CACHE.set(cacheKey, rowPosters);
      savePosterCache(POSTER_CACHE);
      
      return rowPosters;
    });
  }, [manifestLoaded, manifestImages, rowConfig, isDesktop]);

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

  if (!renderContent || !manifestLoaded || rowPosters.length === 0) {
    // More responsive loading state
    return <LoadingState />;
  }

  return (
    <div ref={backgroundRef} className={styles.netflixBackground} aria-hidden="true">
      <div className={styles.perspectiveContainer}>
        <div className={styles.gridContainer}>
          {rowConfig.map((config, rowIndex) => {
            // Calculate depth based on row index
            const rowDepth = isMobile ? 25 - (rowIndex * 3) : 35 - (rowIndex * 4);
            const zTranslate = -rowIndex * rowDepth;
            
            return (
              <PosterRow
                key={`permanent-row-${rowIndex}`} // Use truly stable keys
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
});

// Prevent unnecessary re-renders with memo
export default React.memo(NetflixBackground); 