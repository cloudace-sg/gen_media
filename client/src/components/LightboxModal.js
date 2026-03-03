import React, { useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

const LightboxModal = ({ image, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.title || 'image';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenOriginal = () => {
    window.open(image.url, '_blank');
  };

  if (!image) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="relative max-w-7xl max-h-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Action Buttons */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={handleDownload}
            className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-colors"
            title="Download image"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            onClick={handleOpenOriginal}
            className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-colors"
            title="Open original"
          >
            <ExternalLink className="h-5 w-5" />
          </button>
        </div>

        {/* Image */}
        <img
          src={image.url}
          alt={image.title || 'Full size image'}
          className="max-w-full max-h-full object-contain rounded-lg"
          style={{ maxHeight: '90vh' }}
        />

        {/* Image Info */}
        <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-1">
                {image.title || 'Untitled'}
              </h3>
              {image.source && (
                <p className="text-sm opacity-75">
                  Source: {image.source}
                </p>
              )}
              {image.width && image.height && (
                <p className="text-sm opacity-75">
                  {image.width} × {image.height}px
                </p>
              )}
            </div>
            <div className="text-sm opacity-75">
              Press ESC to close
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LightboxModal;
