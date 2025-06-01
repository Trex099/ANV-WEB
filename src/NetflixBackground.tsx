import React, { useMemo } from 'react';
import styles from './NetflixBackground.module.css';

interface Poster {
  id: string;
  imageUrl: string;
  altText: string;
}

interface NetflixBackgroundProps {
  imageUrls?: string[]; // Optional, will use placeholders if not provided
  numRows?: number;
  postersPerRow?: number;
}

const generatePlaceholderPosters = (count: number): Poster[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `placeholder-${i}`,
    imageUrl: `https://picsum.photos/seed/${i + 100}/200/300`, // Seeded for consistency
    altText: `Placeholder Poster ${i + 1}`,
  }));
};

const NetflixBackground: React.FC<NetflixBackgroundProps> = ({
  imageUrls,
  numRows = 6, // Default 6 rows
  postersPerRow = 15, // Default 15 posters per row (to ensure overflow)
}) => {
  const posters = useMemo(() => {
    if (imageUrls && imageUrls.length > 0) {
      return imageUrls.map((url, i) => ({
        id: `custom-${i}`,
        imageUrl: url,
        altText: `Custom Poster ${i + 1}`,
      }));
    }
    return generatePlaceholderPosters(numRows * postersPerRow);
  }, [imageUrls, numRows, postersPerRow]);

  // Create a 2D array for rows of posters
  const posterRows: Poster[][] = useMemo(() => {
    const rows: Poster[][] = [];
    let posterIndex = 0;
    for (let i = 0; i < numRows; i++) {
      const rowPosters: Poster[] = [];
      for (let j = 0; j < postersPerRow; j++) {
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
          {posterRows.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className={`${styles.posterRow} ${rowIndex % 2 === 0 ? styles.scrollLeft : styles.scrollRight}`}
              style={{
                // Increased translateZ multiplier for more pronounced depth between rows
                // Staggering X based on row index still for some variation
                transform: `translateZ(${-rowIndex * 60}px) translateX(${rowIndex % 2 === 0 ? '0px' : '-30px'})`,
              }}
            >
              {row.map((poster, posterIndex) => {
                const rotateY = Math.random() * 20 - 10; // Reduced Y rotation range
                const rotateX = Math.random() * 8 - 4;  // Reduced X rotation range
                const skewY = Math.random() * 6 - 3;   // Reduced SkewY range
                const zOffset = Math.random() * 15 - 7.5; 

                return (
                  <div
                    key={`${rowIndex}-${poster.id}-${posterIndex}`}
                    className={styles.posterItem}
                    style={{
                      backgroundImage: `url(${poster.imageUrl})`,
                      transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg) skewY(${skewY}deg) translateZ(${zOffset}px)`,
                      zIndex: Math.floor(Math.random() * (numRows - rowIndex)), // Tie zIndex to row for better layering
                    }}
                    aria-label={poster.altText}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NetflixBackground; 