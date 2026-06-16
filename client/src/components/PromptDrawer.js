import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Image as ImageIcon, Film, X, Upload as UploadIcon, Loader2, Lightbulb, ChevronLeft, ChevronRight, HelpCircle, ChevronDown, Target, Megaphone, FileText, Users, Globe, Camera, Video, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { searchImages, searchVideos, generateImages, remixImages, uploadImages, generateVideo, improvePrompt, randomPrompt, listStyles } from '../services/api';
import { Wand2 } from 'lucide-react';

// Custom dropdown component for purpose selection
const PurposeDropdown = ({ value, onChange, options, placeholder = "Select purpose..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.flatMap(group => group.options).find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 rounded-lg bg-dark-bg border border-dark-border text-dark-text hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {selectedOption?.icon && <selectedOption.icon className="w-4 h-4 text-accent" />}
          <span className="text-sm font-medium">{selectedOption?.label || placeholder}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-dark-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {options.map((group, groupIndex) => (
            <div key={groupIndex}>
              <div className="px-3 py-2 text-xs font-semibold text-accent uppercase tracking-wide border-b border-dark-border">
                {group.label}
              </div>
              {group.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left hover:bg-dark-bg transition-colors duration-150 flex items-center gap-3 ${
                    value === option.value ? 'bg-accent/10 text-accent' : 'text-dark-text'
                  }`}
                >
                  {option.icon && <option.icon className="w-4 h-4 text-dark-text-secondary" />}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-dark-text-secondary mt-0.5">{option.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PromptDrawer = () => {
  const {
    stagedImages,
    clearStagedImages,
    generationSettings,
    setGenerationImageCount,
    setGenerationStyle,
    setGenerationAspectRatio,
    setStyleId,
    videoSettings,
    setVideoPurpose,
    setVideoAspectRatio,
    setVideoResolution,
    setVideoStyleId,
    outputMode,
    setOutputMode,
    isLoading,
    setLoading,
    addRow
  } = useStore();

  const [prompt, setPrompt] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(true);
  const fileInputRef = useRef(null);
  const textRef = useRef(null);
  const [showExamples, setShowExamples] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [improved, setImproved] = useState(null); // { improvedPrompt, negativePrompt, rationale }
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [styles, setStyles] = useState([{ id: 'freeform', label: 'Freeform', description: 'No preset' }]);
  useEffect(() => {
    (async () => {
      try { const items = await listStyles(); if (items?.length) setStyles(items); } catch (_) {}
    })();
  }, []);

  // Example prompts per purpose
  const IMAGE_EXAMPLES_BASE = {
    'Product-Focused Advertisement': [
      'Studio product shot of [PRODUCT] on a clean background with soft shadow, key light from front-left, high contrast, minimal styling, brand color accents [COLORS], text-safe area top-right, {{AR}}, photorealistic.',
      'Luxury product shot: [BRAND] [PRODUCT NAME] — bottle shape [SHAPE], label [LABEL DESC], liquid color [COLOR]. Floating on dark water with [FLOWER] in [COLORS] arranged around it; reflections and ripples; lighting: [LIGHTING], {{AR}}, high-end commercial look.',
      'Design a hyperrealistic cinematic poster featuring [PRODUCT] as centerpiece on a sleek pedestal; atmospheric lighting with cool blues and warm gold highlights; shallow depth of field; premium textures; add brand name + tagline; {{AR}}.'
    ],
    'Campaign Key Visual': [
      'A bold, high-resolution hero shot of [PRODUCT/SERVICE] surrounded by symbolic elements (e.g., glowing digital patterns, fresh produce, shopping bags). Background: dynamic gradient or brand colors. Leave clean space for campaign tagline & CTA. {{AR}}.',
      'Striking product centerpiece framed by thematic icons/particles; dramatic lighting, premium finish; negative space reserved for headline. {{AR}}.',
      'Modern brand-forward composition: large product silhouette + abstract particles; minimal layout with top-right message space; subtle brand palette accents. {{AR}}.'
    ],
    'Event Poster / Collateral': [
      'High-impact promotional image featuring [GROUP/VENUE SCENE] engaging with [EVENT/PRODUCT/SERVICE] in a relevant setting (expo hall / conference lounge / networking area). Reserve space for Event Title, Date, CTA. {{AR}}.',
      'Cinematic event moment: audience engagement around [PRODUCT/SERVICE], ambient lighting, shallow depth; clear area for title block overlay. {{AR}}.',
      'Keynote/booth hero: presenter on stage or booth with visitors; modern gradient overlay; copy-safe region for date & location. {{AR}}.'
    ],
    'Social Media Campaign Creative': [
      'Vibrant, eye-catching image of [TARGET PERSONA] interacting with [PRODUCT/SERVICE] in a relatable setting (coffee shop, co-working space, city street). Include small text overlay for campaign hashtag or CTA. Style: influencer/UGC. {{AR}}.',
      'Lifestyle snapshot with playful motion blur and colorful pop accents; joyful energy; compact area for short tag/hashtag. {{AR}}.',
      'Casual handheld composition, natural light, authentic expressions; subtle brand color accents; room for a minimal CTA sticker. {{AR}}.'
    ],
    'Social Media Lifestyle Post': [
      'Candid lifestyle shot: a real person using [PRODUCT] outdoors at golden hour, warm natural light, shallow depth of field, casual urban setting, subtle brand accents in outfit/props, {{AR}}.',
      'Over-the-shoulder shot of [TARGET USER] using [PRODUCT] in a cozy indoor setting; soft window light; authentic, unposed vibe; room for caption space; {{AR}}.',
      'Dynamic action moment with [PRODUCT] in use, slight motion blur for energy, bold color accents from brand palette [COLORS], contemporary editorial feel, {{AR}}.'
    ],
    'Website Hero Image': [
      'Wide hero background with [PRODUCT] on a sleek surface; dramatic rim lighting; subtle gradient backdrop in brand palette [COLORS]; generous negative space on left for headline and CTA; {{AR}}.',
      'Editorial-style hero with abstract shapes in brand colors framing [PRODUCT]; glossy reflections; minimal, premium aesthetic; place-safe area for copy; {{AR}}.',
      'Clean architectural backdrop with strong perspective lines drawing attention to [PRODUCT]; soft haze; professional banner-ready composition; {{AR}}.'
    ]
  };

  // Refinement-focused prompts when edited images are staged
  const IMAGE_EXAMPLES_REFINEMENT = {
    'Product-Focused Advertisement': [
      'Refine and enhance the staged image while preserving composition. Improve lighting and contrast, clean edges, balance colors to match [COLORS], subtle gradients, crisp reflections; keep product geometry; {{AR}}.',
      'Polish this layout: even out exposure, reduce noise, sharpen key details, tidy backgrounds, ensure text-safe area remains clean, premium commercial finish; {{AR}}.',
      'Upgrade to production quality: realistic materials, soft shadows, micro-contrast on edges, gentle bloom on highlights, no artifacts or warping; {{AR}}.'
    ],
    'Social Media Lifestyle Post': [
      'Refine the staged shot: adjust white balance and skin tones, soften harsh shadows, keep candid mood, add gentle color grading, retain framing and subject; {{AR}}.',
      'Clean up distractions, smooth noise, keep authentic vibe; enhance clarity and depth, maintain brand accents [COLORS]; {{AR}}.',
      'Subtle polish pass: tone mapping, local contrast, sharpen eyes/hair/details if present, avoid over-processing; {{AR}}.'
    ],
    'Website Hero Image': [
      'Refine hero image for web: normalize lighting, improve readability, ensure generous negative space for headline, subtle vignette, cohesive palette [COLORS]; {{AR}}.',
      'Polish edges and gradients, reduce banding, clean surfaces, upscale for crispness without artifacts; keep composition intact; {{AR}}.',
      'Production-ready finishing: tidy reflections, unify shadows, correct perspective distortion if any, export-ready quality; {{AR}}.'
    ]
  };

  const VIDEO_EXAMPLES = {
    'Quick Social Media Ad': [
      'Up to {{LENGTH}} {{AR}} {{RES}} ad of [PRODUCT] unboxing → quick use; 2–3 punchy cuts, upbeat pacing, bright natural light, overlay space for headline, subtle brand framing.',
      'Fast-cut demo: [PRODUCT] solving a small pain point in everyday life; close-up details → reveal; energetic motion, bold captions space, {{AR}} {{RES}}, up to {{LENGTH}}.',
      'Handheld POV trying [PRODUCT] for the first time, authentic reactions; warm tones, light background music feel, end-card with product and CTA; {{AR}} {{RES}}, max {{LENGTH}}.'
    ],
    'Product Launch Teaser Video': [
      'Fast-paced teaser: close-up macro details, quick cuts + dramatic zooms, abstract light streaks; end on hero shot with clear CTA. {{AR}} {{RES}}, max {{LENGTH}}.',
      'Dynamic rotating reveal of [PRODUCT]; split-second cuts; energetic, futuristic mood; final frame: logo + tagline. {{AR}} {{RES}}, up to {{LENGTH}}.',
      'Macro textures → silhouette reveal → hero lock-up; premium finish; sound synced beats. {{AR}} {{RES}}, {{LENGTH}}.'
    ],
    'Social Ad (Short-Form Video)': [
      'Split-screen or quick-cut montage: before-and-after scenarios with [PRODUCT/SERVICE]; hero close-up + bold CTA at end. Style: vibrant, fast, TikTok/IG-ready. Audio: trending pop beat. {{AR}} {{RES}}, {{LENGTH}}.',
      'Lifestyle POV + handheld moments + bold text beats; playful transitions; end frame with CTA and logo. {{AR}} {{RES}}, max {{LENGTH}}.',
      'Overhead top-down shots with quick transitions and modern captions; logo stinger outro. {{AR}} {{RES}}, up to {{LENGTH}}.'
    ],
    'Brand Storytelling Clip': [
      'Narrative: [TARGET USER] struggles with [PROBLEM] → discovers [PRODUCT] → resolution; warm tone, close-ups + medium shots; end frame centers product and CTA; {{AR}} {{RES}}, up to {{LENGTH}}.',
      'Cinematic micro-story: establishing shot → conflict moment → solution using [PRODUCT]; atmospheric lighting, subtle lens flares; branded outro; {{AR}} {{RES}}, max {{LENGTH}}.',
      'Before/after sequence: quick contrast of life without vs with [PRODUCT]; clear benefits overlay; emotional yet concise; {{AR}} {{RES}}, up to {{LENGTH}}.'
    ]
  };

  const LENGTH_LIMIT = '8 seconds';

  const formatExample = (tpl) => {
    const ar = outputMode === 'video' ? videoSettings.aspectRatio : generationSettings.aspectRatio;
    const res = outputMode === 'video' ? videoSettings.resolution : '';
    return tpl
      .replaceAll('{{AR}}', ar)
      .replaceAll('{{RES}}', res)
      .replaceAll('{{LENGTH}}', LENGTH_LIMIT);
  };

  const getCurrentExamples = () => {
    if (outputMode === 'video') {
      const arr = VIDEO_EXAMPLES[videoSettings.purpose] || [];
      return arr.length ? arr : Object.values(VIDEO_EXAMPLES)[0] || [];
    }
    // If any staged image is an edited image (source === 'Edited' or data URL), switch to refinement prompts
    const hasEditedContext = stagedImages.some((img) => img.source === 'Edited' || (typeof img.url === 'string' && img.url.startsWith('data:')));
    const source = hasEditedContext ? IMAGE_EXAMPLES_REFINEMENT : IMAGE_EXAMPLES_BASE;
    const arr = source[generationSettings.style] || [];
    return arr.length ? arr : Object.values(source)[0] || [];
  };

  // Reset example index when mode/purpose/style changes
  useEffect(() => {
    setExampleIndex(0);
  }, [outputMode, videoSettings.purpose, generationSettings.style]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.5) + 'px';
  }, [prompt]);

  const handleUploadClick = () => fileInputRef.current && fileInputRef.current.click();

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading('upload', true);
    addRow({ type: 'upload', title: 'UPLOADS', images: [], loading: true });
    try {
      const { results } = await uploadImages(files);
      const state = useStore.getState();
      const lastRow = state.rows[state.rows.length - 1];
      if (lastRow && lastRow.type === 'upload' && lastRow.loading) {
        state.updateRow(lastRow.id, { images: results, loading: false });
      } else {
        addRow({ type: 'upload', title: 'UPLOADS', images: results });
      }
    } finally {
      setLoading('upload', false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSearch = async () => {
    if (!prompt.trim()) return;
    setLoading('search', true);
    setErrorMsg('');
    try {
      let results;
      if (outputMode === 'video') {
        results = await searchVideos(prompt, 1, 30);
        addRow({ type: 'search', title: 'VIDEO SEARCH', images: results.results, query: prompt, licenseInfo: results.licenseInfo });
      } else {
        results = await searchImages(prompt, 1, 30, 'creative_commons');
        addRow({ type: 'search', title: 'SEARCH', images: results.results, query: prompt, licenseInfo: results.licenseInfo });
      }
      setPrompt('');
    } catch (error) {
      console.error('Search failed:', error);
      setErrorMsg(error.message || 'Search failed. Check that image search API keys are configured.');
    } finally { setLoading('search', false); }
  };

  // Unified generate handler — uses staged references when present (calls POST /generate with refs)
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading('generate', true);
    setErrorMsg('');
    try {
      const totalCount = Number(generationSettings.imageCount) || 1;
      const refs = stagedImages.map(img => ({ id: img.id, url: img.url, title: img.title, mediaType: img.mediaType }));
      const res = await generateImages(prompt, generationSettings.style, totalCount, generationSettings.aspectRatio, generationSettings.styleId, refs);
      const images = Array.isArray(res.results) && res.results.length > 0 ? res.results : [res.result].filter(Boolean);
      const hasRefs = refs.length > 0;
      addRow({
        type: hasRefs ? 'remix' : 'generate',
        title: hasRefs ? `GENERATE WITH REFS${totalCount > 1 ? ` (${totalCount})` : ''}` : `GENERATE${totalCount > 1 ? ` (${totalCount})` : ''}`,
        images,
        prompt,
        generation: { purpose: generationSettings.style, imageCount: totalCount },
        ...(hasRefs ? { sourceImages: stagedImages } : {})
      });
      setPrompt('');
      if (hasRefs) clearStagedImages();
    } catch (error) {
      console.error('Generation failed:', error);
      setErrorMsg(error.message || 'Generation failed. Please try again.');
    } finally {
      setLoading('generate', false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) return;
    setLoading('generate', true);
    setErrorMsg('');
    try {
      let imageUrl;
      let videoUrl;
      let referenceImageUrls;
      if (stagedImages.length > 0) {
        const imageRefs = stagedImages.filter(r => r.mediaType !== 'video');
        // Veo scene extension only accepts Veo-generated videos — filter by source
        const videoRefs = stagedImages.filter(r => r.mediaType === 'video' && r.source === 'AI Generated (Veo 3)');
        // Always use image refs as style/character references, not as Veo start frame
        if (imageRefs.length > 0) {
          referenceImageUrls = imageRefs.slice(0, 3).map(r => r.url);
        }
        // Pass video ref only when no image refs
        if (videoRefs.length > 0 && !imageUrl && !referenceImageUrls) {
          videoUrl = videoRefs[0].url;
        }
      }
      const res = await generateVideo({
        prompt,
        negativePrompt: negativePrompt || undefined,
        aspectRatio: videoSettings.aspectRatio,
        resolution: videoSettings.resolution,
        imageUrl,
        videoUrl,
        referenceImageUrls,
        styleId: videoSettings.styleId
      });
      const url = res?.url;
      if (url) {
        const row = { type: 'video', title: 'VIDEO', images: [{ id: `video_${Date.now()}`, title: `Video: ${prompt}`, url, source: 'AI Generated (Veo 3)', mediaType: 'video' }], prompt };
        if (res.warning) row.warning = res.warning;
        addRow(row);
      }
      setPrompt('');
    } catch (error) {
      console.error('Video generation failed:', error);
      setErrorMsg(error.message || 'Video generation failed. Please try again.');
    } finally { setLoading('generate', false); }
  };

  const handleCreate = async () => {
    if (isSearchMode) return handleSearch();
    if (outputMode === 'video') return handleGenerateVideo();
    return handleGenerate(); // handles both with and without refs via POST /generate
  };

  return (
    <aside className={`fixed top-0 left-14 bottom-0 w-[380px] border-r border-dark-border bg-dark-surface z-30 flex flex-col`}>
      <div className="p-3 pt-4 border-b border-dark-border flex items-center justify-between">
        <div className="text-xl font-semibold text-dark-text">Creative Controls</div>
        <Link to="/help#creative-controls" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline" title="Open docs">
          <HelpCircle className="h-3 w-3" />
          Help
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 pb-4 space-y-4">
        {/* Mode + upload + output type */}
        <div className="flex justify-between items-start">
          {/* Left side: Search + Upload on top, Create below */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSearchMode(true)} className={`px-4 h-10 rounded-md text-sm ${isSearchMode ? 'bg-accent text-black' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`}>Search</button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={handleFilesSelected} className="hidden" />
              <button onClick={handleUploadClick} className="px-4 h-10 rounded-lg bg-dark-border text-dark-text hover:bg-gray-200 flex items-center gap-2 text-sm"><UploadIcon className="w-5 h-5" /><span>Upload</span></button>
            </div>
            <button onClick={() => setIsSearchMode(false)} className={`px-4 h-10 rounded-md text-sm w-fit ${!isSearchMode ? 'bg-accent text-black' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`}>Create</button>
          </div>

          {/* Right side: Refs chip on top, Image/Video toggle below */}
          <div className="flex flex-col gap-3 items-end">
            <div className="px-4 py-2 rounded-lg bg-dark-border flex items-center gap-2 text-dark-text">
              <ImageIcon className="h-5 w-5" />
              <span className="text-sm">Refs: {stagedImages.length}</span>
              {stagedImages.length > 0 && (
                <button onClick={clearStagedImages} className="ml-1 text-dark-text hover:text-red-500" title="Clear references"><X className="h-5 w-5" /></button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setOutputMode('image')} className={`h-10 w-10 rounded-md ${outputMode==='image' ? 'bg-purple-600 text-white' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`} title="Image"><ImageIcon className="w-5 h-5 mx-auto"/></button>
              <button onClick={() => setOutputMode('video')} className={`h-10 w-10 rounded-md ${outputMode==='video' ? 'bg-purple-600 text-white' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`} title="Video"><Film className="w-5 h-5 mx-auto"/></button>
            </div>
          </div>
        </div>

        {/* Prompt composer */}
        <div className="space-y-2">
          <label className="text-xs text-dark-text-secondary">Prompt</label>
          <textarea
            ref={textRef}
            rows={6}
            value={prompt}
            onChange={(e)=>setPrompt(e.target.value)}
            placeholder={isSearchMode ? (outputMode==='video' ? 'Search for videos...' : 'Search for images...') : (outputMode==='video' ? 'Describe the video...' : (stagedImages.length===0 ? 'Describe an image to create...' : 'Describe how to remix the referenced images...'))}
            className="w-full resize-none p-3 rounded bg-dark-bg border border-dark-border text-dark-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent font-mono"
          />
          <div className="flex items-center gap-2">
            {!isSearchMode && (
              <>
                <button
                  type="button"
                  disabled={isRandomizing}
                  onClick={async ()=>{
                    setIsRandomizing(true);
                    try {
                      const res = await randomPrompt({
                        mode: outputMode,
                        style: outputMode==='video' ? videoSettings.purpose : generationSettings.style,
                        aspectRatio: outputMode==='video' ? videoSettings.aspectRatio : generationSettings.aspectRatio,
                        resolution: outputMode==='video' ? videoSettings.resolution : undefined,
                        brandKit: useStore.getState().brandAssets,
                        styleId: outputMode==='video' ? videoSettings.styleId : generationSettings.styleId
                      });
                      if (res?.prompt) setPrompt(res.prompt);
                    } catch (err) {
                      console.error('Random prompt failed:', err);
                      alert('Failed to get random prompt. Please try again.');
                    } finally {
                      setIsRandomizing(false);
                    }
                  }}
                  className={`flex-1 h-10 px-4 rounded-lg text-sm font-medium ${isRandomizing ? 'bg-accent/60 cursor-not-allowed text-black' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`}
                >{isRandomizing ? 'Random…' : 'Random'}</button>
                <button type="button" disabled={!prompt.trim() || isImproving} onClick={async ()=>{
                  if (!prompt.trim()) return;
                  setIsImproving(true);
                  try {
                    const res = await improvePrompt({
                      prompt,
                      mode: outputMode,
                      style: generationSettings.style,
                      aspectRatio: outputMode==='video' ? videoSettings.aspectRatio : generationSettings.aspectRatio,
                      resolution: outputMode==='video' ? videoSettings.resolution : undefined,
                      stagedImages,
                      brandKit: useStore.getState().brandAssets,
                      styleId: outputMode==='video' ? videoSettings.styleId : generationSettings.styleId
                    });
                    if (res && (res.improvedPrompt || res.negativePrompt || res.rationale)) {
                      setImproved({
                        improvedPrompt: res.improvedPrompt || '',
                        negativePrompt: res.negativePrompt || '',
                        rationale: Array.isArray(res.rationale) ? res.rationale : []
                      });
                      if (res.negativePrompt) setNegativePrompt(res.negativePrompt);
                    }
                  } finally {
                    setIsImproving(false);
                  }
                }} className={`flex-1 h-10 px-4 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 ${isImproving ? 'bg-accent/60 cursor-not-allowed text-black' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`} title="Improve with context">
                  {isImproving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  <span>{isImproving ? 'Improving…' : 'Improve'}</span>
                </button>
                <button type="button" onClick={()=>{ setPrompt(''); setImproved(null); }} className="flex-1 h-10 px-4 rounded-lg text-sm font-medium bg-dark-border text-dark-text hover:bg-gray-200">Clear</button>
              </>
            )}
          </div>

          {/* Negative prompt field (optional, used for video and future image support) */}
          <div className="space-y-1">
            <label className="text-xs text-dark-text-secondary">Negative prompt (what to avoid)</label>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e)=>setNegativePrompt(e.target.value)}
              placeholder="e.g., blurry, distorted text, low quality"
              className="w-full p-2 rounded bg-dark-bg border border-dark-border text-dark-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Improved suggestion preview (YAML-like) */}
          {improved && (
            <div className="mt-2 bg-dark-bg border border-dark-border rounded-lg">
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-dark-text">
                <Lightbulb className="w-4 h-4 text-accent" />
                <span>Improved suggestion</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={()=>{ setPrompt(improved.improvedPrompt || ''); if (improved.negativePrompt) setNegativePrompt(improved.negativePrompt); }}
                    className="px-2 h-8 rounded bg-accent text-black text-xs hover:bg-accent-hover"
                  >Replace</button>
                  <button
                    type="button"
                    onClick={()=>{ setPrompt((p)=> (p ? (p + (p.endsWith(' ') ? '' : ' ') + (improved.improvedPrompt || '')) : (improved.improvedPrompt || ''))); if (improved.negativePrompt) setNegativePrompt(improved.negativePrompt); }}
                    className="px-2 h-8 rounded bg-dark-border text-dark-text text-xs hover:bg-gray-200"
                  >Append</button>
                  <button
                    type="button"
                    onClick={()=> setImproved(null)}
                    className="px-2 h-8 rounded bg-dark-border text-dark-text text-xs hover:bg-gray-200"
                  >Cancel</button>
                </div>
              </div>
              <div className="p-3 border-t border-dark-border">
                <pre className="text-sm text-dark-text bg-dark-surface border border-dark-border rounded p-3 whitespace-pre-wrap">
{(() => {
  const out = [];
  const addSection = (num, title, body) => {
    if (!body) return;
    out.push(`${num}) ${title}`);
    const text = String(body);
    text.split('\n').forEach((ln) => out.push(`   ${ln}`));
  };
  addSection(1, 'Improved prompt', improved.improvedPrompt || '');
  addSection(2, 'Negative prompt', improved.negativePrompt || '');
  if (Array.isArray(improved.rationale) && improved.rationale.length) {
    out.push('3) Rationale');
    improved.rationale.forEach((r, idx) => out.push(`   3.${idx + 1}) ${r}`));
  }
  return out.join('\n');
})()}
                </pre>
              </div>
            </div>
          )}

          {/* Examples removed in favor of Random button for cleaner UI */}
        </div>

        {/* Generation settings */}
        <div className="border-t border-dark-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-black/70">Generation Settings</div>
            <div className="text-xs px-2 py-1 bg-dark-border rounded text-black/70">{outputMode === 'video' ? 'Video' : 'Image'}</div>
          </div>
          {outputMode === 'image' ? (
            <div className="space-y-4">
              {/* Style picker */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1"><span>Style preset</span></div>
                <PurposeDropdown
                  value={generationSettings.styleId || 'freeform'}
                  onChange={setStyleId}
                  options={(() => {
                    const groups = {};
                    for (const s of styles) {
                      const group = s.category || 'Styles';
                      if (!groups[group]) groups[group] = [];
                      groups[group].push({ value: s.id, label: s.label, description: s.description });
                    }
                    return Object.entries(groups).map(([label, options]) => ({ label, options }));
                  })()}
                />
                {generationSettings.styleId && generationSettings.styleId !== 'freeform' ? (
                  <div className="mt-1 text-xs text-dark-text-secondary">Style preset active. The improver and generator will avoid adding extra quality modifiers.</div>
                ) : null}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Image count</span>
                  <span className="text-black/70">{generationSettings.imageCount}</span>
                </div>
                <input type="range" min={1} max={4} value={generationSettings.imageCount} onChange={(e)=>setGenerationImageCount(e.target.value)} className="w-full accent-black" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1"><span>Output purpose</span></div>
                <PurposeDropdown
                  value={generationSettings.style}
                  onChange={setGenerationStyle}
                  options={[
                    {
                      label: "Product Collateral",
                      options: [
                        {
                          value: "Product-Focused Advertisement",
                          label: "Product-Focused Advertisement",
                          description: "Studio shots, product showcases",
                          icon: Target
                        },
                        {
                          value: "Social Media Lifestyle Post",
                          label: "Social Media Lifestyle Post", 
                          description: "Candid, authentic moments",
                          icon: Users
                        },
                        {
                          value: "Website Hero Image",
                          label: "Website Hero Image",
                          description: "Banner backgrounds, headers",
                          icon: Globe
                        }
                      ]
                    },
                    {
                      label: "Marketing Visual",
                      options: [
                        {
                          value: "Campaign Key Visual",
                          label: "Campaign Key Visual",
                          description: "Hero shots, campaign centers",
                          icon: Sparkles
                        },
                        {
                          value: "Event Poster / Collateral",
                          label: "Event Poster / Collateral",
                          description: "Promotional materials, events",
                          icon: FileText
                        },
                        {
                          value: "Social Media Campaign Creative",
                          label: "Social Media Campaign Creative",
                          description: "Campaign-specific content",
                          icon: Megaphone
                        }
                      ]
                    }
                  ]}
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1"><span>Aspect ratio</span></div>
                <PurposeDropdown
                  value={generationSettings.aspectRatio}
                  onChange={setGenerationAspectRatio}
                  options={[
                    {
                      label: "Landscape",
                      options: [
                        { value: "21:9", label: "21:9 (Ultrawide)", description: "Ultra-wide format" },
                        { value: "16:9", label: "16:9 (Widescreen)", description: "Standard widescreen" },
                        { value: "4:3", label: "4:3 (Standard)", description: "Traditional format" },
                        { value: "3:2", label: "3:2 (Classic)", description: "Classic photography" }
                      ]
                    },
                    {
                      label: "Square",
                      options: [
                        { value: "1:1", label: "1:1 (Square)", description: "Perfect square" }
                      ]
                    },
                    {
                      label: "Portrait",
                      options: [
                        { value: "9:16", label: "9:16 (Vertical)", description: "Mobile vertical" },
                        { value: "3:4", label: "3:4 (Portrait)", description: "Traditional portrait" },
                        { value: "2:3", label: "2:3 (Tall)", description: "Tall portrait" }
                      ]
                    },
                    {
                      label: "Flexible",
                      options: [
                        { value: "5:4", label: "5:4 (Slightly Wide)", description: "Slightly wide format" },
                        { value: "4:5", label: "4:5 (Slightly Tall)", description: "Slightly tall format" }
                      ]
                    },
                    {
                      label: "Auto",
                      options: [
                        { value: "auto", label: "Auto (Let AI decide)", description: "AI chooses best ratio" }
                      ]
                    }
                  ]}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Style picker (video) */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1"><span>Style preset</span></div>
                <PurposeDropdown
                  value={videoSettings.styleId || 'freeform'}
                  onChange={setVideoStyleId}
                  options={(() => {
                    const groups = {};
                    for (const s of styles) {
                      const group = s.category || 'Styles';
                      if (!groups[group]) groups[group] = [];
                      groups[group].push({ value: s.id, label: s.label, description: s.description });
                    }
                    return Object.entries(groups).map(([label, options]) => ({ label, options }));
                  })()}
                />
                {videoSettings.styleId && videoSettings.styleId !== 'freeform' ? (
                  <div className="mt-1 text-xs text-dark-text-secondary">Style preset active. The improver and generator will avoid adding extra quality modifiers.</div>
                ) : null}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1"><span>Output purpose</span></div>
                <PurposeDropdown
                  value={videoSettings.purpose}
                  onChange={setVideoPurpose}
                  options={[
                    {
                      label: "Product Collateral",
                      options: [
                        {
                          value: "Quick Social Media Ad",
                          label: "Quick Social Media Ad",
                          description: "Fast-paced product demos",
                          icon: Video
                        },
                        {
                          value: "Brand Storytelling Clip",
                          label: "Brand Storytelling Clip",
                          description: "Narrative, emotional content",
                          icon: Camera
                        }
                      ]
                    },
                    {
                      label: "Marketing Visual",
                      options: [
                        {
                          value: "Product Launch Teaser Video",
                          label: "Product Launch Teaser Video",
                          description: "Exciting launch previews",
                          icon: Sparkles
                        },
                        {
                          value: "Social Ad (Short-Form Video)",
                          label: "Social Ad (Short-Form Video)",
                          description: "TikTok/IG ready content",
                          icon: Megaphone
                        }
                      ]
                    }
                  ]}
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1"><span>Resolution</span></div>
                <PurposeDropdown
                  value={videoSettings.resolution}
                  onChange={(newResolution) => {
                    setVideoResolution(newResolution);
                    // Auto-adjust aspect ratio when resolution changes
                    if (newResolution === '1080p' && videoSettings.aspectRatio === '9:16') {
                      setVideoAspectRatio('16:9');
                    }
                  }}
                  options={[{
                    label: "Video Resolution",
                    options: [
                      { value: "720p", label: "720p", description: "Standard quality" },
                      { value: "1080p", label: "1080p (16:9 only)", description: "High quality, landscape only" }
                    ]
                  }]}
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1"><span>Aspect ratio</span></div>
                <PurposeDropdown
                  value={videoSettings.aspectRatio}
                  onChange={setVideoAspectRatio}
                  options={[{
                    label: "Video Aspect Ratio",
                    options: videoSettings.resolution === '720p' ? [
                      { value: "16:9", label: "16:9 (Widescreen)", description: "Landscape format" },
                      { value: "9:16", label: "9:16 (Vertical)", description: "Portrait format" }
                    ] : [
                      { value: "16:9", label: "16:9 (Widescreen)", description: "Landscape format" }
                    ]
                  }]}
                />
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Fixed Create button at bottom */}
      <div className="p-3 border-t border-dark-border bg-dark-surface">
        {errorMsg && (
          <div className="mb-2 px-3 py-2 bg-red-900/40 border border-red-700/50 rounded-lg text-xs text-red-300 flex items-start gap-2">
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-200 flex-shrink-0">✕</button>
          </div>
        )}
        <button 
          type="button" 
          onClick={handleCreate} 
          disabled={isLoading.search || isLoading.generate || isLoading.remix || isImproving} 
          className={`w-full h-12 rounded-lg text-sm font-medium ${ (isLoading.search||isLoading.generate||isLoading.remix||isImproving) ? 'bg-accent/60 cursor-not-allowed' : 'bg-accent hover:bg-accent-hover'} text-black flex items-center justify-center gap-2`}
        >
          {(isLoading.search||isLoading.generate||isLoading.remix) ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {isSearchMode ? (isLoading.search ? 'Searching…' : 'Search') : ((isLoading.generate||isLoading.remix) ? 'Processing…' : 'Create')}
        </button>
      </div>
    </aside>
  );
};

export default PromptDrawer;


