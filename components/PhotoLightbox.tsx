'use client';

import { useEffect, useCallback, useState } from 'react';
import Image from 'next/image';

interface Photo {
  url: string;
  name: string;
  caption: string;
}

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete?: (photoName: string) => Promise<void>;
  onUpdateCaption?: (photoName: string, caption: string) => Promise<void>;
}

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onPrev,
  onNext,
  onDelete,
  onUpdateCaption,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex];
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [captionText, setCaptionText] = useState(photo?.caption || '');
  const [isSavingCaption, setIsSavingCaption] = useState(false);

  const handleDownload = async () => {
    if (!photo) return;

    // Extract clean filename (remove timestamp prefix if present)
    const cleanName = photo.name.includes('_')
      ? photo.name.substring(photo.name.indexOf('_') + 1)
      : photo.name;

    try {
      // Try fetch with cors mode first
      const response = await fetch(photo.url, { mode: 'cors' });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      // Fallback: use canvas approach for cross-origin images
      try {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load failed'));
          img.src = photo.url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = cleanName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }
        });
      } catch {
        // Last resort: open in new tab
        window.open(photo.url, '_blank');
      }
    }
  };

  const handleDelete = async () => {
    if (!photo || !onDelete) return;
    const confirmed = window.confirm('Are you sure you want to delete this photo?');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await onDelete(photo.name);
      // If this was the last photo, close the lightbox
      if (photos.length === 1) {
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Sync caption text when photo changes
  useEffect(() => {
    setCaptionText(photo?.caption || '');
    setIsEditingCaption(false);
  }, [photo]);

  const handleSaveCaption = async () => {
    if (!photo || !onUpdateCaption) return;
    setIsSavingCaption(true);
    try {
      await onUpdateCaption(photo.name, captionText);
      setIsEditingCaption(false);
    } catch (err) {
      console.error('Failed to save caption:', err);
    } finally {
      setIsSavingCaption(false);
    }
  };

  const handleCancelEdit = () => {
    setCaptionText(photo?.caption || '');
    setIsEditingCaption(false);
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isEditingCaption) return; // Don't handle navigation when editing
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    },
    [onClose, onPrev, onNext, isEditingCaption]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [handleKeyDown]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
        aria-label="Close"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Previous button */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
          aria-label="Previous photo"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Next button */}
      {currentIndex < photos.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
          aria-label="Next photo"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={photo.url}
          alt={photo.name}
          fill
          className="object-contain"
          sizes="90vw"
          priority
        />
      </div>

      {/* Caption area */}
      <div
        className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {isEditingCaption ? (
          <div className="bg-black/70 rounded-lg p-3">
            <textarea
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              placeholder="Add a caption..."
              className="w-full bg-transparent text-white placeholder-white/50 resize-none outline-none text-sm"
              rows={2}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1 text-sm text-white/80 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCaption}
                disabled={isSavingCaption}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingCaption ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onUpdateCaption && setIsEditingCaption(true)}
            className={`text-center ${onUpdateCaption ? 'cursor-pointer hover:bg-black/30 rounded-lg p-2 transition-colors' : ''}`}
          >
            {photo.caption ? (
              <p className="text-white/90 text-sm">{photo.caption}</p>
            ) : onUpdateCaption ? (
              <p className="text-white/50 text-sm italic">Click to add caption</p>
            ) : null}
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
        {/* Download button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Download photo"
          title="Download"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>

        {/* Counter */}
        <span className="text-white/80 text-sm">
          {currentIndex + 1} / {photos.length}
        </span>

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={isDeleting}
            className="text-white/80 hover:text-red-500 p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Delete photo"
            title="Delete"
          >
            {isDeleting ? (
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
