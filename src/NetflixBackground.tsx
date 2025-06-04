import React, { useMemo, useState, useEffect, useRef } from 'react';
// Add @ts-ignore to suppress module not found error
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
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener('resize', handleResize);
    handleResize(); // Call handler right away so state gets updated with initial window size
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return windowSize;
};

// Higher quality poster URLs
const netflixPosters = [
  'https://picsum.photos/id/96/350/525',
  'https://picsum.photos/id/1060/350/525',
  'https://picsum.photos/id/110/350/525',
  'https://picsum.photos/id/1047/350/525',
  'https://picsum.photos/id/237/350/525',
  'https://picsum.photos/id/26/350/525',
  'https://picsum.photos/id/27/350/525',
  'https://picsum.photos/id/28/350/525',
  'https://picsum.photos/id/29/350/525',
  'https://picsum.photos/id/42/350/525',
  'https://picsum.photos/id/48/350/525',
  'https://picsum.photos/id/65/350/525',
  'https://picsum.photos/id/111/350/525',
  'https://picsum.photos/id/133/350/525',
  'https://picsum.photos/id/164/350/525',
];

// Create posters with stable IDs to prevent refreshing
const generatePlaceholderPosters = (count: number): Poster[] => {
  // Create a fixed array of posters to avoid re-rendering
  const allPosters = Array.from({ length: Math.max(count, 100) }).map((_, i) => ({
    id: `poster-${i}`, // Stable ID
    imageUrl: netflixPosters[i % netflixPosters.length],
    altText: `Poster ${i + 1}`,
  }));
  
  return allPosters.slice(0, count);
};

// Fixed version of the hook that accepts null values
const useIsInViewport = (ref: React.RefObject<HTMLDivElement | null>) => {
  const [isIntersecting, setIsIntersecting] = useState(true); // Default to true to show content initially

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

// Memoized posters that won't change between renders
const MEMOIZED_POSTERS = new Map<string, Poster[]>();

const NetflixBackground: React.FC<NetflixBackgroundProps> = ({
  imageUrls,
}) => {
  const { width: windowWidth } = useWindowSize();
  const backgroundRef = useRef<HTMLDivElement>(null);
  // The type error is now fixed in the hook implementation
  const isInViewport = useIsInViewport(backgroundRef);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Detect if we're on desktop for optimizations
  const isDesktop = useMemo(() => (windowWidth || 0) >= 1025, [windowWidth]);
  
  // Load images progressively but faster
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (isInViewport && !isLoaded) {
      timeout = setTimeout(() => {
        setIsLoaded(true);
      }, 50);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isInViewport, isLoaded]);

  const { numRows, postersPerRow, isSmallScreen, isVerySmallScreen } = useMemo(() => {
    const width = windowWidth || 0;
    // Adjust rows and poster counts
    let rows = 6;
    let posters = 14;
    let smallScreen = false;
    let verySmallScreen = false;

    if (width < 480) {
      rows = 5;
      posters = 8;
      smallScreen = true;
      verySmallScreen = true;
    } else if (width < 768) {
      rows = 6;
      posters = 9;
      smallScreen = true;
    } else if (width < 1024) {
      rows = 7;
      posters = 12;
    } else if (width < 1440) {
      rows = 8;
      posters = 15;
    } else {
      rows = 9;
      posters = 18;
    }
    return { numRows: rows, postersPerRow: posters, isSmallScreen: smallScreen, isVerySmallScreen: verySmallScreen };
  }, [windowWidth]);

  // Use memoized posters to prevent re-creation between renders
  const posters = useMemo(() => {
    // Use custom images if provided
    if (imageUrls && imageUrls.length > 0) {
      return imageUrls.map((url, i) => ({
        id: `custom-${i}`,
        imageUrl: url,
        altText: `Custom Poster ${i + 1}`,
      }));
    }
    
    // Calculate how many posters we need
    const postersMultiplier = isDesktop ? 2.5 : 2;
    const totalPosters = numRows * postersPerRow * postersMultiplier;
    const cacheKey = `posters-${totalPosters}`;
    
    // Check if we've already created these posters
    if (!MEMOIZED_POSTERS.has(cacheKey)) {
      MEMOIZED_POSTERS.set(cacheKey, generatePlaceholderPosters(Math.ceil(totalPosters)));
    }
    
    return MEMOIZED_POSTERS.get(cacheKey) || [];
  }, [imageUrls, numRows, postersPerRow, isDesktop]);

  // Preload essential images
  useEffect(() => {
    // Only preload once
    const hasPreloaded = sessionStorage.getItem('netflix-bg-preloaded');
    if (hasPreloaded) return;
    
    // Preload images in sequence to avoid overwhelming the browser
    const preloadNextImage = (index: number) => {
      if (index >= netflixPosters.length) {
        sessionStorage.setItem('netflix-bg-preloaded', 'true');
        return;
      }
      
      const img = new Image();
      img.onload = () => preloadNextImage(index + 1);
      img.src = netflixPosters[index];
    };
    
    preloadNextImage(0);
  }, []);

  // Calculate poster rows with stable reference to prevent re-renders
  const posterRows = useMemo(() => {
    if (!isLoaded) {
      return [];
    }
    
    const rows: Poster[][] = [];
    let posterIndex = 0;
    
    for (let i = 0; i < numRows; i++) {
      const rowPosters: Poster[] = [];
      const postersMultiplier = isDesktop ? 3 : 2;
      const actualPostersPerRow = postersPerRow * postersMultiplier;
      
      for (let j = 0; j < actualPostersPerRow; j++) {
        rowPosters.push(posters[posterIndex % posters.length]);
        posterIndex++;
      }
      
      rows.push(rowPosters);
    }
    
    return rows;
  }, [numRows, postersPerRow, posters, isLoaded, isDesktop]);

  // Enable hardware acceleration for smoother animations
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      * {
        -webkit-transform: translate3d(0, 0, 0);
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!isLoaded) {
    // Render minimal content while loading
    return <div ref={backgroundRef} className={styles.netflixBackground}></div>;
  }

  return (
    <div ref={backgroundRef} className={styles.netflixBackground}>
      <div className={styles.perspectiveContainer}>
        <div className={styles.gridContainer}>
          {posterRows.map((row, rowIndex) => {
            // Adjusted depth for better visibility
            const rowDepth = isVerySmallScreen ? 20 : (isSmallScreen ? 25 : 35);
            const zTranslate = -rowIndex * rowDepth;
            
            // Use row index to determine animation direction
            const isEvenRow = rowIndex % 2 === 0;
            
            return (
              <div
                key={`row-${rowIndex}`}
                className={`${styles.posterRow} ${isEvenRow ? styles.scrollLeft : styles.scrollRight}`}
                style={{
                  transform: `translateZ(${zTranslate}px) translateX(${isEvenRow ? '0px' : '-20px'})`,
                  willChange: 'transform'
                }}
              >
                {row.map((poster, posterIndex) => {
                  // Use deterministic rotations based on position rather than random
                  const baseAngle = (posterIndex % 5) * (Math.PI / 10);
                  const rotateY = isSmallScreen ? 0 : Math.sin(baseAngle) * 5;
                  const rotateX = isSmallScreen ? 0 : Math.cos(baseAngle) * 2;
                  
                  // Skip transforms on mobile entirely
                  const transform = isVerySmallScreen 
                    ? '' 
                    : `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
                  
                  // Deterministic z-index for consistency
                  const zIndex = numRows - rowIndex;
                  
                  return (
                    <div
                      key={`${rowIndex}-${poster.id}-${posterIndex}`}
                      className={styles.posterItem}
                      style={{
                        backgroundImage: `url(${poster.imageUrl})`,
                        transform,
                        zIndex,
                        opacity: undefined, // Use the CSS default
                      }}
                      aria-label={poster.altText}
                      data-loading="lazy"
                      // Prevent refreshes by avoiding state updates on these elements
                      data-stable-poster="true"
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default React.memo(NetflixBackground); // Use memo to prevent unnecessary re-renders 