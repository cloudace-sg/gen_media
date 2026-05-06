import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateImages } from '../services/api';

const GenerateModule = () => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('photorealistic');
  const { addRow, setLoading, isLoading } = useStore();

  const styles = [
    { value: 'photorealistic', label: 'Photorealistic' },
    { value: 'artistic', label: 'Artistic' },
    { value: 'cartoon', label: 'Cartoon' },
    { value: 'anime', label: 'Anime' },
    { value: 'cyberpunk', label: 'Cyberpunk' },
    { value: 'vintage', label: 'Vintage' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading.generate) return;

    setLoading('generate', true);
    
    try {
      const response = await generateImages(prompt, style);
      
      addRow({
        type: 'generate',
        title: `Generate: ${prompt}`,
        prompt,
        style,
        images: response.results,
        timestamp: new Date().toISOString()
      });
      
      setPrompt('');
    } catch (error) {
      console.error('Generation failed:', error);
      // TODO: Add error notification
    } finally {
      setLoading('generate', false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center space-x-2 mb-4">
        <Sparkles className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">AI Generation</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            className="input-field w-full h-20 resize-none"
            disabled={isLoading.generate}
          />
        </div>
        
        <div>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="input-field w-full"
            disabled={isLoading.generate}
          >
            {styles.map((styleOption) => (
              <option key={styleOption.value} value={styleOption.value}>
                {styleOption.label}
              </option>
            ))}
          </select>
        </div>
        
        <button
          type="submit"
          disabled={!prompt.trim() || isLoading.generate}
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          {isLoading.generate ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Generate Image</span>
            </>
          )}
        </button>
      </form>
      
      <div className="mt-4 text-sm text-dark-text-secondary">
        <p>Generate images using AI text-to-image models</p>
      </div>
    </div>
  );
};

export default GenerateModule;
