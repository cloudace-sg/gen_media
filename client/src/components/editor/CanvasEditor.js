import React from 'react';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Line as KonvaLine, Transformer } from 'react-konva';
import { Pencil, Eraser, RotateCcw, RotateCw, Trash2, Type as TypeIcon, Save, Wand2 } from 'lucide-react';
import useImage from 'use-image';
import { useStore } from '../../store/useStore';
import { saveEditedImage, remixImages } from '../../services/api';

// Resolve asset URL for local development to avoid CORS: if pointing to deployed host, map to localhost backend
function resolveAssetUrlForLocal(url) {
  try {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      const u = new URL(url, window.location.href);
      const isUploads = u.pathname.startsWith('/uploads/');
      if (isUploads) {
        return `http://localhost:3001${u.pathname}`;
      }
    }
  } catch (_) {}
  return url;
}

const CanvasEditor = React.forwardRef(({ assetId, baseUrl, width = 1024, height = 1024, onExport }, ref) => {
  const { overlaysByAssetId, addOverlay, updateOverlay, removeOverlay, setOverlays, brandAssets, stagedImages, clearStagedImages } = useStore();
  const resolvedBaseUrl = React.useMemo(() => resolveAssetUrlForLocal(baseUrl), [baseUrl]);
  const [img, imgStatus] = useImage(resolvedBaseUrl, 'anonymous');
  const [backgroundNaturalSize, setBackgroundNaturalSize] = React.useState(null);
  const [dirty, setDirty] = React.useState(false);
  const layers = overlaysByAssetId[assetId] || [];

  // Debug image loading
  React.useEffect(() => {
    console.log('CanvasEditor image loading:', {
      baseUrl,
      resolvedBaseUrl,
      imgStatus,
      hasImg: !!img,
      imgWidth: img?.width,
      imgHeight: img?.height,
      imgSrc: img?.src
    });
  }, [baseUrl, resolvedBaseUrl, img, imgStatus]);

  // Responsive container and zoom/pan state
  const containerRef = React.useRef(null);
  const stageRef = React.useRef(null);
  const [containerSize, setContainerSize] = React.useState({ w: 0, h: 0 });
  const [sceneSize, setSceneSize] = React.useState({ w: width, h: height });
  const [scale, setScale] = React.useState(1);
  const [stagePos, setStagePos] = React.useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = React.useState(null);
  const nodeRefs = React.useRef({});
  const trRef = React.useRef(null);
  const [activeTool, setActiveTool] = React.useState('select'); // 'select' | 'draw' | 'erase'
  const [isPanning, setIsPanning] = React.useState(false);
  const [brushColor, setBrushColor] = React.useState('#000000');
  const [brushSize, setBrushSize] = React.useState(8);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [tempPoints, setTempPoints] = React.useState([]);
  const [redoStack, setRedoStack] = React.useState([]);

  // Inline text editor state
  const [inlineEdit, setInlineEdit] = React.useState({
    open: false,
    id: null,
    value: '',
    style: {},
    position: { x: 0, y: 0, w: 0, h: 0 }
  });

  // UI class helpers for consistent sizing
  const BTN = 'w-9 h-9 rounded-xl bg-dark-border text-dark-text hover:bg-gray-200 flex items-center justify-center';
  const BTN_ACTIVE = 'bg-red-600 text-white';
  const GROUP = 'flex items-center gap-2 px-2 py-1 rounded-xl bg-dark-border';

  // Fallback: load image manually if useImage fails
  const [manualImg, setManualImg] = React.useState(null);
  
  // Reset manual image when URL changes
  React.useEffect(() => {
    setManualImg(null);
  }, [resolvedBaseUrl]);
  
  React.useEffect(() => {
    // Set a timeout to try manual load if useImage takes too long (2 seconds)
    const timeoutId = setTimeout(() => {
      if (!img && !manualImg) {
        console.log('useImage taking too long, trying manual load');
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          console.log('Manual image load successful');
          setManualImg(image);
        };
        image.onerror = (e) => {
          console.error('Manual image load failed, trying without crossOrigin', e);
          // Try again without crossOrigin
          const image2 = new Image();
          image2.onload = () => {
            console.log('Image load successful without crossOrigin');
            setManualImg(image2);
          };
          image2.onerror = (e2) => {
            console.error('Image load completely failed', e2);
          };
          image2.src = resolvedBaseUrl;
        };
        image.src = resolvedBaseUrl;
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [resolvedBaseUrl, img, manualImg]);
  
  React.useEffect(() => {
    // If useImage hook fails, load manually immediately
    if (imgStatus === 'failed') {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        console.log('Manual image load successful (after failed)');
        setManualImg(image);
      };
      image.onerror = (e) => {
        console.error('Manual image load failed, trying without crossOrigin', e);
        // Try again without crossOrigin
        const image2 = new Image();
        image2.onload = () => {
          console.log('Image load successful without crossOrigin (after failed)');
          setManualImg(image2);
        };
        image2.onerror = (e2) => {
          console.error('Image load completely failed', e2);
        };
        image2.src = resolvedBaseUrl;
      };
      image.src = resolvedBaseUrl;
    }
  }, [resolvedBaseUrl, imgStatus]);

  // Use manual image if available, otherwise use hook image
  const displayImg = manualImg || img;

  // Update scene size from image natural size (cap to avoid extreme sizes)
  React.useEffect(() => {
    if (displayImg && displayImg.naturalWidth && displayImg.naturalHeight) {
      const maxDim = 1600;
      const ratio = Math.min(maxDim / displayImg.naturalWidth, maxDim / displayImg.naturalHeight, 1);
      setSceneSize({ w: Math.round(displayImg.naturalWidth * ratio), h: Math.round(displayImg.naturalHeight * ratio) });
      setBackgroundNaturalSize({ width: displayImg.naturalWidth, height: displayImg.naturalHeight });
    } else if (displayImg && displayImg.width && displayImg.height) {
      // Fallback to width/height if naturalWidth/naturalHeight not available
      const maxDim = 1600;
      const ratio = Math.min(maxDim / displayImg.width, maxDim / displayImg.height, 1);
      setSceneSize({ w: Math.round(displayImg.width * ratio), h: Math.round(displayImg.height * ratio) });
      setBackgroundNaturalSize({ width: displayImg.width, height: displayImg.height });
    }
  }, [displayImg]);

  // Observe container size
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setContainerSize({ w: cr.width, h: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit-to-screen when sizes known
  const fitToScreen = React.useCallback(() => {
    const { w: cw, h: ch } = containerSize;
    const { w: sw, h: sh } = sceneSize;
    if (!cw || !ch || !sw || !sh) return;
    const padding = 24;
    const fitScale = Math.min((cw - padding) / sw, (ch - padding) / sh);
    const nx = (cw - sw * fitScale) / 2;
    const ny = (ch - sh * fitScale) / 2;
    setScale(fitScale);
    setStagePos({ x: nx, y: ny });
  }, [containerSize, sceneSize]);

  React.useEffect(() => {
    fitToScreen();
  }, [fitToScreen]);

  // Load brand font when component mounts
  React.useEffect(() => {
    if (brandAssets.font && brandAssets.font !== 'Open Sans') {
      loadGoogleFont(brandAssets.font);
    }
  }, [brandAssets.font]);

  // Attach transformer to selected node
  React.useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    if (node) {
      tr.nodes([node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer() && tr.getLayer().batchDraw();
  }, [selectedId, layers]);

  // Keyboard: delete, tab cycle text, arrow nudge, enter to edit
  React.useEffect(() => {
    const onKey = (e) => {
      // Inline editor shortcuts
      if (inlineEdit.open) {
        if (e.key === 'Escape') { e.preventDefault(); setInlineEdit({ open:false, id:null, value:'', style:{}, position:{ x:0,y:0,w:0,h:0 } }); }
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
        return;
      }

      // Tab cycles through text nodes
      if (e.key === 'Tab') {
        e.preventDefault();
        const texts = (overlaysByAssetId[assetId] || []).filter(o => o.type === 'text');
        if (texts.length === 0) return;
        const idx = texts.findIndex(o => o.id === selectedId);
        const next = texts[(idx + 1 + texts.length) % texts.length];
        setSelectedId(next.id);
        return;
      }

      if (!selectedId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeOverlay(assetId, selectedId);
        setSelectedId(null);
        return;
      }

      // Arrow keys nudge selected overlay
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        const step = e.shiftKey ? 10 : 1;
        const current = (overlaysByAssetId[assetId] || []).find(o => o.id === selectedId);
        if (!current) return;
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        updateOverlay(assetId, selectedId, { x: (current.x || 0) + dx, y: (current.y || 0) + dy });
        return;
      }

      // Enter to begin inline editing for text
      if (e.key === 'Enter') {
        const current = (overlaysByAssetId[assetId] || []).find(o => o.id === selectedId);
        if (current && current.type === 'text') {
          e.preventDefault();
          beginInlineEdit(current);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, assetId, overlaysByAssetId, updateOverlay, removeOverlay, inlineEdit.open]);

  // Spacebar to pan
  React.useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !isPanning) {
        if ((e.target instanceof HTMLInputElement) || (e.target instanceof HTMLTextAreaElement) || (e.target?.isContentEditable)) return;
        e.preventDefault();
        setIsPanning(true);
      }
    };
    const up = (e) => {
      if (e.code === 'Space') setIsPanning(false);
    };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [isPanning]);

  const loadGoogleFont = (fontFamily) => {
    // Gilroy is already loaded from CDN in index.html
    if (fontFamily === 'Gilroy') {
      return;
    }
    
    // Check if font is already loaded
    if (document.querySelector(`link[href*="${fontFamily.replace(/\s+/g, '+')}"]`)) {
      return;
    }
    
    // Create and append Google Fonts link
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400;500;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  };

  const handleAddText = () => {
    const selectedFont = brandAssets.font || 'Open Sans';
    
    // Load the font if it's a Google Font
    if (selectedFont !== 'Open Sans') {
      loadGoogleFont(selectedFont);
    }
    
    addOverlay(assetId, {
      type: 'text',
      text: 'Your headline',
      x: width * 0.1,
      y: height * 0.15,
      fontSize: 48,
      fill: (brandAssets.colors && brandAssets.colors[0]) || '#ffffff',
      fontFamily: selectedFont
    });
    setDirty(true);
  };

  // Removed Add Logo: users can stage any logo(s) and use Add Staged Image(s)

  const handleAddStagedAsOverlay = () => {
    if (!Array.isArray(stagedImages) || stagedImages.length === 0) {
      try { console.warn('No staged images to add as overlays.'); } catch (_) {}
      return;
    }
    stagedImages.forEach((it, idx) => {
      const resolved = resolveAssetUrlForLocal(it.url);
      addOverlay(assetId, {
        type: 'logo',
        url: resolved,
        x: width * (0.1 + 0.1 * idx),
        y: height * (0.1 + 0.1 * idx),
        scale: 0.3
      });
    });
    clearStagedImages && clearStagedImages();
    setDirty(true);
  };

  const handleOverlayDragEnd = (id, node) => {
    const pos = node.position();
    const off = 200; // threshold to allow drag-out delete
    const maxX = sceneSize.w + off;
    const maxY = sceneSize.h + off;
    if (pos.x < -off || pos.y < -off || pos.x > maxX || pos.y > maxY) {
      removeOverlay(assetId, id);
      return;
    }
    updateOverlay(assetId, id, { x: pos.x, y: pos.y });
    setDirty(true);
  };

  // Helpers for inline editor positioning and lifecycle
  const getNodeAbsRect = (node) => {
    const stage = stageRef.current;
    if (!node || !stage) return { x: 0, y: 0, w: 0, h: 0 };
    const p = node.getAbsolutePosition();
    const scaleX = stage.scaleX() || 1;
    const scaleY = stage.scaleY() || 1;
    return {
      x: p.x * scaleX + stagePos.x,
      y: p.y * scaleY + stagePos.y,
      w: (node.width() || 200) * scaleX,
      h: (node.height() || ((node.fontSize && node.fontSize()) || 24) * 1.2) * scaleY
    };
  };

  const beginInlineEdit = (layer) => {
    const node = nodeRefs.current[layer.id];
    if (!node) return;
    const rect = getNodeAbsRect(node);
    setInlineEdit({
      open: true,
      id: layer.id,
      value: layer.text || '',
      style: {
        fontFamily: layer.fontFamily || (brandAssets.font || 'Open Sans'),
        fontSize: `${layer.fontSize || 24}px`,
        color: layer.fill || '#111827',
        fontStyle: layer.fontStyle || 'normal',
        letterSpacing: layer.letterSpacing || 0,
        textAlign: layer.align || 'left'
      },
      position: rect
    });
    setSelectedId(layer.id);
  };

  const commitInlineEdit = () => {
    if (!inlineEdit.open || !inlineEdit.id) return;
    updateOverlay(assetId, inlineEdit.id, { text: inlineEdit.value });
    setInlineEdit({ open: false, id: null, value: '', style: {}, position: { x:0, y:0, w:0, h:0 } });
  };

  React.useEffect(() => {
    if (!inlineEdit.open || !inlineEdit.id) return;
    const node = nodeRefs.current[inlineEdit.id];
    if (!node) return;
    const rect = getNodeAbsRect(node);
    setInlineEdit((s) => ({ ...s, position: rect }));
  }, [scale, stagePos, containerSize, sceneSize, inlineEdit.open, inlineEdit.id]);

  const exportEditedDataUrl = React.useCallback(() => {
    if (!stageRef.current || !backgroundNaturalSize) return null;
    const { width: bgW, height: bgH } = backgroundNaturalSize;
    const { w: sw, h: sh } = sceneSize;
    if (!sw || !sh) return null;

    // Save current view state
    const currentSize = stageRef.current.size();
    const currentPos = stageRef.current.position();
    const currentScale = stageRef.current.scale();

    // Render using scene coordinates (no pan/zoom)
    stageRef.current.size({ width: sw, height: sh });
    stageRef.current.scale({ x: 1, y: 1 });
    stageRef.current.position({ x: 0, y: 0 });

    // Scale bitmap to the natural resolution
    const pixelRatio = bgW / sw;
    const dataUrl = stageRef.current.toDataURL({ mimeType: 'image/png', pixelRatio });

    // Restore view state
    stageRef.current.size(currentSize);
    stageRef.current.scale(currentScale);
    stageRef.current.position(currentPos);

    return dataUrl;
  }, [backgroundNaturalSize, sceneSize]);

  const handleSaveReplace = async () => {
    try {
      const dataUrl = exportEditedDataUrl();
      if (!dataUrl) return;
      const res = await saveEditedImage({ dataUrl, originalUrl: baseUrl, replaceOriginal: true });
      setDirty(false);
      return res;
    } catch (e) {
      console.error('Save failed', e);
      throw e;
    }
  };

  const handleUseAsContext = async () => {
    try {
      const dataUrl = exportEditedDataUrl();
      if (!dataUrl) return;
      // Stage edited image so user can prompt in drawer
      if (useStore.getState().stageImage) {
        useStore.getState().stageImage({ id: `edited_${Date.now()}`, url: dataUrl, title: 'Edited base' });
      }
      alert('Edited image staged. Compose a prompt and click Create → Remix.');
    } catch (e) {
      console.error('Use-as-context failed', e);
    }
  };

  // Zoom controls for editor
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const zoomAroundPoint = (factor, point) => {
    const oldScale = scale;
    const newScale = clamp(oldScale * factor, 0.1, 5);
    const mousePointTo = {
      x: (point.x - stagePos.x) / oldScale,
      y: (point.y - stagePos.y) / oldScale,
    };
    const newPos = {
      x: point.x - mousePointTo.x * newScale,
      y: point.y - mousePointTo.y * newScale,
    };
    setScale(newScale);
    setStagePos(newPos);
  };

  const zoomInCmd = () => {
    const cx = containerSize.w / 2, cy = containerSize.h / 2;
    zoomAroundPoint(1.2, { x: cx, y: cy });
  };

  const zoomOutCmd = () => {
    const cx = containerSize.w / 2, cy = containerSize.h / 2;
    zoomAroundPoint(1/1.2, { x: cx, y: cy });
  };

  const resetZoomCmd = () => {
    // Fit to screen
    fitToScreen();
  };

  // Expose imperative methods to parent (ImageViewer)
  React.useImperativeHandle(ref, () => ({
    async saveReplace() {
      return await handleSaveReplace();
    },
    async useAsContext() {
      await handleUseAsContext();
      return true;
    },
    isDirty() { return !!dirty; },
    exportDataUrl() { return exportEditedDataUrl(); },
    zoomIn() { zoomInCmd(); },
    zoomOut() { zoomOutCmd(); },
    resetZoom() { resetZoomCmd(); },
    getZoom() { return scale; }
  }));

  // Drawing helpers
  const getScenePointer = () => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const p = stage.getPointerPosition();
    return {
      x: (p.x - stagePos.x) / scale,
      y: (p.y - stagePos.y) / scale
    };
  };

  const handlePointerDown = (e) => {
    if (activeTool === 'draw' || activeTool === 'erase') {
      setIsDrawing(true);
      const pt = getScenePointer();
      setTempPoints([pt.x, pt.y]);
      // clear redo when new stroke begins
      setRedoStack([]);
    } else if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const pt = getScenePointer();
    setTempPoints((prev) => prev.concat([pt.x, pt.y]));
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tempPoints.length < 4) { setTempPoints([]); return; }
    const path = {
      id: `path_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      type: 'path',
      points: tempPoints,
      stroke: activeTool === 'erase' ? '#ffffff' : brushColor,
      strokeWidth: brushSize,
    };
    addOverlay(assetId, path);
    setTempPoints([]);
  };

  // (moved resolver to top-level to avoid TDZ)

  // Wheel zoom inside stage
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    const scaleBy = 1.1;
    const direction = e.evt.deltaY > 0 ? -1 : 1; // wheel up to zoom in
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // Compute new position to zoom around pointer
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setScale(newScale);
    setStagePos(newPos);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 flex flex-col">
      <div className="sticky top-0 z-10 bg-dark-bg/80 backdrop-blur border-b border-dark-border p-2 flex items-center gap-3">
        <button onClick={() => setActiveTool(activeTool === 'draw' ? 'select' : 'draw')} className={`${BTN} ${activeTool==='draw' ? BTN_ACTIVE : ''}`} title="Pencil"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => setActiveTool(activeTool === 'erase' ? 'select' : 'erase')} className={`${BTN} ${activeTool==='erase' ? BTN_ACTIVE : ''}`} title="Eraser"><Eraser className="w-4 h-4" /></button>
        <div className={`${BTN} !px-2 !py-2`} title="Color">
          <input type="color" value={brushColor} onChange={(e)=>setBrushColor(e.target.value)} className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer" />
        </div>
        <div className={GROUP} title="Brush size">
          {[2,4,8,12,20].map((sz) => (
            <button key={sz} onClick={()=>setBrushSize(sz)} className={`${BTN} ${brushSize===sz ? 'bg-white' : ''}`} style={{ width: 36, height: 36 }}>
              <span style={{ display:'inline-block', width: sz, height: sz, borderRadius: '9999px', background: '#111' }} />
            </button>
          ))}
        </div>
        <button onClick={() => {
          // Undo last drawn path
          const current = overlaysByAssetId[assetId] || [];
          for (let i = current.length - 1; i >= 0; i--) {
            if (current[i].type === 'path') {
              const removed = current[i];
              removeOverlay(assetId, removed.id);
              setRedoStack((s)=>[...s, removed]);
              break;
            }
          }
        }} className={BTN} title="Undo"><RotateCcw className="w-4 h-4" /></button>
        <button onClick={() => {
          // Redo last undone path
          setRedoStack((s) => {
            if (s.length === 0) return s;
            const next = [...s];
            const item = next.pop();
            if (item) addOverlay(assetId, item);
            return next;
          });
        }} className={BTN} title="Redo"><RotateCw className="w-4 h-4" /></button>
        <button onClick={() => {
          // Clear drawn paths only
          const current = overlaysByAssetId[assetId] || [];
          current.filter(o => o.type==='path').forEach(o => removeOverlay(assetId, o.id));
          setRedoStack([]);
        }} className={BTN} title="Clear"><Trash2 className="w-4 h-4" /></button>

        {/* Text toolbar when a text layer is selected - now handled as floating toolbar */}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleAddText} className="px-3 h-9 rounded-xl bg-dark-border text-dark-text hover:bg-gray-200 flex items-center gap-2 whitespace-nowrap"><TypeIcon className="w-4 h-4" /><span className="hidden sm:inline">Add Text</span><span className="sm:hidden">Text</span></button>
          <button onClick={handleAddStagedAsOverlay} className="px-3 h-9 rounded-xl bg-dark-border text-dark-text hover:bg-gray-200 whitespace-nowrap"><span className="hidden sm:inline">Add Staged</span><span className="sm:hidden">Staged</span></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <Stage
          ref={stageRef}
          width={containerSize.w}
          height={containerSize.h}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
          draggable={activeTool === 'select' || isPanning}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              setStagePos(e.target.position());
            }
          }}
          onWheel={handleWheel}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="bg-gray-900"
          style={{ cursor: (activeTool === 'draw' || activeTool === 'erase') ? 'crosshair' : (isPanning ? 'grabbing' : 'default') }}
        >
          <Layer>
            {displayImg && <KonvaImage image={displayImg} width={sceneSize.w} height={sceneSize.h} listening={false} />}
            {!displayImg && (
              <KonvaText 
                text="Loading image..." 
                x={sceneSize.w / 2 - 50} 
                y={sceneSize.h / 2} 
                fontSize={16} 
                fill="#999"
              />
            )}
            {layers.map((layer) => (
              <LayerNode
                key={layer.id}
                layer={layer}
                isSelected={selectedId === layer.id}
                onSelect={() => setSelectedId(layer.id)}
                onEditStart={beginInlineEdit}
                registerRef={(node) => { if (node) nodeRefs.current[layer.id] = node; }}
                onDragEnd={(node) => handleOverlayDragEnd(layer.id, node)}
                onTransformEnd={(node) => {
                  const pos = node.position();
                  if (layer.type === 'logo') {
                    const nextScale = (layer.scale || 0.2) * node.scaleX();
                    node.scaleX(1); node.scaleY(1);
                    updateOverlay(assetId, layer.id, { x: pos.x, y: pos.y, scale: Math.max(0.05, nextScale) });
                  } else if (layer.type === 'text') {
                    const nextFont = Math.max(8, (layer.fontSize || 24) * node.scaleY());
                    node.scaleX(1); node.scaleY(1);
                    updateOverlay(assetId, layer.id, { x: pos.x, y: pos.y, fontSize: nextFont });
                  }
                }}
              />
            ))}
            {isDrawing && tempPoints.length > 1 && (
              <KonvaLine points={tempPoints} stroke={activeTool === 'erase' ? '#ffffff' : brushColor} strokeWidth={brushSize} lineCap="round" lineJoin="round" />
            )}
            <Transformer ref={trRef} rotateEnabled={true} enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]} borderDash={[6,4]} />
          </Layer>
        </Stage>
      </div>
      
      {/* Floating text toolbar */}
      {(() => {
        const current = (overlaysByAssetId[assetId] || []).find(o => o.id === selectedId && o.type === 'text');
        if (!current) return null;
        
        // Get text position for floating toolbar
        const node = nodeRefs.current[current.id];
        const textRect = node ? getNodeAbsRect(node) : { x: 0, y: 0, width: 0, height: 0 };
        
        // Calculate toolbar position with boundary detection
        const toolbarWidth = 400; // Approximate width of toolbar
        const toolbarHeight = 60; // Approximate height of toolbar
        const margin = 10;
        
        let left = textRect.x;
        let top = Math.max(margin, textRect.y - toolbarHeight - margin);
        
        // Keep toolbar within viewport bounds
        if (left + toolbarWidth > containerSize.w) {
          left = Math.max(margin, containerSize.w - toolbarWidth - margin);
        }
        if (top + toolbarHeight > containerSize.h) {
          top = Math.max(margin, textRect.y + textRect.height + margin);
        }
        
        const fontOptions = Array.from(new Set([
          brandAssets.font,
          'Open Sans','Inter','Roboto','Montserrat','Lato','Poppins','Gilroy','Noto Sans SC'
        ].filter(Boolean)));
        
        return (
          <div 
            className="absolute bg-white border border-gray-300 rounded-lg shadow-lg p-2 z-50"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              maxWidth: `${toolbarWidth}px`
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* Font family dropdown */}
              <select
                value={current.fontFamily || brandAssets.font || 'Open Sans'}
                onChange={(e)=>{ const ff = e.target.value; if (ff && ff !== 'Open Sans') loadGoogleFont(ff); updateOverlay(assetId, current.id, { fontFamily: ff }); }}
                className="h-8 px-2 rounded border text-sm min-w-0 flex-shrink-0"
                style={{ minWidth: '120px' }}
              >
                {fontOptions.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              
              {/* Font size input */}
              <input
                type="number"
                min={8}
                max={256}
                value={Math.round(current.fontSize || 24)}
                onChange={(e)=>updateOverlay(assetId, current.id, { fontSize: Number(e.target.value || 24) })}
                className="w-16 h-8 rounded border text-sm flex-shrink-0"
                title="Font size"
              />
              
              {/* Color buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {(brandAssets.colors || []).slice(0,6).map((c) => (
                  <button 
                    key={c} 
                    onClick={()=>updateOverlay(assetId, current.id, { fill: c })} 
                    className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-gray-500" 
                    style={{ background: c }} 
                    title={c} 
                  />
                ))}
              </div>
              
              {/* Bold/Italic buttons */}
              <button 
                onClick={()=>{ const fs = current.fontStyle || 'normal'; const hasBold = fs.includes('bold'); const next = (hasBold ? fs.replace('bold','') : (fs + ' bold')).trim(); updateOverlay(assetId, current.id, { fontStyle: next }); }} 
                className={`w-8 h-8 rounded border text-sm font-bold flex-shrink-0 ${(current.fontStyle || '').includes('bold') ? 'bg-gray-200' : 'bg-white'}`}
                title="Bold"
              >
                B
              </button>
              <button 
                onClick={()=>{ const fs = current.fontStyle || 'normal'; const hasIt = fs.includes('italic'); const next = (hasIt ? fs.replace('italic','') : (fs + ' italic')).trim(); updateOverlay(assetId, current.id, { fontStyle: next }); }} 
                className={`w-8 h-8 rounded border text-sm italic flex-shrink-0 ${(current.fontStyle || '').includes('italic') ? 'bg-gray-200' : 'bg-white'}`}
                title="Italic"
              >
                <i>I</i>
              </button>
              
              {/* Alignment */}
              <select 
                value={current.align || 'left'} 
                onChange={(e)=>updateOverlay(assetId, current.id, { align: e.target.value })} 
                className="h-8 px-2 rounded border text-sm flex-shrink-0" 
                title="Align"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              
              {/* Edit/Delete buttons */}
              <button 
                onClick={()=>beginInlineEdit(current)} 
                className="w-8 h-8 rounded border bg-white hover:bg-gray-100 flex items-center justify-center flex-shrink-0" 
                title="Edit text"
              >
                <TypeIcon className="w-4 h-4" />
              </button>
              <button 
                onClick={()=>{ removeOverlay(assetId, current.id); setSelectedId(null); }} 
                className="w-8 h-8 rounded border bg-white hover:bg-red-100 flex items-center justify-center flex-shrink-0" 
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })()}
      
      {inlineEdit.open && (
        <textarea
          value={inlineEdit.value}
          onChange={(e)=>setInlineEdit(s => ({ ...s, value: e.target.value }))}
          onKeyDown={(e)=>{ if (e.key === 'Escape') { e.preventDefault(); setInlineEdit({ open:false, id:null, value:'', style:{}, position:{ x:0,y:0,w:0,h:0 } }); } if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); } }}
          onBlur={commitInlineEdit}
          autoFocus
          style={{ position:'absolute', left:inlineEdit.position.x, top:inlineEdit.position.y, width: Math.max(160, inlineEdit.position.w), minHeight: Math.max(32, inlineEdit.position.h), background:'rgba(255,255,255,0.95)', color:inlineEdit.style.color, fontFamily:inlineEdit.style.fontFamily, fontSize:inlineEdit.style.fontSize, fontStyle:inlineEdit.style.fontStyle, letterSpacing:inlineEdit.style.letterSpacing, textAlign:inlineEdit.style.textAlign, lineHeight:1.2, padding:'6px 8px', borderRadius:8, border:'1px solid #E5E7EB', zIndex:50 }}
        />
      )}
      <div className="text-xs text-dark-text-secondary p-2 border-t border-dark-border">Tip: Double-click text to edit. Drag elements to move. Use Brand Kit for fonts/colors.</div>
    </div>
  );
});

const LayerNode = ({ layer, onDragEnd, onSelect, isSelected, registerRef, onTransformEnd, onEditStart }) => {
  const [logoImg] = useImage(layer.type === 'logo' && layer.url ? layer.url : '', 'anonymous');
  
  if (layer.type === 'path') {
    return (
      <KonvaLine
        points={layer.points}
        stroke={layer.stroke || '#000'}
        strokeWidth={layer.strokeWidth || 4}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    );
  }

  if (layer.type === 'text') {
    return (
      <KonvaText
        text={layer.text}
        x={layer.x}
        y={layer.y}
        fontSize={layer.fontSize}
        fill={layer.fill}
        align={layer.align || 'left'}
        letterSpacing={layer.letterSpacing || 0}
        fontStyle={layer.fontStyle || 'normal'}
        draggable
        fontFamily={layer.fontFamily}
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={() => { onEditStart && onEditStart(layer); }}
        onDragEnd={(e) => onDragEnd(e.target)}
        ref={registerRef}
        onTransformEnd={(e) => onTransformEnd(e.target)}
      />
    );
  }
  if (layer.type === 'logo' && layer.url && logoImg) {
    const w = (logoImg.width || 512) * (layer.scale || 0.2);
    const h = (logoImg.height || 512) * (layer.scale || 0.2);
    return (
      <KonvaImage
        image={logoImg}
        x={layer.x}
        y={layer.y}
        width={w}
        height={h}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onDragEnd(e.target)}
        ref={registerRef}
        onTransformEnd={(e) => onTransformEnd(e.target)}
      />
    );
  }
  return null;
};

export default CanvasEditor;


