import React, { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, Film, ImageIcon as ImagesIcon, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { searchImages, generateImages, remixImages, uploadImages, generateVideo } from '../services/api';

const BottomActionBar = () => {
  const { 
    stagedImages,
    setLoading, 
    addRow, 
    clearStagedImages,
    unstageImage,
    generationSettings,
    outputMode,
    setOutputMode,
    isLoading
  } = useStore();
  
  const [prompt, setPrompt] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(true);
  const fileInputRef = React.useRef(null);

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading('upload', true);
    addRow({ type: 'upload', title: 'UPLOADED IMAGES', images: [], loading: true });
    try {
      const { results } = await uploadImages(files);
      const state = useStore.getState();
      const lastRow = state.rows[state.rows.length - 1];
      if (lastRow && lastRow.type === 'upload' && lastRow.loading) {
        state.updateRow(lastRow.id, { images: results, loading: false });
      } else {
        addRow({ type: 'upload', title: 'UPLOADED IMAGES', images: results });
      }
    } catch (err) {
      try {
        const state = useStore.getState();
        const lastRow = state.rows[state.rows.length - 1];
        if (lastRow && lastRow.type === 'upload' && lastRow.loading) {
          state.updateRow(lastRow.id, { loading: false, error: 'Upload failed' });
        }
      } catch (_) {}
    } finally {
      setLoading('upload', false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const handleSearch = async () => {
    if (!prompt.trim()) return;
    setLoading('search', true);
    try {
      const results = await searchImages(prompt, 1, 10, 'creative_commons');
      addRow({ type: 'search', title: `SEARCH: ${prompt}`, images: results.results, query: prompt, licenseInfo: results.licenseInfo });
      setPrompt('');
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading('search', false);
    }
  };
  
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading('generate', true);
    try {
      const totalCount = Number(generationSettings.imageCount) || 1;

      // If only one image requested, use the simple path
      if (totalCount <= 1) {
        const results = await generateImages(prompt, generationSettings.style, 1, generationSettings.aspectRatio);
        addRow({ type: 'generate', title: `GENERATE: ${prompt}`, images: results.results, prompt, generation: { purpose: generationSettings.style, imageCount: 1 } });
        setPrompt('');
        return;
      }

      // For multiple images, create a row and stream results in as they arrive
      addRow({ type: 'generate', title: `GENERATE (${totalCount}): ${prompt}`, images: [], prompt, generation: { purpose: generationSettings.style, imageCount: totalCount }, loading: true });

      const stateAtStart = useStore.getState();
      const rowAtStart = stateAtStart.rows[stateAtStart.rows.length - 1];
      const targetRowId = rowAtStart?.id;

      let completed = 0;
      const tasks = Array.from({ length: totalCount }, async () => {
        try {
          const res = await generateImages(prompt, generationSettings.style, 1, generationSettings.aspectRatio);
          const img = (res?.results || [])[0];
          if (!img) return;
          const state = useStore.getState();
          const currentRow = state.getRowById(targetRowId);
          const currentImages = Array.isArray(currentRow?.images) ? currentRow.images : [];
          state.updateRow(targetRowId, { images: [...currentImages, img] });
        } catch (e) {
          // Ignore individual failures to allow others to continue
        } finally {
          completed += 1;
          if (completed >= totalCount) {
            const state = useStore.getState();
            state.updateRow(targetRowId, { loading: false });
          }
        }
      });

      await Promise.allSettled(tasks);
      setPrompt('');
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setLoading('generate', false);
    }
  };
  
  const handleRemix = async () => {
    if (!prompt.trim() || stagedImages.length === 0) {
      alert('Stage at least one image and add a prompt to remix.');
      return;
    }
    setLoading('remix', true);
    try {
      const results = await remixImages(prompt, stagedImages, generationSettings.style, generationSettings.aspectRatio);
      addRow({ type: 'remix', title: `REMIX: ${prompt}`, images: [results.result], prompt, generation: { purpose: generationSettings.style }, sourceImages: stagedImages });
      setPrompt('');
      clearStagedImages();
    } catch (error) {
      console.error('Remix failed:', error);
      alert(error.message);
    } finally {
      setLoading('remix', false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) return;
    setLoading('generate', true);
    try {
      // Map aspect ratio to Veo-supported options
      const aspect = generationSettings.aspectRatio === '9:16' ? '9:16' : '16:9';
      // Use first staged image as a reference for image-to-video when available
      const imageUrl = stagedImages.length > 0 ? stagedImages[0].url : undefined;

      const res = await generateVideo({
        prompt,
        aspectRatio: aspect,
        resolution: aspect === '16:9' ? '1080p' : '720p',
        imageUrl
      });
      // Append to workspace as a video row
      const url = res?.url;
      if (url) {
        addRow({
          type: 'video',
          title: `VIDEO: ${prompt}`,
          images: [{
            id: `video_${Date.now()}`,
            title: `Video: ${prompt}`,
            url,
            source: 'AI Generated (Veo 3)',
            mediaType: 'video'
          }]
        });
        // Also open in new tab as a fallback UX
        try { window.open(url, '_blank'); } catch (_) {}
      }
      setPrompt('');
    } catch (error) {
      console.error('Video generation failed:', error);
      alert(error.message || 'Video generation failed');
    } finally {
      setLoading('generate', false);
    }
  };

  const handleCreate = async () => {
    if (isSearchMode) {
      await handleSearch();
      return;
    }
    if (outputMode === 'video') {
      await handleGenerateVideo();
      return;
    }
    if (stagedImages.length === 0) {
      await handleGenerate();
    } else {
      await handleRemix();
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    handleCreate();
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-dark-surface border-t border-dark-border z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          {/* Refs chip */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-2 rounded-lg bg-dark-border text-dark-text flex items-center gap-2">
              <ImagesIcon className="h-4 w-4" />
              <span className="text-sm">Refs: {stagedImages.length}</span>
              {stagedImages.length > 0 && (
                <button onClick={clearStagedImages} className="ml-1 text-dark-text hover:text-red-500" title="Clear references">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Mode Toggle Buttons */}
          <>
            <button
              onClick={() => setIsSearchMode(true)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isSearchMode ? 'bg-accent text-black' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`}
            >
              Search
            </button>
            <>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple ref={fileInputRef} onChange={handleFilesSelected} className="hidden" />
              <button onClick={handleUploadClick} className="px-4 py-2 rounded-lg font-medium transition-colors bg-dark-border text-dark-text hover:bg-gray-200">Upload</button>
            </>
            <button
              onClick={() => setIsSearchMode(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${!isSearchMode ? 'bg-accent text-black' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`}
            >
              Create
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => setOutputMode('image')} className={`px-3 py-2 rounded-lg ${outputMode==='image' ? 'bg-purple-600 text-white' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`}><ImageIcon className="h-4 w-4" /></button>
              <button onClick={() => setOutputMode('video')} className={`px-3 py-2 rounded-lg ${outputMode==='video' ? 'bg-purple-600 text-white' : 'bg-dark-border text-dark-text hover:bg-gray-200'}`}><Film className="h-4 w-4" /></button>
            </div>
          </>
          
          {/* Prompt Input */}
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                isSearchMode ? 'Search for images...' :
                outputMode === 'video' ? 'Describe the video...' :
                (stagedImages.length === 0 ? 'Describe an image to create...' : 'Describe how to remix the referenced images...')
              }
              className="flex-1 px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {(() => {
              const searchProcessing = isSearchMode && isLoading.search;
              const createProcessing = !isSearchMode && (isLoading.generate || isLoading.remix);
              const isProcessing = searchProcessing || createProcessing;
              
              return (
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${isProcessing ? 'bg-accent/60 cursor-not-allowed' : 'bg-accent hover:bg-accent-hover'} text-black flex items-center gap-2`}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSearchMode ? (searchProcessing ? 'Searching…' : 'Search') : (createProcessing ? 'Processing…' : 'Create')}
                </button>
              );
            })()}
          </form>
        </div>
      </div>
    </div>
  );
};

export default BottomActionBar;