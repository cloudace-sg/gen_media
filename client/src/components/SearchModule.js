import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { searchImages } from '../services/api';

const SearchModule = () => {
  const [query, setQuery] = useState('');
  const { addRow, setLoading, isLoading } = useStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || isLoading.search) return;

    setLoading('search', true);
    
    try {
      const response = await searchImages(query);
      
      addRow({
        type: 'search',
        title: `Search: ${query}`,
        query,
        images: response.results,
        timestamp: new Date().toISOString()
      });
      
      setQuery('');
    } catch (error) {
      console.error('Search failed:', error);
      // TODO: Add error notification
    } finally {
      setLoading('search', false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center space-x-2 mb-4">
        <Search className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">Image Search</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for images..."
            className="input-field w-full"
            disabled={isLoading.search}
          />
        </div>
        
        <button
          type="submit"
          disabled={!query.trim() || isLoading.search}
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          {isLoading.search ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              <span>Search Images</span>
            </>
          )}
        </button>
      </form>
      
      <div className="mt-4 text-sm text-dark-text-secondary">
        <p>Search for images using Google Custom Search API</p>
      </div>
    </div>
  );
};

export default SearchModule;
