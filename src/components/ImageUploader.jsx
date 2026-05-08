import { useState } from 'react';
import { compressAndConvert, validateImageFile } from '../utils/imageUtils';

const ImageUploader = ({ 
  currentImage,    // existing base64 or null
  onImageChange,   // callback(base64String)
  itemName = '',   // for placeholder letter
  size = 200       // preview size in px
}) => {
  const [preview, setPreview] = useState(currentImage || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const { valid, errors } = validateImageFile(file);
    if (!valid) {
      setError(errors[0]);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Compress + convert to base64
      // This is instant — no network, no server
      const base64 = await compressAndConvert(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.75,
        format: 'image/jpeg'
      });

      // Show preview immediately
      setPreview(base64);
      
      // Pass base64 to parent form
      onImageChange(base64);
      
    } catch (err) {
      setError('Failed to process image: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange(null);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      
      {/* Preview Box */}
      <div style={{
        width: size,
        height: size,
        border: '2px dashed #00B894',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f9fa',
        margin: '0 auto 12px',
        position: 'relative',
        cursor: 'pointer',
      }}>
        {loading ? (
          <div style={{ color: '#00B894' }}>
            ⏳ Processing...
          </div>
        ) : preview ? (
          <>
            <img
              src={preview}
              alt="Product"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {/* Remove button */}
            <button
              onClick={handleRemove}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 28,
                height: 28,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </>
        ) : (
          <div style={{ 
            fontSize: 48, 
            color: '#ccc',
            fontWeight: 'bold' 
          }}>
            {itemName?.charAt(0)?.toUpperCase() || '📷'}
          </div>
        )}
      </div>

      {/* Upload Button */}
      <label style={{
        display: 'inline-block',
        padding: '8px 20px',
        background: '#00B894',
        color: 'white',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
      }}>
        {preview ? '🔄 Change Image' : '📁 Upload Image'}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </label>

      {/* Error message */}
      {error && (
        <p style={{ color: 'red', fontSize: 12, marginTop: 8 }}>
          ⚠️ {error}
        </p>
      )}
      
      {/* Size info */}
      {preview && (
        <p style={{ color: '#888', fontSize: 11, marginTop: 6 }}>
          ✅ Image ready — will save with product
        </p>
      )}
    </div>
  );
};

export default ImageUploader;
