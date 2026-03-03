import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools(
    (set, get) => ({
      // Workspace state
      rows: [],
      
      // Image selection state
      selectedImages: [],
      
      // Staged images for remix (new system)
      stagedImages: [],
      
      // Lightbox state
      lightboxImage: null,

      // Image viewer state (right pane)
      imageViewer: {
        isOpen: false,
        currentImage: null,
        currentImageIndex: -1,
        images: []
      },
      
      // Modal state (legacy)
      isModalOpen: false,
      modalImage: null,
      modalImageIndex: 0,
      modalRowIndex: 0,
      
      // Loading states
      isLoading: {
        search: false,
        generate: false,
        remix: false,
        upload: false
      },
      // UI layout
      leftDrawerOpen: true,
      setLeftDrawerOpen: (open) => set({ leftDrawerOpen: open }),

      // Output mode (image/video) - single source of truth
      outputMode: 'image',
      setOutputMode: (mode) => set({ outputMode: mode }),

      // Generation settings (images)
      generationSettings: {
        imageCount: 1,
        style: 'Product-Focused Advertisement',
        aspectRatio: '16:9',
        styleId: 'freeform'
      },
      setGenerationImageCount: (count) => set((state) => ({
        generationSettings: { ...state.generationSettings, imageCount: Math.min(4, Math.max(1, Number(count) || 1)) }
      })),
      setGenerationStyle: (style) => set((state) => ({
        generationSettings: { ...state.generationSettings, style }
      })),
      setStyleId: (styleId) => set((state) => ({
        generationSettings: { ...state.generationSettings, styleId }
      })),
      setGenerationAspectRatio: (aspectRatio) => set((state) => ({
        generationSettings: { ...state.generationSettings, aspectRatio }
      })),

      // Video generation settings
      videoSettings: {
        purpose: 'Quick Social Media Ad',
        aspectRatio: '16:9',
        resolution: '720p',
        styleId: 'freeform'
      },
      setVideoPurpose: (purpose) => set((state) => ({
        videoSettings: { ...state.videoSettings, purpose }
      })),
      setVideoAspectRatio: (aspectRatio) => set((state) => ({
        videoSettings: { ...state.videoSettings, aspectRatio }
      })),
      setVideoResolution: (resolution) => set((state) => ({
        videoSettings: { ...state.videoSettings, resolution }
      })),
      setVideoStyleId: (styleId) => set((state) => ({
        videoSettings: { ...state.videoSettings, styleId }
      })),
      
      // Actions
      addRow: (row) => set((state) => ({
        rows: [...state.rows, { ...row, id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }]
      })),
      
      removeRow: (rowId) => set((state) => ({
        rows: state.rows.filter(row => row.id !== rowId),
        selectedImages: state.selectedImages.filter(img => img.rowId !== rowId)
      })),
      
      updateRow: (rowId, updates) => set((state) => ({
        rows: state.rows.map(row => 
          row.id === rowId ? { ...row, ...updates } : row
        )
      })),
      
      selectImage: (image, rowId) => set((state) => {
        const imageWithRef = {
          ...image,
          rowId,
          ref: `@${state.selectedImages.length + 1}`
        };
        
        return {
          selectedImages: [...state.selectedImages, imageWithRef]
        };
      }),
      
      deselectImage: (imageId) => set((state) => {
        const newSelectedImages = state.selectedImages.filter(img => img.id !== imageId);
        
        // Reassign references
        const updatedImages = newSelectedImages.map((img, index) => ({
          ...img,
          ref: `@${index + 1}`
        }));
        
        return { selectedImages: updatedImages };
      }),
      
      clearSelectedImages: () => set({ selectedImages: [] }),
      
      // New staged images system
      stageImage: (image) => set((state) => {
        const isAlreadyStaged = state.stagedImages.some(staged => staged.id === image.id);
        if (isAlreadyStaged) return state;
        
        const stagedImage = {
          ...image,
          ref: `@${state.stagedImages.length + 1}`
        };
        
        return {
          stagedImages: [...state.stagedImages, stagedImage]
        };
      }),
      
      unstageImage: (imageId) => set((state) => {
        const newStagedImages = state.stagedImages.filter(img => img.id !== imageId);
        
        // Reassign references
        const updatedImages = newStagedImages.map((img, index) => ({
          ...img,
          ref: `@${index + 1}`
        }));
        
        return { stagedImages: updatedImages };
      }),
      
      clearStagedImages: () => set({ stagedImages: [] }),
      
      // Lightbox system
      openLightbox: (image) => set({ lightboxImage: image }),
      closeLightbox: () => set({ lightboxImage: null }),

      // Image viewer system (right pane)
      openImageViewer: (image, images = []) => {
        console.log('Opening image viewer:', image, 'from images:', images);
        const imageIndex = images.findIndex(img => img.id === image.id);
        set({
          imageViewer: {
            isOpen: true,
            currentImage: image,
            currentImageIndex: imageIndex,
            images: images
          }
        });
      },
      
      closeImageViewer: () => set({
        imageViewer: {
          isOpen: false,
          currentImage: null,
          currentImageIndex: -1,
          images: []
        }
      }),
      
      navigateImageViewer: (direction) => set((state) => {
        const { currentImageIndex, images } = state.imageViewer;
        if (images.length === 0) return state;
        
        let newIndex = currentImageIndex;
        if (direction === 'next') {
          newIndex = (currentImageIndex + 1) % images.length;
        } else if (direction === 'previous') {
          newIndex = currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1;
        }
        
        return {
          imageViewer: {
            ...state.imageViewer,
            currentImage: images[newIndex],
            currentImageIndex: newIndex
          }
        };
      }),
      
      // Legacy modal system
      openModal: (image, rowIndex, imageIndex) => set({
        isModalOpen: true,
        modalImage: image,
        modalRowIndex: rowIndex,
        modalImageIndex: imageIndex
      }),
      
      closeModal: () => set({
        isModalOpen: false,
        modalImage: null,
        modalRowIndex: 0,
        modalImageIndex: 0
      }),
      
      setLoading: (operation, isLoading) => set((state) => ({
        isLoading: {
          ...state.isLoading,
          [operation]: isLoading
        }
      })),

      // Brand Kit UI state
      brandKitModalOpen: false,
      openBrandKitModal: () => set({ brandKitModalOpen: true }),
      closeBrandKitModal: () => set({ brandKitModalOpen: false }),

      // Brand assets (fetched from backend)
      brandAssets: {
        logos: [],
        colors: [],
        styleImages: []
      },
      setBrandAssets: (assets) => set({ brandAssets: assets || { logos: [], colors: [], styleImages: [] } }),


      // Brand kit completeness helper
      isBrandKitComplete: () => {
        const state = get();
        const logosOk = (state.brandAssets?.logos?.length || 0) > 0;
        const colorsOk = (state.brandAssets?.colors?.length || 0) > 0;
        const fontOk = !!state.brandAssets?.font;
        return logosOk || colorsOk || fontOk;
      },

      // Overlay storage (per asset/image id)
      overlaysByAssetId: {},
      setOverlays: (assetId, layers) => set((state) => ({
        overlaysByAssetId: { ...state.overlaysByAssetId, [assetId]: Array.isArray(layers) ? layers : [] }
      })),
      addOverlay: (assetId, layer) => set((state) => {
        const existing = state.overlaysByAssetId[assetId] || [];
        const id = layer?.id || `overlay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next = [...existing, { id, ...layer }];
        return { overlaysByAssetId: { ...state.overlaysByAssetId, [assetId]: next } };
      }),
      updateOverlay: (assetId, layerId, updates) => set((state) => {
        const existing = state.overlaysByAssetId[assetId] || [];
        const next = existing.map((l) => (l.id === layerId ? { ...l, ...updates } : l));
        return { overlaysByAssetId: { ...state.overlaysByAssetId, [assetId]: next } };
      }),
      removeOverlay: (assetId, layerId) => set((state) => {
        const existing = state.overlaysByAssetId[assetId] || [];
        const next = existing.filter((l) => l.id !== layerId);
        return { overlaysByAssetId: { ...state.overlaysByAssetId, [assetId]: next } };
      }),
      clearOverlays: (assetId) => set((state) => ({
        overlaysByAssetId: { ...state.overlaysByAssetId, [assetId]: [] }
      })),
      isEdited: (assetId) => {
        const state = get();
        // If there are overlays for this asset, it's edited in-session
        if ((state.overlaysByAssetId[assetId] || []).length > 0) return true;
        // Also consider persisted edits: if the image source is 'Edited'
        for (const row of state.rows) {
          const img = row.images?.find((i) => i.id === assetId);
          if (img && img.source === 'Edited') return true;
        }
        return false;
      },
      
      // Helper functions
      getRowById: (rowId) => {
        const state = get();
        return state.rows.find(row => row.id === rowId);
      },
      
      getImageById: (imageId) => {
        const state = get();
        for (const row of state.rows) {
          const image = row.images?.find(img => img.id === imageId);
          if (image) return { image, row };
        }
        return null;
      }
    }),
    {
      name: 'ai-image-canvas-store'
    }
  )
);

export { useStore };
