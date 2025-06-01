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

const generatePlaceholderPosters = (count: number): Poster[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `placeholder-${i}`,
    imageUrl: `https://picsum.photos/seed/${i + 100}/180/270`, // Using a common size for placeholders
    altText: `Placeholder Poster ${i + 1}`,
  }));
};

const NetflixBackground: React.FC<NetflixBackgroundProps> = ({
  imageUrls,
}) => {
  const { width: windowWidth } = useWindowSize();

  const { numRows, postersPerRow, isSmallScreen, isVerySmallScreen } = useMemo(() => {
    const width = windowWidth || 0;
    let rows = 6;
    let posters = 15;
    let smallScreen = false;
    let verySmallScreen = false;

    if (width < 480) {
      rows = 4;
      posters = 7; // Reduced further for very small screens
      smallScreen = true;
      verySmallScreen = true;
    } else if (width < 768) {
      rows = 5;
      posters = 9; // Reduced for small screens
      smallScreen = true;
    } else if (width < 1024) {
      rows = 5;
      posters = 12;
    } else if (width < 1440) {
      rows = 6;
      posters = 15;
    } else {
      rows = 7;
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
    return generatePlaceholderPosters(numRows * postersPerRow); // Ensure enough placeholders
  }, [imageUrls, numRows, postersPerRow]);

  const posterRows: Poster[][] = useMemo(() => {
    const rows: Poster[][] = [];
    let posterIndex = 0;
    for (let i = 0; i < numRows; i++) {
      const rowPosters: Poster[] = [];
      for (let j = 0; j < postersPerRow; j++) {
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
            let rowTranslateZMultiplier = 50;
            if (isVerySmallScreen) {
              rowTranslateZMultiplier = 20;
            } else if (isSmallScreen) {
              rowTranslateZMultiplier = 30;
            }

            return (
              <div
                key={`row-${rowIndex}`}
                className={`${styles.posterRow} ${rowIndex % 2 === 0 ? styles.scrollLeft : styles.scrollRight}`}
                style={{
                  transform: `translateZ(${-rowIndex * rowTranslateZMultiplier}px) translateX(${rowIndex % 2 === 0 ? '0px' : (isSmallScreen ? '-15px' : '-30px')})`,
                }}
              >
                {row.map((poster, posterIndex) => {
                  const rYMultiplier = isSmallScreen ? 8 : 15; // Further reduced for small
                  const rXMultiplier = isSmallScreen ? 3 : 6;
                  const skewMultiplier = isSmallScreen ? 2 : 4;
                  const zMultiplier = isSmallScreen ? 5 : 10;

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