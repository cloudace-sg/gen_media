import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import ImageThumbnail from './ImageThumbnail';
import { useStore } from '../store/useStore';

const ImageRow = ({ images, rowId, rowType, onImageClick, onImageSelect, selectedImages }) => {
  const { isEdited } = useStore();
  const imageArray = images || [];
  
  // Debug: log video items
  if (rowType === 'video') {
    console.log('Video row images:', imageArray);
  }

  const isImageSelected = (id) => selectedImages?.some((img) => img.id === id);

  return (
    <div className="image-row-container">
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 pb-3">
        {imageArray.map((item, index) => (
          <div key={item.id} className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer shadow-sm">
            {(() => {
              const isVideo = item.mediaType === 'video' || item.url.includes('.mp4');
              return isVideo;
            })() ? (
              // Video thumbnail with staging support
              <div className="relative w-full h-full bg-gray-800">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title || 'Video thumbnail'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                    }}
                  />
                ) : null}
                <div className="w-full h-full bg-gray-700 items-center justify-center text-gray-400 text-xs" style={{ display: item.thumbnail ? 'none' : 'flex' }}>
                  Video
                </div>
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-all cursor-pointer"
                  onClick={() => onImageClick(item, index)}
                >
                  <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
                {item.duration && (
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {item.duration}s
                  </div>
                )}
                
                {/* Staging button for videos */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageSelect(item, e);
                  }}
                  className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                    isImageSelected(item.id)
                      ? 'bg-accent text-white'
                      : 'bg-black bg-opacity-70 text-white hover:bg-opacity-90'
                  }`}
                  title={isImageSelected(item.id) ? 'Remove from staging' : 'Add to staging'}
                >
                  {isImageSelected(item.id) ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 5v14m7-7H5"/>
                    </svg>
                  )}
                </button>

                {/* Selection indicator for videos */}
                {isImageSelected(item.id) && (
                  <div className="absolute top-1 left-1 w-6 h-6 bg-accent text-black rounded-full flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                )}
              </div>
            ) : (
              <ImageThumbnail
                image={item}
                onClick={() => onImageClick(item, index)}
                onSelect={(e) => onImageSelect(item, e)}
                isSelected={isImageSelected(item.id)}
                rowType={rowType}
                selectedImages={selectedImages}
                mediaType={item.mediaType || 'image'}
              />
            )}
            {isEdited(item.id) && (
              <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-400" /> Edited
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageRow;
