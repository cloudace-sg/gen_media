import React, { useState, useEffect, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, Move, Edit3, Plus, Camera } from 'lucide-react';
import { useStore } from '../store/useStore';

// Lazy-load CanvasEditor (Konva)
const CanvasEditor = React.lazy(() => import('./editor/CanvasEditor'));

const ImageViewer = ({ image, onClose, onNext, onPrevious, hasNext, hasPrevious }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fitToCanvas, setFitToCanvas] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentImage, setCurrentImage] = useState(image);
  const [editedImageUrl, setEditedImageUrl] = useState(null);
  const [editorZoom, setEditorZoom] = useState(1);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [retryCrossOrigin, setRetryCrossOrigin] = useState(true);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const { overlaysByAssetId, updateRow, getImageById, setLoading, isLoading, clearOverlays, stageImage, unstageImage, stagedImages, addRow } = useStore();
  const videoRef = useRef(null);

  const cacheBust = (url) => {
    try {
      if (!url || typeof url !== 'string') return url;
      // Avoid touching signed URLs
      if (url.includes('X-Goog-') || url.includes('x-goog-')) return url;
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}_ts=${Date.now()}`;
    } catch (_) { return url; }
  };
  const editorRef = useRef(null);

  // Update current image when prop changes
  useEffect(() => {
    console.log('ImageViewer image changed:', {
      imageId: image?.id,
      imageUrl: image?.url,
      imageTitle: image?.title,
      hasImage: !!image
    });
    setCurrentImage(image);
    setEditedImageUrl(null);
    setEditorZoom(1); // Reset editor zoom when switching images
    setImageLoadError(false); // Reset error state
    setRetryCrossOrigin(true); // Reset crossOrigin retry
    // Clear any stale overlays when switching images to avoid duplicate layers on reopen
    try { if (image?.id && clearOverlays) clearOverlays(image.id); } catch (_) {}
  }, [image, clearOverlays]);

  // Update editor zoom display when scale changes in editor
  useEffect(() => {
    if (!isEditMode || !editorRef.current) return;
    
    const updateEditorZoom = () => {
      if (editorRef.current?.getZoom) {
        setEditorZoom(editorRef.current.getZoom());
      }
    };

    // Update zoom display periodically when in edit mode
    const interval = setInterval(updateEditorZoom, 100);
    return () => clearInterval(interval);
  }, [isEditMode]);

  // Calculate fit-to-canvas zoom when image loads
  useEffect(() => {
    if (!currentImage || !imageRef.current || !containerRef.current) return;

    const fitImageToCanvas = () => {
      const container = containerRef.current;
      const img = imageRef.current;
      if (!container || !img) return;

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      
      // Get image natural dimensions
      const imgWidth = img.naturalWidth || img.width;
      const imgHeight = img.naturalHeight || img.height;
      
      if (imgWidth && imgHeight) {
        // Calculate scale to fit image within container with some padding
        const padding = 40; // 20px padding on each side
        const availableWidth = containerWidth - padding;
        const availableHeight = containerHeight - padding;
        
        const scaleX = availableWidth / imgWidth;
        const scaleY = availableHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
        
        setZoom(scale);
        setPan({ x: 0, y: 0 });
        setFitToCanvas(true);
      }
    };

    const img = imageRef.current;
    // Wait for image to load, then fit to canvas
    if (img.complete) {
      fitImageToCanvas();
    } else {
      img.onload = fitImageToCanvas;
    }
  }, [image]);

  // Reset pan when image changes; keep fit-to-canvas as default
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setFitToCanvas(true); // fitImageToCanvas effect will compute zoom appropriately
  }, [image]);

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNonPassive = (e) => {
      if (isEditMode) return; // let Konva handle zoom/scroll inside editor
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
      setFitToCanvas(false); // Exit fit-to-canvas mode when using wheel zoom
    };

    container.addEventListener('wheel', handleWheelNonPassive, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheelNonPassive);
    };
  }, [isEditMode]);

  if (!image) return null;
  const isStaged = image && stagedImages.some(s => s.id === image.id);

  const handleToggleStage = () => {
    if (!image) return;
    if (isStaged) {
      unstageImage(image.id);
    } else {
      stageImage({
        id: image.id,
        title: image.title,
        url: image.url,
        thumbnail: image.thumbnail || image.url,
        source: image.source,
        mediaType: image.mediaType,
      });
    }
  };

  const handleExtractFrame = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let dataUrl;
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch (_) {
      alert('Cannot extract frame: video is cross-origin. Try downloading and re-uploading it first.');
      return;
    }
    const timestamp = Math.floor(video.currentTime * 10) / 10;
    const frameImage = {
      id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: `Frame @${timestamp}s — ${image.title || 'Video'}`,
      url: dataUrl,
      thumbnail: dataUrl,
      source: 'Extracted frame',
      width: canvas.width,
      height: canvas.height,
    };
    addRow({ type: 'upload', title: 'EXTRACTED FRAME', images: [frameImage] });
    stageImage(frameImage);
  };

  if (image.mediaType === 'video') {
    return (
      <div className="fixed top-0 right-0 bottom-24 w-1/2 bg-dark-surface border-l border-dark-border z-40 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h3 className="font-semibold text-dark-text truncate max-w-xs">{image.title || 'Video'}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExtractFrame}
              className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm bg-dark-border text-dark-text hover:bg-purple-600 hover:text-white transition-colors"
              title="Capture current frame as a reference image"
            >
              <Camera className="h-3.5 w-3.5" />
              Extract frame
            </button>
            <button
              onClick={handleToggleStage}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm transition-colors ${
                isStaged
                  ? 'bg-accent text-black hover:bg-red-500 hover:text-white'
                  : 'bg-dark-border text-dark-text hover:bg-accent hover:text-black'
              }`}
              title={isStaged ? 'Remove from references' : 'Use as reference'}
            >
              {isStaged ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {isStaged ? 'Remove ref' : 'Use as ref'}
            </button>
            <button onClick={onClose} className="p-2 text-dark-text-secondary hover:text-red-400 transition-colors" title="Close viewer">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            controls
            className="max-w-full max-h-full"
            src={image.url}
            preload="auto"
            playsInline
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            onError={(e) => {
              console.error('Video error in ImageViewer:', {
                error: e,
                target: e.target,
                errorCode: e.target?.error?.code,
                errorMessage: e.target?.error?.message,
                url: image.url
              });
            }}
            onLoadedData={() => console.log('Video loaded in ImageViewer:', image.url)}
            onCanPlay={() => console.log('Video can play in ImageViewer:', image.url)}
          />
        </div>
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      const src = editedImageUrl || currentImage?.url || image?.url;
      if (!src) return;
      const resp = await fetch(src, { mode: 'cors', cache: 'no-store' });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = blob.type === 'image/png' ? 'png' : (blob.type === 'image/webp' ? 'webp' : 'jpg');
      const safeTitle = (currentImage?.title || image?.title || 'download').replace(/[^a-z0-9_-]+/gi, '_');
      a.download = `${safeTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const src = editedImageUrl || currentImage?.url || image?.url;
      if (src) window.open(src, '_blank');
    }
  };

  // Removed Open Original per updated UI

  const handleZoomIn = () => {
    if (isEditMode && editorRef.current?.zoomIn) { 
      editorRef.current.zoomIn(); 
      // Update editor zoom state for display
      setTimeout(() => {
        if (editorRef.current?.getZoom) {
          setEditorZoom(editorRef.current.getZoom());
        }
      }, 50);
      return; 
    }
    setZoom(prev => Math.min(prev * 1.2, 5));
    setFitToCanvas(false); // Exit fit-to-canvas mode when manually zooming
  };

  const handleZoomOut = () => {
    if (isEditMode && editorRef.current?.zoomOut) { 
      editorRef.current.zoomOut(); 
      // Update editor zoom state for display
      setTimeout(() => {
        if (editorRef.current?.getZoom) {
          setEditorZoom(editorRef.current.getZoom());
        }
      }, 50);
      return; 
    }
    setZoom(prev => Math.max(prev / 1.2, 0.1));
    setFitToCanvas(false); // Exit fit-to-canvas mode when manually zooming
  };

  const handleResetZoom = () => {
    if (isEditMode && editorRef.current?.resetZoom) { 
      editorRef.current.resetZoom(); 
      // Update editor zoom state for display
      setTimeout(() => {
        if (editorRef.current?.getZoom) {
          setEditorZoom(editorRef.current.getZoom());
        }
      }, 50);
      return; 
    }
    if (fitToCanvas) {
      // If currently fit to canvas, reset to 100% zoom
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setFitToCanvas(false);
    } else {
      // If at 100% zoom, fit to canvas
      if (imageRef.current && containerRef.current) {
        const container = containerRef.current;
        const img = imageRef.current;
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        const imgWidth = img.naturalWidth || img.width;
        const imgHeight = img.naturalHeight || img.height;
        
        if (imgWidth && imgHeight) {
          const padding = 40;
          const availableWidth = containerWidth - padding;
          const availableHeight = containerHeight - padding;
          
          const scaleX = availableWidth / imgWidth;
          const scaleY = availableHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY, 1);
          
          setZoom(scale);
          setPan({ x: 0, y: 0 });
          setFitToCanvas(true);
        }
      }
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };


  return (
    <div className="fixed top-0 right-0 bottom-24 w-1/2 bg-dark-surface border-l border-dark-border z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-border">
        <div className="flex items-center space-x-3">
          <h3 className="font-semibold text-dark-text truncate max-w-xs">
            {image.title || 'Untitled Image'}
          </h3>
          <span className="text-xs text-dark-text-secondary bg-dark-bg px-2 py-1 rounded">
            {image.source}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggleStage}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm transition-colors ${
              isStaged
                ? 'bg-accent text-black hover:bg-red-500 hover:text-white'
                : 'bg-dark-border text-dark-text hover:bg-accent hover:text-black'
            }`}
            title={isStaged ? 'Remove from references' : 'Use as reference'}
          >
            {isStaged ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isStaged ? 'Remove ref' : 'Use as ref'}
          </button>
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="p-2 text-dark-text-secondary hover:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Previous image"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="p-2 text-dark-text-secondary hover:text-dark-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Next image"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-dark-text-secondary hover:text-red-400 transition-colors"
            title="Close viewer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Zoom / Edit Controls */}
      <div className="flex items-center justify-center gap-2 p-2 border-b border-dark-border bg-dark-bg">
        <button
          onClick={handleZoomOut}
          className="p-2 text-dark-text-secondary hover:text-dark-text transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-sm text-dark-text-secondary px-2 min-w-[60px] text-center">
          {isEditMode ? Math.round(editorZoom * 100) : Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 text-dark-text-secondary hover:text-dark-text transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-2 text-dark-text-secondary hover:text-dark-text transition-colors"
          title={fitToCanvas ? "Reset to 100%" : "Fit to canvas"}
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1 text-xs text-dark-text-secondary ml-2">
          <Move className="h-3 w-3" />
          <span>Drag to pan</span>
        </div>
        <div className="ml-auto flex items-center gap-2 pr-2">
          <button
            onClick={() => setIsEditMode((v) => !v)}
            className={`p-2 rounded ${isEditMode ? 'bg-accent text-white' : 'text-dark-text-secondary hover:text-dark-text'}`}
            title="Toggle Edit Mode"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image / Editor Display */}
      <div 
        ref={containerRef}
        className="flex-1 bg-dark-bg relative overflow-hidden"
        onMouseDown={!isEditMode ? handleMouseDown : undefined}
        onMouseMove={!isEditMode ? handleMouseMove : undefined}
        onMouseUp={!isEditMode ? handleMouseUp : undefined}
        onMouseLeave={!isEditMode ? handleMouseUp : undefined}
        style={{ cursor: isEditMode ? 'default' : (isDragging ? 'grabbing' : 'grab') }}
      >
        {isEditMode ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 overflow-auto">
            <React.Suspense fallback={<div className="text-dark-text-secondary text-sm">Loading editor…</div>}>
              <CanvasEditor
                ref={editorRef}
                assetId={currentImage?.id}
                baseUrl={(() => {
                  // Don't use cacheBust for canvas editor as it can cause CORS issues
                  const url = editedImageUrl || currentImage?.url;
                  console.log('Passing baseUrl to CanvasEditor:', {
                    url,
                    editedImageUrl,
                    currentImageUrl: currentImage?.url,
                    assetId: currentImage?.id
                  });
                  return url;
                })()}
                width={1024}
                height={1024}
                onExport={(dataUrl) => {
                  // trigger download by default
                  const a = document.createElement('a');
                  a.href = dataUrl;
                  a.download = (image.title || 'edited') + '.png';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              />
            </React.Suspense>
          </div>
        ) : (
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            <div 
              className="relative"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              {imageLoadError ? (
                <div className="text-center p-8">
                  <p className="text-dark-text-secondary mb-4">Failed to load image</p>
                  <button 
                    onClick={() => {
                      setImageLoadError(false);
                      setRetryCrossOrigin(false);
                    }}
                    className="btn-secondary"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <img
                  ref={imageRef}
                  src={editedImageUrl || currentImage?.url}
                  {...(retryCrossOrigin ? { crossOrigin: 'anonymous' } : {})}
                  alt={currentImage?.title || 'Full-size image'}
                  className="rounded-lg shadow-lg"
                  style={{ 
                    maxWidth: 'none',
                    maxHeight: 'none',
                    width: 'auto',
                    height: 'auto',
                    display: 'block',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}
                  onError={(e) => {
                    console.error('Image failed to load in preview:', {
                      src: e.target.src,
                      currentImageUrl: currentImage?.url,
                      editedImageUrl,
                      hasCrossOrigin: !!e.target.crossOrigin,
                      retryCrossOrigin
                    });
                    // Try without crossOrigin if it fails
                    if (retryCrossOrigin) {
                      console.log('Retrying without crossOrigin attribute');
                      setRetryCrossOrigin(false);
                    } else {
                      console.error('Image load failed even without crossOrigin');
                      setImageLoadError(true);
                    }
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully in preview:', {
                      url: currentImage?.url,
                      withCrossOrigin: retryCrossOrigin
                    });
                    setImageLoadError(false);
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Image Info and Actions */}
      <div className="p-4 border-t border-dark-border bg-dark-bg">
        <div className="space-y-3">
          {/* Image Details */}
          <div className="text-sm text-dark-text-secondary">
            {currentImage.width && currentImage.height && (
              <p>Dimensions: {currentImage.width} × {currentImage.height} pixels</p>
            )}
            {currentImage.textResponse && (
              <p className="mt-1">
                <span className="font-medium">Description:</span> {currentImage.textResponse}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            {isEditMode && (
              <button
                onClick={async () => {
                  try {
                    setLoading('upload', true);
                    const res = await editorRef.current?.saveReplace();
                    if (res?.url) {
                      const nextUrl = res.replaced ? cacheBust(res.url) : res.url;
                      // Cache the edited image URL for faster preview
                      setEditedImageUrl(nextUrl);
                      
                      // Update the current image state immediately
                      setCurrentImage(prev => ({ ...prev, url: nextUrl, source: 'Edited' }));
                      
                      // Also update the row in the store
                      const found = getImageById(image.id);
                      if (found) {
                        const { row } = found;
                        const updatedImages = (row.images || []).map((img) => img.id === image.id ? { ...img, url: nextUrl, source: 'Edited' } : img);
                        updateRow(row.id, { images: updatedImages });
                      }

                      // Clear overlays after save to avoid duplication; tag persists via source==='Edited'
                      try { if (clearOverlays && image?.id) clearOverlays(image.id); } catch (_) {}
                    }
                  } finally {
                    setLoading('upload', false);
                  }
                }}
                disabled={isLoading.upload}
                className={`flex-1 btn-primary flex items-center justify-center gap-2 text-sm ${isLoading.upload ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {isLoading.upload ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;