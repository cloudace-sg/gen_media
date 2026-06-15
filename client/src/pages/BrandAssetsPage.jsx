import React from 'react';
import { Trash2, Upload, Palette, Type, Image as ImageIcon, HelpCircle, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useStore } from '../store/useStore';
import { getBrandKit, updateBrandKit, uploadBrandLogos } from '../services/api';
import PageHeader from '../components/ui/PageHeader';

const BrandAssetsPage = () => {
  const { brandAssets, setBrandAssets, stageImage } = useStore();
  const navigate = useNavigate();
  const [localColors, setLocalColors] = React.useState(brandAssets.colors || []);
  const [colorPickerOpen, setColorPickerOpen] = React.useState(null);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const logoInputRef = React.useRef(null);
  const colorPickerRef = React.useRef(null);

  const MAX_COLORS = 6;
  const ensureColorSlots = (arr) => {
    const copy = Array.isArray(arr) ? [...arr] : [];
    while (copy.length < MAX_COLORS) copy.push(null);
    return copy.slice(0, MAX_COLORS);
  };

  React.useEffect(() => {
    (async () => {
      try {
        const kit = await getBrandKit();
        console.log('Brand Kit loaded:', kit);
        console.log('Logo URLs:', kit.logos);
        setBrandAssets(kit);
        setLocalColors(kit.colors || []);
        
        // Load the current font if it exists
        if (kit.font) {
          loadGoogleFont(kit.font);
        }
      } catch (e) {
        console.error('Failed to load brand kit:', e);
      }
    })();
  }, [setBrandAssets]);

  React.useEffect(() => {
    setLocalColors(ensureColorSlots(brandAssets.colors));
  }, [brandAssets.colors]);

  const handlePickColor = async (idx, value) => {
    setIsUpdating(true);
    try {
      const next = [...localColors];
      next[idx] = value;
      setLocalColors(next);
      const kit = await updateBrandKit({ colors: next.filter(Boolean), logos: brandAssets.logos, styleImages: brandAssets.styleImages, fonts: brandAssets.fonts });
      setBrandAssets(kit);
    } catch (error) {
      console.error('Failed to update color:', error);
      // Revert local state on error
      setLocalColors(brandAssets.colors || []);
    } finally {
      setIsUpdating(false);
    }
  };

  const clearColor = async (idx) => {
    setIsUpdating(true);
    try {
      const next = [...localColors];
      next[idx] = null;
      setLocalColors(next);
      const kit = await updateBrandKit({ colors: next.filter(Boolean), logos: brandAssets.logos, styleImages: brandAssets.styleImages, fonts: brandAssets.fonts });
      setBrandAssets(kit);
    } catch (error) {
      console.error('Failed to clear color:', error);
      setLocalColors(brandAssets.colors || []);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleColorSquareClick = (idx) => {
    setColorPickerOpen(colorPickerOpen === idx ? null : idx);
  };

  const handleColorPickerChange = (color) => {
    if (colorPickerOpen !== null) {
      // Update local state immediately for responsive UI
      const next = [...localColors];
      next[colorPickerOpen] = color;
      setLocalColors(next);
      // Then update via API
      handlePickColor(colorPickerOpen, color);
    }
  };

  // Close color picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
        setColorPickerOpen(null);
      }
    };

    if (colorPickerOpen !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [colorPickerOpen]);

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

  const loadGoogleFont = (fontFamily) => {
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

  const handleFontChange = async (fontFamily) => {
    try {
      // Load the font dynamically
      loadGoogleFont(fontFamily);
      
      const kit = await updateBrandKit({ font: fontFamily, logos: brandAssets.logos, colors: brandAssets.colors });
      setBrandAssets(kit);
    } catch (error) {
      console.error('Failed to update font:', error);
    }
  };

  const GOOGLE_FONTS = [
    'Open Sans', 'Roboto', 'Lato', 'Montserrat', 'Source Sans Pro', 'Oswald', 'Raleway', 'PT Sans', 'Lora', 'Merriweather',
    'Playfair Display', 'Inter', 'Poppins', 'Nunito', 'Ubuntu', 'Crimson Text', 'Libre Baskerville', 'Fira Sans', 'Work Sans', 'Cabin'
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 md:px-8 md:py-8 space-y-6">
      <PageHeader
        title="Brand Assets"
        subtitle="Manage your logos, colors, and fonts to guide AI generation"
        right={(
          <Link to="/help#brand-assets" className="inline-flex items-center gap-1 text-sm text-blue-400 hover:underline mt-1" title="Open docs">
            <HelpCircle className="h-4 w-4" />
            Help
          </Link>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logos Section */}
        <div className="bg-dark-surface border border-dark-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <ImageIcon className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-dark-text">Logos</h2>
          </div>
          
          <div className="mb-4">
            <input ref={logoInputRef} type="file" accept="image/png" multiple className="hidden" onChange={handleUploadLogos} />
            <button 
              onClick={() => logoInputRef.current?.click()} 
              className="flex items-center gap-2 px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent-hover transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload Logos
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {brandAssets.logos.map((url, idx) => (
              <div key={url} className="relative group">
                <img
                  src={url}
                  alt="logo"
                  className="w-full h-20 object-contain bg-dark-bg border border-dark-border rounded"
                  onError={(e) => { console.error('Failed to load logo:', url); }}
                />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 bg-black/40 rounded">
                  <button
                    onClick={() => {
                      stageImage({ id: `brand_logo_${idx}`, title: 'Brand Logo', url, thumbnail: url, source: 'Brand Kit' });
                      navigate('/canvas');
                    }}
                    className="w-7 h-7 rounded bg-accent text-black flex items-center justify-center"
                    title="Use as reference"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeLogo(url)}
                    className="w-7 h-7 rounded bg-red-600 text-white flex items-center justify-center"
                    title="Remove logo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {brandAssets.logos.length === 0 && (
              <div className="col-span-3 text-center py-8 text-dark-text-secondary">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No logos uploaded yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Colors Section */}
        <div className="bg-dark-surface border border-dark-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-dark-text">Color Palette</h2>
            {isUpdating && (
              <div className="ml-auto">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            {ensureColorSlots(localColors).map((hex, idx) => (
              <div key={idx} className="flex items-center gap-3 relative">
                <div 
                  className="w-10 h-10 rounded border border-dark-border flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: localColors[idx] || '#f0f0f0' }}
                  onClick={() => handleColorSquareClick(idx)}
                  title="Click to pick color"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={localColors[idx] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Update local state immediately for responsive UI
                      const next = [...localColors];
                      next[idx] = value || null;
                      setLocalColors(next);
                      
                      // Validate and update via API if valid
                      if (value === '' || /^#[0-9A-Fa-f]{6}$/.test(value)) {
                        handlePickColor(idx, value || null);
                      }
                    }}
                    placeholder="#000000"
                    className="w-full p-2 bg-dark-bg border border-dark-border rounded text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
                    style={{ fontFamily: 'monospace' }}
                    disabled={isUpdating}
                  />
                </div>
                {localColors[idx] && (
                  <button 
                    onClick={() => clearColor(idx)} 
                    className="text-red-400 hover:text-red-300 p-1 disabled:opacity-50"
                    title="Remove color"
                    disabled={isUpdating}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                
                {/* Color Picker */}
                {colorPickerOpen === idx && (
                  <div 
                    ref={colorPickerRef}
                    className="absolute top-12 left-0 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3"
                  >
                    <HexColorPicker
                      color={localColors[idx] || '#000000'}
                      onChange={handleColorPickerChange}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: localColors[idx] || '#000000' }}
                      />
                      <HexColorInput
                        color={localColors[idx] || '#000000'}
                        onChange={handleColorPickerChange}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Font Section */}
        <div className="bg-dark-surface border border-dark-border rounded-lg p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <Type className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-dark-text">Typography</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-dark-text mb-2">Primary Font</label>
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
            </div>
            
            {brandAssets.font && (
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">Preview</label>
                <div className="p-4 bg-dark-bg border border-dark-border rounded">
                  <div 
                    className="text-lg leading-relaxed text-dark-text" 
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandAssetsPage;


