import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getBrandKit, updateBrandKit, uploadBrandLogos } from '../services/api';

const BrandKitModal = () => {
  const { brandKitModalOpen, closeBrandKitModal, brandAssets, setBrandAssets } = useStore();
  const [localColors, setLocalColors] = React.useState(brandAssets.colors || []);
  const logoInputRef = React.useRef(null);
  const fontInputRef = React.useRef(null);

  const MAX_COLORS = 6;
  const ensureColorSlots = (arr) => {
    const copy = Array.isArray(arr) ? [...arr] : [];
    while (copy.length < MAX_COLORS) copy.push(null);
    return copy.slice(0, MAX_COLORS);
  };

  React.useEffect(() => {
    if (!brandKitModalOpen) return;
    (async () => {
      try {
        const kit = await getBrandKit();
        setBrandAssets(kit);
        setLocalColors(kit.colors || []);
      } catch (e) {}
    })();
  }, [brandKitModalOpen, setBrandAssets]);

  React.useEffect(() => {
    setLocalColors(ensureColorSlots(brandAssets.colors));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandAssets.colors]);

  if (!brandKitModalOpen) return null;

  const handlePickColor = async (idx, value) => {
    const next = [...localColors];
    next[idx] = value;
    setLocalColors(next);
    const kit = await updateBrandKit({ colors: next.filter(Boolean), logos: brandAssets.logos, styleImages: brandAssets.styleImages, fonts: brandAssets.fonts });
    setBrandAssets(kit);
  };

  const clearColor = async (idx) => {
    const next = [...localColors];
    next[idx] = null;
    setLocalColors(next);
    const kit = await updateBrandKit({ colors: next.filter(Boolean), logos: brandAssets.logos, styleImages: brandAssets.styleImages, fonts: brandAssets.fonts });
    setBrandAssets(kit);
  };

  const handleUploadLogos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const kit = await uploadBrandLogos(files);
    setBrandAssets(kit);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const removeLogo = async (url) => {
    const kit = await updateBrandKit({ logos: brandAssets.logos.filter(l => l !== url), colors: brandAssets.colors, font: brandAssets.font });
    setBrandAssets(kit);
  };

  const handleFontChange = async (fontFamily) => {
    const kit = await updateBrandKit({ font: fontFamily, logos: brandAssets.logos, colors: brandAssets.colors });
    setBrandAssets(kit);
  };

  const GOOGLE_FONTS = [
    'Open Sans',
    'Roboto',
    'Lato',
    'Montserrat',
    'Source Sans Pro',
    'Oswald',
    'Raleway',
    'PT Sans',
    'Lora',
    'Merriweather',
    'Playfair Display',
    'Inter',
    'Poppins',
    'Nunito',
    'Ubuntu',
    'Crimson Text',
    'Libre Baskerville',
    'Fira Sans',
    'Work Sans',
    'Cabin'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
      <div className="w-full h-full max-w-5xl max-h-[90vh] bg-dark-surface border border-dark-border rounded-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-xl font-semibold text-dark-text">Manage Your Brand Kit</h2>
          <button onClick={closeBrandKitModal} className="text-dark-text-secondary hover:text-red-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-8">
          {/* Logos */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-dark-text">Logos</h3>
              <div>
                <input ref={logoInputRef} type="file" accept="image/png" multiple className="hidden" onChange={handleUploadLogos} />
                <button onClick={() => logoInputRef.current?.click()} className="btn-secondary">Upload Logos</button>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              {brandAssets.logos.map((url) => (
                <div key={url} className="relative">
                  <img src={url} alt="logo" className="w-16 h-16 object-contain bg-dark-bg border border-dark-border rounded" />
                  <button onClick={() => removeLogo(url)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {brandAssets.logos.length === 0 && (
                <p className="text-dark-text-secondary text-sm">No logos yet.</p>
              )}
            </div>
          </section>

          {/* Fonts - Google Fonts Selector */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-dark-text">Fonts</h3>
              <div></div>
            </div>
            <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
              <select
                value={brandAssets.font || 'Open Sans'}
                onChange={(e) => handleFontChange(e.target.value)}
                className="w-full p-3 bg-dark-bg border border-dark-border rounded text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {GOOGLE_FONTS.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
              {brandAssets.font && (
                <div className="mt-3 p-3 bg-dark-surface border border-dark-border rounded">
                  <div className="text-sm text-dark-text-secondary mb-2">Preview:</div>
                  <div 
                    className="text-lg leading-relaxed" 
                    style={{ 
                      fontFamily: `"${brandAssets.font}", sans-serif`,
                      fontWeight: 400
                    }}
                  >
                    The quick brown fox jumps over the lazy dog
                  </div>
                  <div className="text-xs text-dark-text-secondary mt-2">
                    Font: {brandAssets.font}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Colors - Hex Input */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-dark-text">Color Palette</h3>
              <span className="text-xs text-dark-text-secondary">Enter hex codes (e.g., #FF0000)</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {ensureColorSlots(localColors).map((hex, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded border border-dark-border flex-shrink-0"
                    style={{ backgroundColor: hex || '#f0f0f0' }}
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={hex || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^#[0-9A-Fa-f]{6}$/.test(value)) {
                          handlePickColor(idx, value || null);
                        }
                      }}
                      placeholder="#000000"
                      className="w-full p-2 bg-dark-bg border border-dark-border rounded text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  {hex && (
                    <button 
                      onClick={() => clearColor(idx)} 
                      className="text-red-400 hover:text-red-300 p-1"
                      title="Remove color"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BrandKitModal;


