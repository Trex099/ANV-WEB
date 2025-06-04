import React, { useMemo, useState, useEffect } from 'react';
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

// Higher quality movie/show poster URLs for a more authentic look
const netflixPosters = [
  'https://picsum.photos/id/96/400/600',  // Use specific IDs for more consistent images
  'https://picsum.photos/id/1060/400/600',
  'https://picsum.photos/id/110/400/600',
  'https://picsum.photos/id/1047/400/600',
  'https://picsum.photos/id/237/400/600',
  'https://picsum.photos/id/26/400/600',
  'https://picsum.photos/id/27/400/600',
  'https://picsum.photos/id/28/400/600',
  'https://picsum.photos/id/29/400/600',
  'https://picsum.photos/id/34/400/600',
  'https://picsum.photos/id/42/400/600',
  'https://picsum.photos/id/48/400/600',
  'https://picsum.photos/id/65/400/600',
  'https://picsum.photos/id/80/400/600',
  'https://picsum.photos/id/91/400/600',
  'https://picsum.photos/id/111/400/600',
  'https://picsum.photos/id/133/400/600',
  'https://picsum.photos/id/142/400/600',
  'https://picsum.photos/id/164/400/600',
  'https://picsum.photos/id/179/400/600'
];

const generatePlaceholderPosters = (count: number): Poster[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `placeholder-${i}`,
    imageUrl: netflixPosters[i % netflixPosters.length], // Use our preset posters
    altText: `Poster ${i + 1}`,
  }));
};

const NetflixBackground: React.FC<NetflixBackgroundProps> = ({
  imageUrls,
}) => {
  const { width: windowWidth } = useWindowSize();

  const { numRows, postersPerRow, isSmallScreen, isVerySmallScreen } = useMemo(() => {
    const width = windowWidth || 0;
    let rows = 7; // Increased rows for fuller coverage
    let posters = 16; // More posters per row for a denser look
    let smallScreen = false;
    let verySmallScreen = false;

    if (width < 480) {
      rows = 6; // Increased from 5 to provide better coverage on small screens
      posters = 9; // Increased from 8 for better coverage on mobile
      smallScreen = true;
      verySmallScreen = true;
    } else if (width < 768) {
      rows = 7; // Increased from 6
      posters = 11;
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

  const posters = useMemo(() => {
    if (imageUrls && imageUrls.length > 0) {
      return imageUrls.map((url, i) => ({
        id: `custom-${i}`,
        imageUrl: url,
        altText: `Custom Poster ${i + 1}`,
      }));
    }
    return generatePlaceholderPosters(numRows * postersPerRow * 2); // Extra posters for variety
  }, [imageUrls, numRows, postersPerRow]);

  // Optimize image loading for mobile
  useEffect(() => {
    // Preload a subset of images for faster initial rendering on mobile
    if (isSmallScreen) {
      const imagesToPreload = netflixPosters.slice(0, 10); // Load fewer images on mobile
      imagesToPreload.forEach(src => {
        const img = new Image();
        img.src = src;
      });
    }
  }, [isSmallScreen]);

  const posterRows: Poster[][] = useMemo(() => {
    const rows: Poster[][] = [];
    let posterIndex = 0;
    for (let i = 0; i < numRows; i++) {
      const rowPosters: Poster[] = [];
      // Add more posters than needed to ensure the infinite scroll effect works well
      for (let j = 0; j < postersPerRow * 2; j++) {
        // Cycle through available posters if not enough unique ones
        rowPosters.push(posters[posterIndex % posters.length]);
        posterIndex++;
      }
      rows.push(rowPosters);
    }
    return rows;
  }, [posters, numRows, postersPerRow]);

  return (
    <div className={styles.netflixBackground}>
      <div className={styles.perspectiveContainer}>
        <div className={styles.gridContainer}>
          {posterRows.map((row, rowIndex) => {
            // Adjust depth based on row for more dramatic perspective
            let rowTranslateZMultiplier = 60;
            if (isVerySmallScreen) {
              rowTranslateZMultiplier = 30; // Increased from 25 for better mobile visibility
            } else if (isSmallScreen) {
              rowTranslateZMultiplier = 45; // Increased from 40
            }

            return (
              <div
                key={`row-${rowIndex}`}
                className={`${styles.posterRow} ${rowIndex % 2 === 0 ? styles.scrollLeft : styles.scrollRight}`}
                style={{
                  transform: `translateZ(${-rowIndex * rowTranslateZMultiplier}px) translateX(${rowIndex % 2 === 0 ? '0px' : (isSmallScreen ? '-10px' : '-30px')})`,
                }}
              >
                {row.map((poster, posterIndex) => {
                  // More subtle random variations
                  const rYMultiplier = isSmallScreen ? 4 : 8; // Reduced for stability on mobile
                  const rXMultiplier = isSmallScreen ? 1 : 3;
                  const skewMultiplier = isSmallScreen ? 0.5 : 1.5;
                  const zMultiplier = isSmallScreen ? 2 : 5;

                  const rotateY = Math.random() * rYMultiplier - rYMultiplier / 2;
                  const rotateX = Math.random() * rXMultiplier - rXMultiplier / 2;
                  const skewY = Math.random() * skewMultiplier - skewMultiplier / 2;
                  const zOffset = Math.random() * zMultiplier - zMultiplier / 2;

                  return (
                    <div
                      key={`${rowIndex}-${poster.id}-${posterIndex}`}
                      className={styles.posterItem}
                      style={{
                        backgroundImage: `url(${poster.imageUrl})`,
                        transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg) skewY(${skewY}deg) translateZ(${zOffset}px)`,
                        zIndex: Math.floor(Math.random() * (numRows - rowIndex + 1)),
                      }}
                      aria-label={poster.altText}
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