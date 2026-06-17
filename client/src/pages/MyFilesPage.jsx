import React from 'react';
import { useNavigate } from 'react-router-dom';
import { listFiles, getSignedUrl, deleteFiles } from '../services/api';
import { useStore } from '../store/useStore';
import PageHeader from '../components/ui/PageHeader';
import { Image as ImageIcon, Video, Trash2, Download, Info, ChevronDown, Plus, ArrowRight } from 'lucide-react';

// Custom dropdown component matching the canvas page style
const TypeDropdown = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 px-3 rounded-lg bg-dark-bg border border-dark-border text-dark-text hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200 flex items-center justify-between min-w-[140px]"
      >
        <span className="text-sm font-medium">{selectedOption?.label || 'All types'}</span>
        <ChevronDown className={`w-4 h-4 text-dark-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-lg z-50">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-border transition-colors duration-150 ${
                value === option.value ? 'bg-accent/20 text-accent' : 'text-dark-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function MyFilesPage() {
  const [items, setItems] = React.useState([]);
  const [nextToken, setNextToken] = React.useState(null);
  const [type, setType] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const [selection, setSelection] = React.useState(new Set());
  const { stageImage, triggerExtend } = useStore();
  const navigate = useNavigate();

  const typeOptions = [
    { value: '', label: 'All types' },
    { value: 'uploads', label: 'Uploads' },
    { value: 'generated_images', label: 'Generated images' },
    { value: 'generated_remix', label: 'Remix images' },
    { value: 'generated_videos', label: 'Videos' },
    { value: 'edits', label: 'Edits' }
  ];

  const load = React.useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await listFiles({ type: type || undefined, limit: 50, pageToken: reset ? undefined : nextToken || undefined });
      if (reset) {
        setItems(res.items || []);
      } else {
        setItems((prev) => [...prev, ...(res.items || [])]);
      }
      setNextToken(res.nextPageToken || null);
    } finally {
      setLoading(false);
    }
  }, [type, nextToken, loading]);

  React.useEffect(() => { load(true); }, [type]);

  const toggleSelect = (key) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleDelete = async () => {
    if (selection.size === 0) return;
    const keys = Array.from(selection);
    await deleteFiles(keys);
    setItems((prev) => prev.filter((it) => !selection.has(it.key)));
    setSelection(new Set());
  };

  const handleUseAsReference = (fileItems) => {
    const toStage = Array.isArray(fileItems) ? fileItems : [fileItems];
    toStage.forEach((it) => {
      const isVideo = String(it.contentType || '').startsWith('video/');
      stageImage({
        id: it.key,
        title: it.key.split('/').pop(),
        url: it.url,
        thumbnail: it.url,
        source: it.type.replace('_', ' '),
        mediaType: isVideo ? 'video' : 'image',
      });
    });
    // Don't auto-navigate — let user stage multiple items then go to canvas manually
  };

  const handleExtend = (it) => {
    triggerExtend(it);
    navigate('/');
  };

  const handleDownload = async (it) => {
    try {
      const a = document.createElement('a');
      a.href = it.url;
      a.download = it.key.split('/').pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (_) {}
  };

  const card = (it) => (
    <div key={it.key} className="group relative rounded-lg border border-dark-border bg-dark-surface overflow-hidden hover:shadow-sm">
      <button onClick={() => toggleSelect(it.key)} className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border ${selection.has(it.key) ? 'bg-accent border-accent' : 'bg-white border-dark-border'}`}></button>
      <div className="aspect-video bg-dark-bg flex items-center justify-center cursor-pointer relative" onClick={() => setSelected(it)}>
        {String(it.contentType || '').startsWith('video/') ? (
          <>
            <video src={it.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
          </>
        ) : (
          <img src={it.url} alt={it.key} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="p-2">
        <div className="text-xs text-dark-text-secondary truncate">{it.type.replace('_', ' ')}</div>
        <div className="text-sm text-dark-text truncate">{it.key.split('/').pop()}</div>
      </div>
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button onClick={() => handleUseAsReference(it)} className="w-8 h-8 rounded bg-accent text-black hover:bg-accent-hover flex items-center justify-center" title="Use as reference"><Plus className="w-4 h-4" /></button>
        {String(it.contentType || '').startsWith('video/') && (
          <button onClick={() => handleExtend(it)} className="w-8 h-8 rounded bg-purple-600 text-white hover:bg-purple-500 flex items-center justify-center" title="Extend video"><ArrowRight className="w-4 h-4" /></button>
        )}
        <button onClick={() => handleDownload(it)} className="w-8 h-8 rounded bg-dark-border text-dark-text hover:bg-gray-200 flex items-center justify-center" title="Download"><Download className="w-4 h-4" /></button>
        <button onClick={() => setSelected(it)} className="w-8 h-8 rounded bg-dark-border text-dark-text hover:bg-gray-200 flex items-center justify-center" title="Details"><Info className="w-4 h-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 md:px-8 md:py-8 space-y-6">
      <PageHeader
        title="My Files"
        subtitle="Your uploads, generated images, remixes and videos"
        right={(
          <div className="flex items-center gap-2">
            <TypeDropdown value={type} onChange={setType} options={typeOptions} />
            {selection.size > 0 && (
              <>
                <button
                  onClick={() => handleUseAsReference(items.filter((it) => selection.has(it.key)))}
                  className="h-9 px-3 rounded bg-accent text-black hover:bg-accent-hover flex items-center gap-2"
                ><Plus className="w-4 h-4" />Use as reference ({selection.size})</button>
                <button onClick={handleDelete} className="h-9 px-3 rounded bg-dark-border text-dark-text hover:bg-gray-200 flex items-center gap-2"><Trash2 className="w-4 h-4" />Delete</button>
              </>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {items.map(card)}
      </div>

      <div className="mt-4 flex items-center justify-center">
        {nextToken && (
          <button disabled={loading} onClick={()=>load(false)} className={`h-10 px-4 rounded-lg ${loading ? 'bg-accent/60 text-black cursor-not-allowed' : 'bg-accent hover:bg-accent-hover text-black'}`}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex">
          <div className="ml-auto w-[420px] h-full bg-dark-surface p-4 border-l border-dark-border overflow-y-auto">
            <div className="text-lg font-semibold text-dark-text mb-2">Details</div>
            <div className="rounded-lg border border-dark-border overflow-hidden">
              {String(selected.contentType || '').startsWith('video/') ? (
                <video src={selected.url} className="w-full" controls />
              ) : (
                <img src={selected.url} alt={selected.key} className="w-full" />
              )}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="text-dark-text-secondary">Key</div>
              <div className="break-all text-dark-text">{selected.key}</div>
              <div className="text-dark-text-secondary">Type</div>
              <div className="text-dark-text">{selected.type}</div>
              <div className="text-dark-text-secondary">Created</div>
              <div className="text-dark-text">{selected.createdAt || '—'}</div>
              <div className="text-dark-text-secondary">Size</div>
              <div className="text-dark-text">{selected.size ? `${(selected.size/1024/1024).toFixed(2)} MB` : '—'}</div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={()=>handleUseAsReference(selected)} className="h-9 px-3 rounded bg-accent text-black hover:bg-accent-hover flex items-center gap-2"><Plus className="w-4 h-4" />Use as reference</button>
              <button onClick={()=>handleDownload(selected)} className="h-9 px-3 rounded bg-dark-border text-dark-text hover:bg-gray-200 flex items-center gap-2"><Download className="w-4 h-4" />Download</button>
              <button onClick={()=>setSelected(null)} className="h-9 px-3 rounded bg-dark-border text-dark-text hover:bg-gray-200">Close</button>
            </div>
          </div>
          <div className="flex-1" onClick={()=>setSelected(null)} />
        </div>
      )}
    </div>
  );
}


