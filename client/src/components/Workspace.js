import React from 'react';
import { X, Search, Sparkles, Palette, Film } from 'lucide-react';
import { useStore } from '../store/useStore';
import ImageRow from './ImageRow';

const Workspace = () => {
  const { rows, removeRow, stagedImages, stageImage, unstageImage, openImageViewer, brandAssets, isBrandKitComplete, openBrandKitModal } = useStore();
  const hasBrandAssets = (brandAssets?.logos?.length || 0) > 0;
  const brandComplete = isBrandKitComplete();

  const getRowIcon = (type) => {
    switch (type) {
      case 'search':
        return <Search className="h-4 w-4" />;
      case 'generate':
        return <Sparkles className="h-4 w-4" />;
      case 'remix':
        return <Palette className="h-4 w-4" />;
      case 'video':
        return <Film className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getRowColor = (type) => {
    switch (type) {
      case 'search':
        return 'text-blue-400';
      case 'generate':
        return 'text-purple-400';
      case 'remix':
        return 'text-green-400';
      case 'video':
        return 'text-pink-400';
      default:
        return 'text-dark-text-secondary';
    }
  };

  if (rows.length === 0 && !hasBrandAssets) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-dark-surface border border-dark-border rounded-lg mx-auto flex items-center justify-center">
              <Search className="h-10 w-10 text-dark-text-secondary" />
            </div>
          </div>
          <h3 className="text-2xl font-semibold text-dark-text mb-3">
            Your Creative Workspace
          </h3>
          <p className="text-dark-text-secondary text-lg max-w-md mx-auto">
            Use the bottom bar to search for images, generate new ones, or remix existing content
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {!brandComplete && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-yellow-700 dark:text-yellow-600">Improve results by setting up your Brand Kit</div>
              <div className="text-sm text-yellow-600 dark:text-yellow-500">Add your logos, pick colors, and choose a font to guide generation.</div>
            </div>
            <button onClick={openBrandKitModal} className="btn-primary">Set up Brand Kit</button>
          </div>
        )}
        {hasBrandAssets && (
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="text-yellow-400">
                <Palette className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-dark-text">BRAND ASSETS</h3>
              <span className="text-xs text-dark-text-secondary bg-dark-bg px-2 py-1 rounded">
                {(brandAssets.logos?.length || 0) + (brandAssets.styleImages?.length || 0)} images
              </span>
            </div>

            <ImageRow
              images={[
                ...(brandAssets.logos || []).map((url, idx) => ({ id: `brand_logo_${idx}`, title: 'Brand Logo', url, thumbnail: url, source: 'Brand Kit' }))
              ]}
              rowId={'brand_assets'}
              rowType={'brand'}
              onImageClick={(image) => openImageViewer(image, [
                ...(brandAssets.logos || []).map((url, idx) => ({ id: `brand_logo_${idx}`, title: 'Brand Logo', url, thumbnail: url, source: 'Brand Kit' }))
              ])}
              onImageSelect={(image) => {
                const isStaged = stagedImages.some(staged => staged.id === image.id);
                if (isStaged) {
                  unstageImage(image.id);
                } else {
                  stageImage(image);
                }
              }}
              selectedImages={stagedImages}
            />
          </div>
        )}
        {rows.map((row, index) => (
          <div key={row.id} className="bg-dark-surface border border-dark-border rounded-lg p-4">
            {/* Row Header */}
            <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
                <div className={`${getRowColor(row.type)}`}>
                  {getRowIcon(row.type)}
                </div>
                <h3 className="font-semibold text-dark-text">{row.title}</h3>
                <span className="text-xs text-dark-text-secondary bg-dark-bg px-2 py-1 rounded">
                  {(() => {
                    const count = row.images?.length || 0;
                    if (row.type === 'video') return `${count} video${count === 1 ? '' : 's'}`;
                    return `${count} image${count === 1 ? '' : 's'}`;
                  })()}
                </span>
              {row.type === 'upload' && row.loading && (
                <span className="text-xs text-yellow-700 bg-yellow-300/40 px-2 py-1 rounded">
                  Uploading...
                </span>
              )}
              {row.type === 'remix' && row.loading && (
                <span className="text-xs text-blue-700 bg-blue-300/40 px-2 py-1 rounded">
                  Remixing... (this may take up to 2 minutes)
                </span>
              )}
                {row.licenseInfo && (
                  <span className="text-xs text-green-700 bg-green-300/40 px-2 py-1 rounded">
                    {row.licenseInfo}
                  </span>
                )}
              </div>
              
              <button
                onClick={() => removeRow(row.id)}
                className="text-dark-text-secondary hover:text-red-400 transition-colors p-1"
                title="Remove this row"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Image Row */}
            <ImageRow 
              images={row.images || []} 
              rowId={row.id}
              rowType={row.type}
              onImageClick={(image) => openImageViewer(image, row.images || [])}
              onImageSelect={(image, e) => {
                const isStaged = stagedImages.some(staged => staged.id === image.id);
                if (isStaged) {
                  unstageImage(image.id);
                } else {
                  stageImage(image);
                }
              }}
              selectedImages={stagedImages}
            />

            {/* Prompt (truncated) */}
            {row.prompt && (
              <div className="mt-3">
                <TruncatedText text={row.prompt} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Workspace;

// Local helper for truncating long text with disclosure
const TruncatedText = ({ text }) => {
  const [expanded, setExpanded] = React.useState(false);
  if (!text) return null;
  return (
    <div className="text-sm text-dark-text-secondary">
      <div className={expanded ? '' : 'line-clamp-2'}>{text}</div>
      {text.length > 140 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-accent hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};
