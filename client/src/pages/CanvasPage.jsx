import React from 'react';
import Workspace from '../components/Workspace';
import PromptDrawer from '../components/PromptDrawer';
import StagingArea from '../components/StagingArea';
import LightboxModal from '../components/LightboxModal';
import ImageModal from '../components/ImageModal';
import ImageViewer from '../components/ImageViewer';
import { useStore } from '../store/useStore';

const CanvasPage = () => {
  const { selectedImages, lightboxImage, closeLightbox, imageViewer, closeImageViewer, navigateImageViewer, leftDrawerOpen } = useStore();

  return (
    <div>
      <div className={`flex ml-0 transition-all duration-200`}>
        <PromptDrawer />
        <div style={{ marginLeft: 380 }} className={`flex-1 pb-24 ${imageViewer.isOpen ? 'md:w-1/2' : 'w-full'} transition-all duration-300`}>
          <Workspace />
        </div>
        {imageViewer.isOpen && (
          <ImageViewer
            image={imageViewer.currentImage}
            onClose={closeImageViewer}
            onNext={() => navigateImageViewer('next')}
            onPrevious={() => navigateImageViewer('previous')}
            hasNext={imageViewer.currentImageIndex < imageViewer.images.length - 1}
            hasPrevious={imageViewer.currentImageIndex > 0}
          />
        )}
      </div>
      {selectedImages.length > 0 && <StagingArea />}
      {lightboxImage && <LightboxModal image={lightboxImage} onClose={closeLightbox} />}
      {false && <ImageModal />}
    </div>
  );
};

export default CanvasPage;


