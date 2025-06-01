# Background Images Directory

This directory is where you can place your custom background images for the Netflix-style grid background on the main page.

## How to Replace Placeholder Images

1. Prepare your images:
   - Recommended aspect ratio: 2:3 (portrait orientation)
   - Recommended resolution: at least 300x450 pixels
   - Format: JPG or PNG

2. Name your images following this pattern:
   - `background-1.jpg`
   - `background-2.jpg`
   - `background-3.jpg`
   - ...and so on up to `background-48.jpg`

3. Place the files in this directory (`public/images/backgrounds/`)

4. The website will automatically use these images in the background grid

## Important Notes

- The background now supports up to 48 image slots (dynamically adjusting columns based on screen size: 8, 10, or 12 columns).
- Images will be automatically tilted, scaled, and positioned to create the deep perspective Netflix-style effect.
- The grid has a strong perspective effect that creates a "wall of media" look, with images appearing to recede into the distance.
- Images may overlap slightly for a more dynamic appearance.
- For best results, use images with good contrast and clear subjects.
- Darker images work better as they'll blend well with the semi-transparent overlay.

If you want to change the number of images or adjust the grid layout, you can modify the `ImageGridBackground.tsx` component. 