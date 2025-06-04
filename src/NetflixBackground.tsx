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

// Optimized and smaller poster set with lower resolution images
// Using lower resolution images (200x300 instead of 400x600)
const netflixPosters = [
  'https://picsum.photos/id/96/200/300',
  'https://picsum.photos/id/1060/200/300',
  'https://picsum.photos/id/110/200/300',
  'https://picsum.photos/id/1047/200/300',
  'https://picsum.photos/id/237/200/300',
  'https://picsum.photos/id/26/200/300',
  'https://picsum.photos/id/27/200/300',
  'https://picsum.photos/id/28/200/300',
  'https://picsum.photos/id/29/200/300',
  'https://picsum.photos/id/42/200/300'
];

const generatePlaceholderPosters = (count: number): Poster[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `placeholder-${i}`,
    imageUrl: netflixPosters[i % netflixPosters.length], // Use our preset posters
    altText: `Poster ${i + 1}`,
  }));
};

// Custom hook for checking if an element is in viewport
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
  const isInViewport = useIsInViewport(backgroundRef);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Load images progressively
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (isInViewport && !isLoaded) {
      timeout = setTimeout(() => {
        setIsLoaded(true);
      }, 100);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isInViewport, isLoaded]);

  const { numRows, postersPerRow, isSmallScreen, isVerySmallScreen } = useMemo(() => {
    const width = windowWidth || 0;
    // Reduce number of rows and posters for better performance
    let rows = 5; // Decreased from 7
    let posters = 12; // Decreased from 16
    let smallScreen = false;
    let verySmallScreen = false;

    if (width < 480) {
      rows = 4; // Decreased from 6
      posters = 7; // Decreased from 9
      smallScreen = true;
      verySmallScreen = true;
    } else if (width < 768) {
      rows = 5; // Decreased from 7
      posters = 8; // Decreased from 11
      smallScreen = true;
    } else if (width < 1024) {
      rows = 5; // Decreased from 7
      posters = 10; // Decreased from 12
    } else if (width < 1440) {
      rows = 5;
      posters = 12;
    } else {
      rows = 6;
      posters = 14;
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
    // Reduced from numRows * postersPerRow * 2 to improve performance
    return generatePlaceholderPosters(numRows * postersPerRow);
  }, [imageUrls, numRows, postersPerRow]);

  // Preload essential images only
  useEffect(() => {
    // Only preload a small subset of images
    const imagesToPreload = netflixPosters.slice(0, isSmallScreen ? 4 : 6);
    
    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, [isSmallScreen]);

  // Calculate poster rows with optimized performance
  const posterRows: Poster[][] = useMemo(() => {
    // Don't calculate if not in viewport or not loaded for performance
    if (!isInViewport && !isLoaded) {
      return [];
    }
    
    const rows: Poster[][] = [];
    let posterIndex = 0;
    
    for (let i = 0; i < numRows; i++) {
      const rowPosters: Poster[] = [];
      // Use fewer posters per row for performance
      const actualPostersPerRow = postersPerRow + (i % 2 === 0 ? 2 : 0);
      
      for (let j = 0; j < actualPostersPerRow; j++) {
        rowPosters.push(posters[posterIndex % posters.length]);
        posterIndex++;
      }
      
      rows.push(rowPosters);
    }
    
    return rows;
  }, [posters, numRows, postersPerRow, isInViewport, isLoaded]);

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
            // Simplified Z-translation for better performance
            const rowDepth = isVerySmallScreen ? 25 : (isSmallScreen ? 35 : 50);
            const zTranslate = -rowIndex * rowDepth;
            
            // Only apply different animation directions to alternate rows
            // This reduces the CSS complexity
            const isEvenRow = rowIndex % 2 === 0;
            
            return (
              <div
                key={`row-${rowIndex}`}
                className={`${styles.posterRow} ${isEvenRow ? styles.scrollLeft : styles.scrollRight}`}
                style={{
                  transform: `translateZ(${zTranslate}px) translateX(${isEvenRow ? '0px' : '-20px'})`,
                  // Apply will-change only to actively animating properties for performance
                  willChange: 'transform'
                }}
              >
                {row.map((poster, posterIndex) => {
                  // Greatly simplified transforms for better performance
                  // Use smaller angle variations
                  const rotateY = isSmallScreen ? 0 : (Math.random() * 6 - 3);
                  const rotateX = isSmallScreen ? 0 : (Math.random() * 4 - 2);
                  
                  // Skip applying transforms on mobile entirely for better performance
                  const transform = isVerySmallScreen 
                    ? '' 
                    : `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
                  
                  // Apply lower z-index for mobile
                  const zIndex = Math.min(numRows - rowIndex, 3);
                  
                  return (
                    <div
                      key={`${rowIndex}-${poster.id}-${posterIndex}`}
                      className={styles.posterItem}
                      style={{
                        backgroundImage: `url(${poster.imageUrl})`,
                        transform,
                        zIndex,
                        // Apply loading strategy
                        opacity: isLoaded ? undefined : 0,
                        transition: 'opacity 0.3s ease-out'
                      }}
                      aria-label={poster.altText}
                      data-loading="lazy" // Use data attribute instead of loading
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