import React from 'react';
import { CheckCircle2, Plus, X } from 'lucide-react';
import ImageThumbnail from './ImageThumbnail';
import { useStore } from '../store/useStore';

const ImageRow = ({ images, rowId, rowType, onImageClick, onImageSelect, selectedImages }) => {
  const { isEdited } = useStore();
  const imageArray = images || [];

  const isImageSelected = (id) => selectedImages?.some((img) => img.id === id);

  const handleVideoSelect = (item, e) => {
    e.stopPropagation();
    onImageSelect(item, e);
  };

  return (
    <div className="image-row-container">
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 pb-3">
        {imageArray.map((item, index) => {
          const isVideo = item.mediaType === 'video' || item.url.includes('.mp4');
          const selected = isImageSelected(item.id);

          return (
            <div key={item.id} className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer shadow-sm">
              {isVideo ? (
                <div className="relative w-full h-full bg-gray-800 flex items-center justify-center">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title || 'Video thumbnail'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      playsInline
                    />
                  )}
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-all cursor-pointer"
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
                  <button
                    onClick={(e) => handleVideoSelect(item, e)}
                    className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto z-10 ${
                      selected
                        ? 'bg-accent text-white'
                        : 'bg-black bg-opacity-70 text-white hover:bg-opacity-90'
                    }`}
                    title={selected ? 'Remove from staging' : 'Add as reference'}
                  >
                    {selected ? (
                      <X className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </button>
                  {selected && (() => {
                    const stagedImage = selectedImages.find(staged => staged.id === item.id);
                    const refNumber = stagedImage?.ref ? stagedImage.ref.replace('@', '') : '';
                    return (
                      <div className="absolute top-1 left-1 w-6 h-6 bg-accent text-black rounded-full flex items-center justify-center text-xs font-bold z-10">
                        {refNumber || '✓'}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <ImageThumbnail
                  image={item}
                  onClick={() => onImageClick(item, index)}
                  onSelect={(e) => onImageSelect(item, e)}
                  isSelected={selected}
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
          );
        })}
      </div>
    </div>
  );
};

export default ImageRow;
