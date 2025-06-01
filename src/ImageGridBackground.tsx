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
  const placeholderImages = generatePlaceholderImages(24); // More images for a fuller grid
  
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none select-none -z-10">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-70 z-10"></div>
      
      {/* Netflix-style perspective container */}
      <div className="absolute inset-0" 
           style={{ 
             perspective: '1200px',
             transformStyle: 'preserve-3d',
             overflow: 'hidden',
           }}>
        <div className="absolute inset-0" 
             style={{ 
               transform: 'rotateX(12deg) translateY(5%) scale(1.3)',
               transformOrigin: 'center top',
             }}>
          {/* Image grid with Netflix-style angled layout */}
          <div className="absolute inset-0 grid grid-cols-6 md:grid-cols-8 gap-3 p-6">
            {placeholderImages.map((image) => {
              // Calculate random offsets and rotations for each tile
              const rotation = Math.random() * 3 - 1.5; // -1.5 to 1.5 degrees
              const scale = 0.95 + Math.random() * 0.1; // 0.95 to 1.05
              const offsetX = Math.random() * 10 - 5; // -5px to 5px
              const offsetY = Math.random() * 10 - 5; // -5px to 5px
              
              return (
                <div 
                  key={image.id} 
                  className="relative aspect-[2/3] overflow-hidden rounded-md shadow-lg"
                  style={{
                    transform: `rotate(${rotation}deg) scale(${scale}) translate(${offsetX}px, ${offsetY}px)`,
                    transition: 'transform 0.3s ease-out',
                  }}
                >
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGridBackground; 