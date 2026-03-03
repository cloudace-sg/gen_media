import React from 'react';
import { X, Palette } from 'lucide-react';
import { useStore } from '../store/useStore';

const StagingArea = () => {
  const { selectedImages, clearSelectedImages, deselectImage } = useStore();

  const handleDeselectImage = (imageId) => {
    deselectImage(imageId);
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 bg-dark-surface border-t border-dark-border z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Palette className="h-5 w-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-dark-text">Staging Area</h3>
            <span className="text-sm text-dark-text-secondary bg-dark-bg px-2 py-1 rounded">
              {selectedImages.length} selected
            </span>
          </div>
          
          <button
            onClick={clearSelectedImages}
            className="text-dark-text-secondary hover:text-red-400 transition-colors px-3 py-1 rounded-lg hover:bg-red-50 hover:bg-opacity-10"
          >
            Clear All
          </button>
        </div>
        
        {/* Selected Images */}
        <div className="flex items-center space-x-4 overflow-x-auto scrollbar-hide">
          {selectedImages.map((image) => (
            <div key={image.id} className="flex-shrink-0 relative group">
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-dark-border">
                <img
                  src={image.thumbnail || image.url}
                  alt={image.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                {image.ref}
              </div>
              <button
                onClick={() => handleDeselectImage(image.id)}
                className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        
        {/* Instructions */}
        <div className="mt-4 text-sm text-dark-text-secondary">
          <p>
            Use the bottom bar to describe how to combine these images (e.g., "place @1 in @2")
          </p>
        </div>
      </div>
    </div>
  );
};

export default StagingArea;
