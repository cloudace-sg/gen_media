import React from 'react';
import { Plus, Eye } from 'lucide-react';
import { useStore } from '../store/useStore';
import ImageThumbnail from './ImageThumbnail';
import LoadingSkeleton from './LoadingSkeleton';

const ImageGrid = ({ images, rowId, rowType }) => {
  const { selectedImages, selectImage, deselectImage, openModal } = useStore();

  const handleImageClick = (image, index) => {
    openModal(image, rowId, index);
  };

  const handleImageSelect = (image, e) => {
    e.stopPropagation();
    
    // Check if image is already selected
    const isSelected = selectedImages.some(selected => selected.id === image.id);
    
    if (isSelected) {
      deselectImage(image.id);
    } else {
      selectImage(image, rowId);
    }
  };

  const isImageSelected = (imageId) => {
    return selectedImages.some(selected => selected.id === imageId);
  };

  if (!images || images.length === 0) {
    return (
      <div className="text-center py-8 text-dark-text-secondary">
        <p>No images available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {images.map((image, index) => (
        <div key={image.id} className="relative group">
          <ImageThumbnail
            image={image}
            onClick={() => handleImageClick(image, index)}
            onSelect={(e) => handleImageSelect(image, e)}
            isSelected={isImageSelected(image.id)}
            rowType={rowType}
          />
          
          {/* View indicator */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
            <div className="bg-black bg-opacity-50 rounded-full p-2">
              <Eye className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageGrid;
