/**
 * Image utilities for base64 conversion and compression
 * No server needed - all processing happens in browser
 */

/**
 * Convert file to base64 string
 * Returns: "data:image/jpeg;base64,..."
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Compress image before converting to base64
 * Reduces file size significantly
 */
export const compressAndConvert = (file, options = {}) => {
  const {
    maxWidth = 400,   // px — enough for menu card
    maxHeight = 400,  // px
    quality = 0.7,    // 0.1 to 1.0
    format = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (maintain aspect ratio)
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(
            maxWidth / width, 
            maxHeight / height
          );
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Draw on canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with compression
        const base64 = canvas.toDataURL(format, quality);
        resolve(base64);
      };
      
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
};

/**
 * Validate image file before processing
 */
export const validateImageFile = (file) => {
  const errors = [];
  
  // Check type
  const allowed = ['image/jpeg','image/jpg','image/png',
                   'image/webp','image/gif'];
  if (!allowed.includes(file.type)) {
    errors.push('Only JPG, PNG, WEBP, GIF allowed');
  }
  
  // Check size (max 5MB original)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push('Image must be under 5MB');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};
