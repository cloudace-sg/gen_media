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
      <div className="flex gap-2 overflow-x-auto pb-3" style={{ scrollbarWidth: 'thin' }}>
        {imageArray.map((item, index) => (
          <div key={item.id} className="relative w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden group cursor-pointer shadow-sm">
            {(() => {
              const isVideo = item.mediaType === 'video' || item.url.includes('.mp4');
              if (isVideo) console.log('Detected video:', item);
              return isVideo;
            })() ? (
              <div className="relative w-full h-full bg-gray-800 flex items-center justify-center">
                <video
                  src={item.url}
                  className="w-full h-full object-cover"
                  onLoadStart={() => console.log('Video load started:', item.url)}
                  onLoadedData={() => console.log('Video data loaded:', item.url)}
                  onCanPlay={() => console.log('Video can play:', item.url)}
                  onError={(e) => {
                    console.error('Video error details:', {
                      error: e,
                      target: e.target,
                      errorCode: e.target?.error?.code,
                      errorMessage: e.target?.error?.message,
                      networkState: e.target?.networkState,
                      readyState: e.target?.readyState,
                      url: item.url
                    });
                  }}
                  preload="none"
                  muted
                  poster=""
                />
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-all cursor-pointer"
                  onClick={() => {
                    console.log('Video clicked:', item);
                    onImageClick(item, index);
                  }}
                >
                  <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              </div>)
            : (
              <ImageThumbnail
                image={item}
                onClick={() => onImageClick(item, index)}
                onSelect={(e) => onImageSelect(item, e)}
                isSelected={isImageSelected(item.id)}
                rowType={rowType}
                selectedImages={selectedImages}
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
