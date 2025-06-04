# Custom Images for Netflix Grid Background

## How to Add Your Custom Images

1. Place your image files in this folder (`public/images/netflix-grid/`)
2. For best results, use images with the following specifications:
   - Aspect ratio: 2:3 (portrait orientation)
   - Recommended resolution: 240px × 360px
   - File formats supported: JPG, PNG, WEBP
   - Aim for file sizes under 100KB for better performance

## Naming Convention

- Name your files sequentially (e.g., `image-1.jpg`, `image-2.jpg`, etc.)
- The system will automatically load all images from this directory
- Approximately 24-32 images are recommended for a good variety

## Image Count & Display

- The grid shows approximately 24-30 images at once (6-8 per row × 4 rows)
- Images are displayed in 4 rows and will scroll horizontally
- No random refreshes will occur - images maintain stable positions as they scroll
- Desktop displays show more images, mobile displays show fewer

## Default Images

If you don't add custom images, the system will automatically use placeholder images from Lorem Picsum. Once you add your own images with the proper naming convention (`image-1.jpg`, `image-2.jpg`, etc.), they will replace the placeholders.

## Technical Details

- Images are cached for performance
- Deterministic positioning ensures no random refreshing
- Hardware acceleration is used for smoother animations
- Mobile-friendly with responsive sizing

## Important Notes

- For best performance on mobile devices, compress your images appropriately 