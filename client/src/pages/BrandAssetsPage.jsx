import React from 'react';
import { Trash2, Upload, Palette, Type, Image as ImageIcon, HelpCircle, Plus, Star, Grid, Wand2, Download, Loader } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useStore } from '../store/useStore';
import { getBrandKit, updateBrandKit, uploadBrandLogos, generateImages, saveEditedImage, uploadImages, listFiles } from '../services/api';
import PageHeader from '../components/ui/PageHeader';

const ANGLE_PROMPTS = [
  'Front view, straight on',
  'Side profile, left',
  'Side profile, right',
  'Top-down flat lay',
  '45° elevated angle',
  'Back view',
  'Close-up label detail',
  'In-hand lifestyle shot',
  'Studio white background',
];

async function buildContactSheet(imageUrls) {
  const cols = Math.ceil(Math.sqrt(imageUrls.length));
  const rows = Math.ceil(imageUrls.length / cols);
  const cell = 400;
  const gap = 8;
  const w = cols * cell + (cols + 1) * gap;
  const h = rows * cell + (rows + 1) * gap;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);
  await Promise.all(imageUrls.map((url, i) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gap + col * (cell + gap);
      const y = gap + row * (cell + gap);
      const scale = Math.min(cell / img.width, cell / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, x + (cell - sw) / 2, y + (cell - sh) / 2, sw, sh);
      resolve();
    };
    img.onerror = resolve;
    img.src = url;
  })));
  return canvas.toDataURL('image/jpeg', 0.92);
}

const BrandAssetsPage = () => {
  const { brandAssets, setBrandAssets, stageImage } = useStore();
  const navigate = useNavigate();
  const [localColors, setLocalColors] = React.useState(brandAssets.colors || []);
  const [colorPickerOpen, setColorPickerOpen] = React.useState(null);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const logoInputRef = React.useRef(null);
  const colorPickerRef = React.useRef(null);

  // Hero Asset state
  const [heroPrompt, setHeroPrompt] = React.useState('');
  const [heroGenerating, setHeroGenerating] = React.useState(false);
  const [heroError, setHeroError] = React.useState('');
  const heroUploadRef = React.useRef(null);

  // ID Grid state
  const [gridSlots, setGridSlots] = React.useState(Array(9).fill(null));
  const [gridGenerating, setGridGenerating] = React.useState(Array(9).fill(false));
  const [gridPrompts, setGridPrompts] = React.useState(ANGLE_PROMPTS.slice());
  const [sheetBuilding, setSheetBuilding] = React.useState(false);
  const gridUploadRefs = React.useRef(Array(9).fill(null).map(() => React.createRef()));

  // My Files picker state
  const [pickerOpen, setPickerOpen] = React.useState(false); // false | 'hero' | number (grid idx)
  const [pickerFiles, setPickerFiles] = React.useState([]);
  const [pickerLoading, setPickerLoading] = React.useState(false);

  const openPicker = async (target) => {
    setPickerOpen(target);
    setPickerLoading(true);
    try {
      const data = await listFiles({ limit: 100 });
      const all = data.items || [];
      setPickerFiles(all.filter(f => !f.type?.includes('video') && f.url));
    } catch (e) {
      setPickerFiles([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const handlePickerSelect = async (file) => {
    const url = file.url;
    if (!url) return;
    if (pickerOpen === 'hero') {
      const kit = await updateBrandKit({ ...brandAssets, heroImage: url, idGrid: gridSlots.filter(Boolean) });
      setBrandAssets(kit);
    } else if (typeof pickerOpen === 'number') {
      const slots = [...gridSlots]; slots[pickerOpen] = url; setGridSlots(slots);
      const kit = await updateBrandKit({ ...brandAssets, idGrid: slots.filter(Boolean) });
      setBrandAssets(kit);
    }
    setPickerOpen(false);
  };

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
        setBrandAssets(kit);
        setLocalColors(kit.colors || []);
        if (kit.font) loadGoogleFont(kit.font);
        if (Array.isArray(kit.idGrid)) {
          const slots = Array(9).fill(null);
          kit.idGrid.forEach((url, i) => { slots[i] = url; });
          setGridSlots(slots);
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

  // ── Hero Asset handlers ──────────────────────────────────────────────────
  const handleGenerateHero = async () => {
    if (!heroPrompt.trim()) return;
    setHeroGenerating(true);
    setHeroError('');
    try {
      const data = await generateImages(heroPrompt.trim(), 'Product-Focused Advertisement', 1, '1:1');
      const url = (data.results || data)[0]?.url;
      if (!url) throw new Error('No image returned');
      const kit = await updateBrandKit({ ...brandAssets, heroImage: url, idGrid: gridSlots.filter(Boolean) });
      setBrandAssets(kit);
    } catch (e) {
      setHeroError(e.message || 'Generation failed');
    } finally {
      setHeroGenerating(false);
    }
  };

  const handleUploadHero = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await uploadImages([file]);
      const url = (data.results || data)[0]?.url;
      if (!url) throw new Error('Upload failed');
      const kit = await updateBrandKit({ ...brandAssets, heroImage: url, idGrid: gridSlots.filter(Boolean) });
      setBrandAssets(kit);
    } catch (e) {
      setHeroError(e.message || 'Upload failed');
    }
    if (heroUploadRef.current) heroUploadRef.current.value = '';
  };

  const handleRemoveHero = async () => {
    const kit = await updateBrandKit({ ...brandAssets, heroImage: null, idGrid: gridSlots.filter(Boolean) });
    setBrandAssets(kit);
  };

  // ── ID Grid handlers ─────────────────────────────────────────────────────
  const handleGenerateGridSlot = async (idx) => {
    const prompt = gridPrompts[idx];
    if (!prompt.trim()) return;
    const next = [...gridGenerating]; next[idx] = true; setGridGenerating(next);
    try {
      const data = await generateImages(prompt.trim(), 'Product-Focused Advertisement', 1, '1:1');
      const url = (data.results || data)[0]?.url;
      if (!url) throw new Error('No image returned');
      const slots = [...gridSlots]; slots[idx] = url; setGridSlots(slots);
      const kit = await updateBrandKit({ ...brandAssets, idGrid: slots.filter(Boolean) });
      setBrandAssets(kit);
    } catch (e) {
      console.error('Grid slot generation failed:', e);
    } finally {
      const n = [...gridGenerating]; n[idx] = false; setGridGenerating(n);
    }
  };

  const handleUploadGridSlot = async (e, idx) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await uploadImages([file]);
      const url = (data.results || data)[0]?.url;
      if (!url) throw new Error('Upload failed');
      const slots = [...gridSlots]; slots[idx] = url; setGridSlots(slots);
      const kit = await updateBrandKit({ ...brandAssets, idGrid: slots.filter(Boolean) });
      setBrandAssets(kit);
    } catch (e) {
      console.error('Grid slot upload failed:', e);
    }
    if (gridUploadRefs.current[idx]?.current) gridUploadRefs.current[idx].current.value = '';
  };

  const handleRemoveGridSlot = async (idx) => {
    const slots = [...gridSlots]; slots[idx] = null; setGridSlots(slots);
    const kit = await updateBrandKit({ ...brandAssets, idGrid: slots.filter(Boolean) });
    setBrandAssets(kit);
  };

  const handleMakeContactSheet = async () => {
    const filled = gridSlots.filter(Boolean);
    if (filled.length === 0) return;
    setSheetBuilding(true);
    try {
      const dataUrl = await buildContactSheet(filled);
      const saved = await saveEditedImage({ dataUrl, originalUrl: null, replaceOriginal: false });
      const url = saved?.url;
      if (url) {
        stageImage({ id: `idgrid_sheet_${Date.now()}`, title: 'ID Grid Contact Sheet', url, thumbnail: url, source: 'Brand Kit' });
        navigate('/canvas');
      }
    } catch (e) {
      console.error('Contact sheet failed:', e);
    } finally {
      setSheetBuilding(false);
    }
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

        {/* Hero Asset Section */}
        <div className="bg-dark-surface border border-dark-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-1">
            <Star className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-dark-text">Hero Asset</h2>
          </div>
          <p className="text-xs text-dark-text-secondary mb-4">A single flawless product shot used as the primary Veo reference.</p>

          {brandAssets.heroImage ? (
            <div className="relative group mb-4">
              <img src={brandAssets.heroImage} alt="Hero asset" className="w-full h-48 object-contain bg-dark-bg border border-dark-border rounded-lg" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 bg-black/40 rounded-lg">
                <button
                  onClick={() => { stageImage({ id: 'brand_hero', title: 'Hero Asset', url: brandAssets.heroImage, thumbnail: brandAssets.heroImage, source: 'Brand Kit' }); navigate('/canvas'); }}
                  className="px-3 h-8 rounded bg-accent text-black text-xs font-medium flex items-center gap-1"
                  title="Stage as Veo reference"
                ><Plus className="h-3 w-3" /> Use as reference</button>
                <button onClick={handleRemoveHero} className="w-8 h-8 rounded bg-red-600 text-white flex items-center justify-center" title="Remove"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ) : (
            <div className="w-full h-32 border-2 border-dashed border-dark-border rounded-lg flex items-center justify-center mb-4">
              <p className="text-sm text-dark-text-secondary">No hero image yet</p>
            </div>
          )}

          <div className="flex gap-2 mb-2">
            <input
              value={heroPrompt}
              onChange={e => setHeroPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerateHero()}
              placeholder="Describe your product for the hero shot…"
              className="flex-1 px-3 h-9 bg-dark-bg border border-dark-border rounded text-sm text-dark-text focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={handleGenerateHero}
              disabled={heroGenerating || !heroPrompt.trim()}
              className="px-3 h-9 rounded bg-accent text-black text-sm font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {heroGenerating ? <Loader className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Generate
            </button>
            <input ref={heroUploadRef} type="file" accept="image/*" className="hidden" onChange={handleUploadHero} />
            <button onClick={() => heroUploadRef.current?.click()} className="px-3 h-9 rounded bg-dark-border text-dark-text text-sm flex items-center gap-1 hover:bg-gray-200">
              <Upload className="h-4 w-4" /> Upload
            </button>
            <button onClick={() => openPicker('hero')} className="px-3 h-9 rounded bg-dark-border text-dark-text text-sm flex items-center gap-1 hover:bg-gray-200">
              My Files
            </button>
          </div>
          {heroError && <p className="text-xs text-red-400 mt-1">{heroError}</p>}
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
        {/* ID Grid Section */}
        <div className="bg-dark-surface border border-dark-border rounded-lg p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Grid className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-dark-text">ID Grid</h2>
            </div>
            <button
              onClick={handleMakeContactSheet}
              disabled={sheetBuilding || gridSlots.filter(Boolean).length === 0}
              className="px-3 h-9 rounded bg-purple-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 hover:bg-purple-500"
            >
              {sheetBuilding ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Make Contact Sheet → Stage for Veo
            </button>
          </div>
          <p className="text-xs text-dark-text-secondary mb-4">4–9 product shots from different angles. Generate or upload each slot, then stitch into a contact sheet reference.</p>

          <div className="grid grid-cols-3 gap-3">
            {gridSlots.map((url, idx) => (
              <div key={idx} className="border border-dark-border rounded-lg overflow-hidden">
                {url ? (
                  <div className="relative group">
                    <img src={url} alt={`Grid ${idx + 1}`} className="w-full h-32 object-cover bg-dark-bg" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 bg-black/50">
                      <button
                        onClick={() => { stageImage({ id: `brand_grid_${idx}`, title: `ID Grid ${idx + 1}`, url, thumbnail: url, source: 'Brand Kit' }); navigate('/canvas'); }}
                        className="w-7 h-7 rounded bg-accent text-black flex items-center justify-center" title="Use as reference"
                      ><Plus className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleRemoveGridSlot(idx)} className="w-7 h-7 rounded bg-red-600 text-white flex items-center justify-center" title="Remove"><Trash2 className="h-3 w-3" /></button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                      <p className="text-xs text-white truncate">{gridPrompts[idx] || `Slot ${idx + 1}`}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 space-y-1.5">
                    <input
                      value={gridPrompts[idx] || ''}
                      onChange={e => { const p = [...gridPrompts]; p[idx] = e.target.value; setGridPrompts(p); }}
                      placeholder={ANGLE_PROMPTS[idx] || `Angle ${idx + 1}`}
                      className="w-full px-2 h-7 bg-dark-bg border border-dark-border rounded text-xs text-dark-text focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleGenerateGridSlot(idx)}
                        disabled={gridGenerating[idx] || !gridPrompts[idx]?.trim()}
                        className="flex-1 h-7 text-xs rounded bg-dark-border text-dark-text hover:bg-gray-200 flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {gridGenerating[idx] ? <Loader className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Generate
                      </button>
                      <input ref={gridUploadRefs.current[idx]} type="file" accept="image/*" className="hidden" onChange={e => handleUploadGridSlot(e, idx)} />
                      <button onClick={() => gridUploadRefs.current[idx]?.current?.click()} className="flex-1 h-7 text-xs rounded bg-dark-border text-dark-text hover:bg-gray-200 flex items-center justify-center gap-1">
                        <Upload className="h-3 w-3" /> Upload
                      </button>
                      <button onClick={() => openPicker(idx)} className="flex-1 h-7 text-xs rounded bg-dark-border text-dark-text hover:bg-gray-200 flex items-center justify-center gap-1">
                        My Files
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My Files Picker Modal */}
      {pickerOpen !== false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPickerOpen(false)}>
          <div className="bg-dark-surface border border-dark-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
              <h3 className="text-base font-semibold text-dark-text">My Files</h3>
              <button onClick={() => setPickerOpen(false)} className="text-dark-text-secondary hover:text-dark-text text-xl leading-none">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {pickerLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader className="h-6 w-6 animate-spin text-accent" />
                </div>
              ) : pickerFiles.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-dark-text-secondary text-sm">No images found</div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {pickerFiles.map((file, i) => (
                    <button
                      key={file.url || i}
                      onClick={() => handlePickerSelect(file)}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-dark-border hover:border-accent transition-colors bg-dark-bg"
                    >
                      <img src={file.url || file.thumbnail} alt={file.name || ''} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandAssetsPage;


