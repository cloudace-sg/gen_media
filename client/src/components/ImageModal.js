import React from 'react';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';

const ImageModal = () => {
  const { 
    isModalOpen, 
    modalImage, 
    modalRowIndex, 
    modalImageIndex, 
    closeModal,
    rows 
  } = useStore();

  if (!isModalOpen || !modalImage) return null;

  const currentRow = rows.find(row => row.id === modalRowIndex);
  const currentImages = currentRow?.images || [];
  const currentIndex = modalImageIndex;
  const hasNext = currentIndex < currentImages.length - 1;
  const hasPrevious = currentIndex > 0;

  const handleNext = () => {
    if (hasNext) {
      const nextImage = currentImages[currentIndex + 1];
      // TODO: Update modal state with next image
    }
  };

  const handlePrevious = () => {
    if (hasPrevious) {
      const prevImage = currentImages[currentIndex - 1];
      // TODO: Update modal state with previous image
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = modalImage.url;
    link.download = modalImage.title || 'image';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExternalLink = () => {
    window.open(modalImage.url, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold truncate">
              {modalImage.title || 'Untitled'}
            </h3>
            {modalImage.source && (
              <span className="text-sm text-dark-text-secondary">
                {modalImage.source}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="btn-secondary p-2"
              title="Download image"
            >
              <Download className="h-4 w-4" />
            </button>
            
            <button
              onClick={handleExternalLink}
              className="btn-secondary p-2"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            
            <button
              onClick={closeModal}
              className="btn-secondary p-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Image Content */}
        <div className="relative flex-1 flex items-center justify-center p-4">
          <img
            src={modalImage.url}
            alt={modalImage.title}
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: '70vh' }}
          />
          
          {/* Navigation */}
          {hasPrevious && (
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 btn-secondary p-2"
              title="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          
          {hasNext && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 btn-secondary p-2"
              title="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-dark-border">
          <div className="flex items-center justify-between text-sm text-dark-text-secondary">
            <div>
              {modalImage.width && modalImage.height && (
                <span>
                  {modalImage.width} × {modalImage.height}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <span>
                {currentIndex + 1} of {currentImages.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
