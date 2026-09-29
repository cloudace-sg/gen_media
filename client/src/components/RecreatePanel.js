import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Wand2, Loader2, AlertCircle, Package, RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { reverseEngineerPrompt } from '../services/api';

const Chip = ({ children }) => (
  <span className="text-xs px-2 py-1 rounded-full bg-dark-bg border border-dark-border text-dark-text-secondary">
    {children}
  </span>
);

const SceneList = ({ title, scenes, fields }) => {
  if (!scenes || scenes.length === 0) return null;
  return (
    <div>
      <div className="text-sm font-semibold text-dark-text mb-2">{title}</div>
      <div className="space-y-2">
        {scenes.map((scene, i) => (
          <div key={i} className="rounded-lg border border-dark-border bg-dark-bg p-2 text-xs space-y-1">
            {scene.timestamp && (
              <div className="text-accent font-mono">{scene.timestamp}</div>
            )}
            {fields.map((f) => scene[f.key] ? (
              <div key={f.key}><span className="text-dark-text-secondary">{f.label}: </span><span className="text-dark-text">{scene[f.key]}</span></div>
            ) : null)}
          </div>
        ))}
      </div>
    </div>
  );
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const RecreatePanel = () => {
  const { recreatePanel, closeRecreatePanel, applyRecreateToPrompt, setRecreateResult, setRecreateError } = useStore();
  const navigate = useNavigate();
  const { isOpen, loading, error, result, mediaType, sourceImage } = recreatePanel;
  const [productImagePreview, setProductImagePreview] = useState(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const productFileRef = useRef(null);

  if (!isOpen) return null;

  const promptText = mediaType === 'video' ? result?.veo_prompt : result?.prompt;

  const handleProductFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sourceImage) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProductImagePreview(dataUrl);
      setIsSwapping(true);
      const swapped = await reverseEngineerPrompt({
        mediaUrl: sourceImage.url,
        mediaType,
        productImageUrl: dataUrl,
      });
      setRecreateResult(swapped);
    } catch (err) {
      setRecreateError(err.message || 'Failed to swap in product');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleClearProductSwap = async () => {
    setProductImagePreview(null);
    if (!sourceImage) return;
    setIsSwapping(true);
    try {
      const original = await reverseEngineerPrompt({ mediaUrl: sourceImage.url, mediaType });
      setRecreateResult(original);
    } catch (err) {
      setRecreateError(err.message || 'Failed to reset');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleUsePrompt = () => {
    if (!promptText) return;
    applyRecreateToPrompt({
      prompt: promptText,
      mediaType,
      styleId: mediaType === 'image' ? (result?.suggested_style_id || 'freeform') : undefined,
      aspectRatio: result?.suggested_aspect_ratio,
    });
    closeRecreatePanel();
    navigate('/');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex">
      <div className="ml-auto w-full max-w-[480px] h-full bg-dark-surface p-4 border-l border-dark-border overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-accent" />
            <div className="text-lg font-semibold text-dark-text">Recreate This</div>
          </div>
          <button onClick={closeRecreatePanel} className="p-1.5 rounded hover:bg-dark-border text-dark-text-secondary" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {sourceImage && (
          <div className="rounded-lg border border-dark-border overflow-hidden mb-4 bg-dark-bg">
            {mediaType === 'video' ? (
              <video src={sourceImage.url} className="w-full max-h-48 object-contain" muted playsInline preload="metadata" />
            ) : (
              <img src={sourceImage.url} alt={sourceImage.title || 'Source'} className="w-full max-h-48 object-contain" />
            )}
          </div>
        )}

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dark-text-secondary py-12">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <div className="text-sm">Analyzing {mediaType} with Gemini…</div>
          </div>
        )}

        {!loading && error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dark-text-secondary py-12 px-4 text-center">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <div className="text-sm">{error}</div>
          </div>
        )}

        {!loading && !error && result && (
          <div className="space-y-4 flex-1">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-dark-text">Swap Product</div>
                {productImagePreview && (
                  <button
                    onClick={handleClearProductSwap}
                    disabled={isSwapping}
                    className="text-xs text-dark-text-secondary hover:text-dark-text flex items-center gap-1"
                    title="Revert to original product"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
              <input ref={productFileRef} type="file" accept="image/*" className="hidden" onChange={handleProductFileChange} />
              <button
                onClick={() => productFileRef.current?.click()}
                disabled={isSwapping}
                className="w-full flex items-center gap-3 p-2 rounded-lg border border-dashed border-dark-border hover:border-accent bg-dark-bg text-left transition-colors disabled:opacity-60"
              >
                {productImagePreview ? (
                  <img src={productImagePreview} alt="Swapped product" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-dark-surface flex items-center justify-center">
                    <Package className="w-4 h-4 text-dark-text-secondary" />
                  </div>
                )}
                <div className="text-xs text-dark-text-secondary">
                  {isSwapping ? 'Re-analyzing with new product…' : (productImagePreview ? 'Product swapped — click to change' : 'Upload a product image to swap into this prompt')}
                </div>
                {isSwapping && <Loader2 className="w-4 h-4 animate-spin text-accent ml-auto" />}
              </button>
            </div>

            <div>
              <div className="text-sm font-semibold text-dark-text mb-2">Generation Prompt</div>
              <div className="rounded-lg border border-dark-border bg-dark-bg p-3 text-sm text-dark-text whitespace-pre-wrap">
                {promptText || '—'}
              </div>
            </div>

            {Array.isArray(result.style_tags) && result.style_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.style_tags.map((tag, i) => <Chip key={i}>{tag}</Chip>)}
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-dark-text-secondary">
              {result.suggested_aspect_ratio && <div>Aspect ratio: <span className="text-dark-text">{result.suggested_aspect_ratio}</span></div>}
              {result.suggested_duration && <div>Duration: <span className="text-dark-text">{result.suggested_duration}</span></div>}
              {result.suggested_style_id && <div>Style match: <span className="text-dark-text">{result.suggested_style_id}</span></div>}
              {result.camera_movement && <div>Camera: <span className="text-dark-text">{result.camera_movement}</span></div>}
            </div>

            <SceneList
              title="Product Interaction Shots"
              scenes={result.product_interaction_scenes}
              fields={[{ key: 'action', label: 'Action' }, { key: 'fidelity_requirement', label: 'Must preserve' }]}
            />

            <SceneList
              title="Text Overlays"
              scenes={result.text_overlay_scenes}
              fields={[{ key: 'text', label: 'Text' }, { key: 'position', label: 'Position' }, { key: 'style', label: 'Style' }]}
            />

            {result.confidence_notes && (
              <div className="text-xs text-dark-text-secondary italic border-t border-dark-border pt-3">
                {result.confidence_notes}
              </div>
            )}
          </div>
        )}

        {!loading && !error && result && (
          <div className="mt-4 pt-3 border-t border-dark-border">
            <button
              onClick={handleUsePrompt}
              className="w-full h-10 rounded-lg bg-accent text-black hover:bg-accent-hover flex items-center justify-center gap-2 font-medium text-sm"
            >
              <Wand2 className="w-4 h-4" />
              Use this prompt
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecreatePanel;
