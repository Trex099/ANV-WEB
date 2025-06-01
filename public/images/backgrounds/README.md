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
   - ...and so on up to `background-18.jpg`

3. Place the files in this directory (`public/images/backgrounds/`)

4. The website will automatically use these images in the background grid

## Important Notes

- The background has 18 image slots (a 6x3 grid)
- Images will be automatically cropped and scaled to fit their grid cells
- For best results, use images with good contrast and clear subjects
- Darker images work better as they'll blend well with the semi-transparent overlay

If you want to change the number of images or adjust the grid layout, you can modify the `ImageGridBackground.tsx` component. 