/**
 * Compress an image file using HTML5 Canvas client-side.
 * Resizes the image if its dimensions exceed maxDimensions (default 1600px)
 * and exports as a JPEG with the specified quality (default 0.8).
 * 
 * @param {File} file - The input image file
 * @param {Object} options - Compression options
 * @param {number} [options.maxDimension=1600] - Max width or height in pixels
 * @param {number} [options.quality=0.8] - JPEG quality from 0.1 to 1.0
 * @returns {Promise<File>} - Resolves with the compressed File object
 */
export const compressImage = (file, { maxDimension = 1600, quality = 0.8 } = {}) => {
  return new Promise((resolve, reject) => {
    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
      return resolve(file); // Don't try to compress non-images
    }

    // Skip compression if the file is already very small (e.g., < 200 KB)
    if (file.size < 200 * 1024) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize logic
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get canvas 2D context'));
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Failed to compress image (Canvas toBlob failed)'));
            }
            
            // Create a new File from the blob
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now()
            });

            // Return compressed file if it's actually smaller, else return original
            if (compressedFile.size < file.size) {
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
