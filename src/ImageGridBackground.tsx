import React from 'react';

// Generate placeholder images - in production these would be replaced with real images
const generatePlaceholderImages = (count: number) => {
  return Array.from({ length: count }).map((_, index) => ({
    id: index,
    src: `/images/backgrounds/background-${index + 1}.jpg`,
    alt: `Background image ${index + 1}`,
    // Use this path to replace with your own images later
  }));
};

const ImageGridBackground: React.FC = () => {
  const placeholderImages = generatePlaceholderImages(48); // Increased image count for more density

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none select-none -z-10">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-75 z-10"></div>

      {/* Netflix-style perspective container */}
      <div
        className="absolute inset-0"
        style={{
          perspective: '800px', // Stronger perspective
          transformStyle: 'preserve-3d',
          overflow: 'visible', // Allow images to overflow for a fuller look
        }}
      >
        <div
          className="absolute w-full h-full" // Ensure it covers the area
          style={{
            transform: 'rotateX(50deg) translateY(-30%) scale(1.5)', // Adjusted rotation, translation, and scale
            transformOrigin: 'center bottom', // Pivot from bottom center
          }}
        >
          {/* Image grid with Netflix-style angled layout */}
          {/* Increased density by adding more columns and adjusting gap/padding */}
          <div className="absolute inset-[-20%] grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 p-2">
            {placeholderImages.map((image) => {
              const rotation = Math.random() * 4 - 2; // -2 to 2 degrees
              const scale = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
              const zIndex = Math.floor(Math.random() * 5); // Random z-index for overlap

              return (
                <div
                  key={image.id}
                  className="relative aspect-[2/3] overflow-hidden rounded shadow-md"
                  style={{
                    transform: `rotate(${rotation}deg) scale(${scale})`,
                    transition: 'transform 0.5s ease-out',
                    zIndex: zIndex, // Apply z-index
                  }}
                >
                  <div
                    className="absolute inset-0 bg-gradient-to-br"
                    style={{
                      backgroundImage: `linear-gradient(to bottom right,
                        hsl(${(image.id * 15) % 360}, 60%, 25%),
                        hsl(${(image.id * 15 + 30) % 360}, 60%, 45%))`,
                      transform: `scale(1.03)`, // Slight inner scale for border effect
                      filter: 'brightness(0.8)', // Slightly darken images
                    }}
                  ></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGridBackground; 