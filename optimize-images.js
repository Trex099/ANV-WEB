// optimize-images.js
// Note: You'll need to run `npm install sharp --save-dev` to use this script

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, 'public/images/netflix-grid');
const OUTPUT_DIR = path.join(__dirname, 'public/images/netflix-grid/optimized');
const TARGET_SIZE = 240; // Width in pixels

async function optimizeImages() {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Get all image files
    const files = await fs.readdir(TARGET_DIR);
    const imageFiles = files.filter(file => 
      /\.(jpe?g|png|webp)$/i.test(file) && 
      file.startsWith('image-')
    );
    
    console.log(`Found ${imageFiles.length} images to optimize`);
    
    // Process each image
    for (const file of imageFiles) {
      const inputPath = path.join(TARGET_DIR, file);
      const stats = await fs.stat(inputPath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      // Create consistent output name with jpg extension
      const baseName = path.parse(file).name;
      const outputPath = path.join(OUTPUT_DIR, `${baseName}.jpg`);
      
      console.log(`Processing ${file} (${fileSizeInMB.toFixed(2)}MB)...`);
      
      // Use sharp to resize and optimize image
      await sharp(inputPath)
        .resize({
          width: TARGET_SIZE,
          height: Math.floor(TARGET_SIZE * 1.5), // Maintain 2:3 aspect ratio
          fit: 'cover',
          position: 'centre'
        })
        .jpeg({ quality: 75 }) // Optimize as JPEG with 75% quality
        .toFile(outputPath);
        
      const newStats = await fs.stat(outputPath);
      const newFileSizeInMB = newStats.size / (1024 * 1024);
      
      console.log(`✓ Saved to ${outputPath} (${newFileSizeInMB.toFixed(2)}MB, ${Math.round((1 - newFileSizeInMB/fileSizeInMB) * 100)}% reduction)`);
    }
    
    console.log('Image optimization complete!');
  } catch (error) {
    console.error('Error optimizing images:', error);
  }
}

optimizeImages(); 