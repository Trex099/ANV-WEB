import React, { useMemo, useState, useEffect, useRef } from 'react';
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

// Optimized and higher quality poster URLs
const netflixPosters = [
  'https://picsum.photos/id/96/300/450',
  'https://picsum.photos/id/1060/300/450',
  'https://picsum.photos/id/110/300/450',
  'https://picsum.photos/id/1047/300/450',
  'https://picsum.photos/id/237/300/450',
  'https://picsum.photos/id/26/300/450',
  'https://picsum.photos/id/27/300/450',
  'https://picsum.photos/id/28/300/450',
  'https://picsum.photos/id/29/300/450',
  'https://picsum.photos/id/42/300/450',
  'https://picsum.photos/id/48/300/450',
  'https://picsum.photos/id/65/300/450',
  'https://picsum.photos/id/111/300/450',
  'https://picsum.photos/id/133/300/450',
  'https://picsum.photos/id/164/300/450',
];

const generatePlaceholderPosters = (count: number): Poster[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `placeholder-${i}`,
    imageUrl: netflixPosters[i % netflixPosters.length], // Use our preset posters
    altText: `Poster ${i + 1}`,
  }));
};

// Custom hook for checking if an element is in viewport
// Fixed the type definition of the ref parameter to resolve the TypeScript error
const useIsInViewport = (ref: React.RefObject<HTMLDivElement>) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Update state when observer callback fires
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

const NetflixBackground: React.FC<NetflixBackgroundProps> = ({
  imageUrls,
}) => {
  const { width: windowWidth } = useWindowSize();
  const backgroundRef = useRef<HTMLDivElement>(null);
  // The issue was in how we use the custom hook - it expects a proper ref
  const isInViewport = useIsInViewport(backgroundRef);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Detect if we're on desktop for optimizations
  const isDesktop = useMemo(() => (windowWidth || 0) >= 1025, [windowWidth]);
  
  // Load images progressively but faster
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (isInViewport && !isLoaded) {
      // Reduce the delay for faster loading
      timeout = setTimeout(() => {
        setIsLoaded(true);
      }, 50); // Reduced from 100ms
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isInViewport, isLoaded]);

  const { numRows, postersPerRow, isSmallScreen, isVerySmallScreen } = useMemo(() => {
    const width = windowWidth || 0;
    // Adjust rows and poster counts
    let rows = 6; // Increased for more coverage
    let posters = 14; // Increased for more coverage
    let smallScreen = false;
    let verySmallScreen = false;

    if (width < 480) {
      rows = 5;
      posters = 8;
      smallScreen = true;
      verySmallScreen = true;
    } else if (width < 768) {
      rows = 5;
      posters = 9;
      smallScreen = true;
    } else if (width < 1024) {
      rows = 6;
      posters = 12;
    } else if (width < 1440) {
      rows = 7; // More rows for desktop
      posters = 15;
    } else {
      rows = 8; // Even more for large screens
      posters = 18;
    }
    return { numRows: rows, postersPerRow: posters, isSmallScreen: smallScreen, isVerySmallScreen: verySmallScreen };
  }, [windowWidth]);

  const posters = useMemo(() => {
    if (imageUrls && imageUrls.length > 0) {
      return imageUrls.map((url, i) => ({
        id: `custom-${i}`,
        imageUrl: url,
        altText: `Custom Poster ${i + 1}`,
      }));
    }
    // Add enough posters for better coverage, especially on desktop
    const posterCount = isDesktop ? numRows * postersPerRow * 1.5 : numRows * postersPerRow;
    return generatePlaceholderPosters(Math.ceil(posterCount));
  }, [imageUrls, numRows, postersPerRow, isDesktop]);

  // Preload essential images
  useEffect(() => {
    // Preload more images for desktop, fewer for mobile
    const imagesToPreload = netflixPosters.slice(0, isSmallScreen ? 5 : 10);
    
    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, [isSmallScreen]);

  // Calculate poster rows with enough posters for smooth scrolling
  const posterRows: Poster[][] = useMemo(() => {
    // Don't calculate if not in viewport, but do minimal calculation for faster initial render
    if (!isInViewport && !isLoaded) {
      return [];
    }
    
    const rows: Poster[][] = [];
    let posterIndex = 0;
    
    for (let i = 0; i < numRows; i++) {
      const rowPosters: Poster[] = [];
      // Add more posters per row for smoother scrolling
      // For desktop, we want more posters to fill the screen
      const postersMultiplier = isDesktop ? 3 : 2;
      const actualPostersPerRow = postersPerRow * postersMultiplier;
      
      for (let j = 0; j < actualPostersPerRow; j++) {
        rowPosters.push(posters[posterIndex % posters.length]);
        posterIndex++;
      }
      
      rows.push(rowPosters);
    }
    
    return rows;
  }, [posters, numRows, postersPerRow, isInViewport, isLoaded, isDesktop]);

  // Enable hardware acceleration
  useEffect(() => {
    document.body.style.transform = 'translateZ(0)';
    
    return () => {
      document.body.style.transform = '';
    };
  }, []);

  if (!isInViewport && !isLoaded) {
    // Render minimal content until in viewport
    return <div ref={backgroundRef} className={styles.netflixBackground}></div>;
  }

  return (
    <div ref={backgroundRef} className={styles.netflixBackground}>
      <div className={styles.perspectiveContainer}>
        <div className={styles.gridContainer}>
          {posterRows.map((row, rowIndex) => {
            // Adjusted depth for better visibility
            const rowDepth = isVerySmallScreen ? 20 : (isSmallScreen ? 30 : 40);
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
                  // Use smaller rotations for stability
                  const rotateY = isSmallScreen ? 0 : (Math.sin(posterIndex * 0.5) * 4);
                  const rotateX = isSmallScreen ? 0 : (Math.cos(posterIndex * 0.5) * 2);
                  
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
                        opacity: isLoaded ? undefined : 0,
                        transition: 'opacity 0.3s ease-out'
                      }}
                      aria-label={poster.altText}
                      data-loading="lazy"
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

export default NetflixBackground; 