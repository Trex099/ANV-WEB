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
  const placeholderImages = generatePlaceholderImages(18); // 18 images for the grid
  
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-60 z-10"></div>
      
      {/* Image grid */}
      <div className="absolute inset-0 grid grid-cols-6 gap-1 p-1" style={{ opacity: 0.7 }}>
        {placeholderImages.map((image) => (
          <div key={image.id} className="relative aspect-[2/3] overflow-hidden">
            {/* 
              These divs will display a colored placeholder until images are added
              Replace these with real images by adding files to:
              /public/images/backgrounds/background-1.jpg, background-2.jpg, etc.
            */}
            <div
              className="absolute inset-0 bg-gradient-to-br"
              style={{
                backgroundImage: `linear-gradient(to bottom right, 
                  hsl(${(image.id * 20) % 360}, 70%, 30%), 
                  hsl(${(image.id * 20 + 40) % 360}, 70%, 50%))`,
                transform: `scale(1.05)`,
              }}
            ></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageGridBackground; 