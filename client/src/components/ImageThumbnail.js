import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

const ImageThumbnail = ({ image, onClick, onSelect, isSelected, rowType, selectedImages = [], mediaType = 'image' }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    console.error('Media failed to load:', image.thumbnail || image.url);
    setImageLoading(false);
    setImageError(true);
  };

  const handleImageClick = (e) => {
    e.stopPropagation();
    onClick();
  };

  const handleSelectClick = (e) => {
    e.stopPropagation();
    onSelect(e);
  };

  const getPlaceholderContent = () => {
    if (mediaType === 'video') {
      return '🎬';
    }
    switch (rowType) {
      case 'search':
        return '🔍';
      case 'generate':
        return '🎨';
      case 'remix':
        return '✨';
      default:
        return '📷';
    }
  };

  // Get the reference number from the staged images array
  const stagedImage = selectedImages.find(staged => staged.id === image.id);
  const refNumber = stagedImage?.ref ? stagedImage.ref.replace('@', '').replace('video_', '') : '';

  return (
    <div 
      className="relative w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden group cursor-pointer shadow-sm"
      style={{ 
        width: '100px', 
        height: '100px',
        flexShrink: 0
      }}
    >
      {imageLoading && (
        <div className="absolute inset-0 bg-dark-border animate-pulse rounded-2xl flex items-center justify-center">
          <div className="text-dark-text-secondary text-lg">
            {getPlaceholderContent()}
          </div>
        </div>
      )}
      
      {imageError ? (
        <div className="w-full h-full bg-dark-border rounded-2xl flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg mb-1">{getPlaceholderContent()}</div>
            <div className="text-xs text-dark-text-secondary">Failed to load</div>
          </div>
        </div>
      ) : mediaType === 'video' ? (
        // Video thumbnail with play icon
        <div className="relative w-full h-full bg-black">
          <video
            src={image.url}
            className="w-full h-full object-cover"
            onLoadedMetadata={handleImageLoad}
            onError={handleImageError}
            onClick={handleImageClick}
            style={{ display: imageLoading ? 'none' : 'block' }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-all">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center opacity-80 group-hover:opacity-100">
              <svg className="w-5 h-5 text-black fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <img
          src={image.thumbnail || image.url}
          alt={image.title || 'Generated image'}
          className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={handleImageClick}
          style={{ display: imageLoading ? 'none' : 'block' }}
        />
      )}
      
      {/* Hover-to-Select Button */}
      <button
        onClick={handleSelectClick}
        className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 ${
          isSelected 
            ? 'bg-accent text-white' 
            : 'bg-black bg-opacity-70 text-white hover:bg-opacity-90'
        }`}
        title={isSelected ? 'Remove from staging' : 'Add to staging'}
      >
        {isSelected ? (
          <X className="h-3 w-3" />
        ) : (
          <Plus className="h-3 w-3" />
        )}
      </button>
      
      {/* Selection indicator: numeric ref */}
      {isSelected && (
        <div className="absolute top-1 left-1 w-6 h-6 bg-accent text-black rounded-full flex items-center justify-center text-xs font-bold">
          {refNumber || '✓'}
        </div>
      )}
      
      {/* Media info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="text-white text-xs truncate">
          {image.title || 'Untitled'}
        </div>
      </div>
    </div>
  );
};

export default ImageThumbnail;
