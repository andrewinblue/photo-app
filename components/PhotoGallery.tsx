'use client';

import { useState, useEffect, useCallback } from 'react';
import { ref, listAll, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import Image from 'next/image';
import { PhotoLightbox } from './PhotoLightbox';

interface Photo {
  url: string;
  name: string;
}

interface PhotoGalleryProps {
  refreshKey?: number;
}

export function PhotoGallery({ refreshKey }: PhotoGalleryProps) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);

  const handleDelete = useCallback(async (photoName: string) => {
    if (!user || !storage) return;

    const confirmed = window.confirm('Are you sure you want to delete this photo?');
    if (!confirmed) return;

    setDeletingPhoto(photoName);
    try {
      const photoRef = ref(storage, `photos/${user.uid}/${photoName}`);
      await deleteObject(photoRef);
      setPhotos((prev) => prev.filter((p) => p.name !== photoName));
    } catch (err) {
      console.error('Error deleting photo:', err);
      alert('Failed to delete photo. Please try again.');
    } finally {
      setDeletingPhoto(null);
    }
  }, [user]);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  const nextPhoto = () => setLightboxIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!user || !storage) {
        setPhotos([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const listRef = ref(storage, `photos/${user.uid}`);
        const result = await listAll(listRef);

        const photoPromises = result.items.map(async (item) => {
          const url = await getDownloadURL(item);
          return { url, name: item.name };
        });

        const fetchedPhotos = await Promise.all(photoPromises);
        // Sort by timestamp (newest first)
        fetchedPhotos.sort((a, b) => {
          const timestampA = parseInt(a.name.split('_')[0]) || 0;
          const timestampB = parseInt(b.name.split('_')[0]) || 0;
          return timestampB - timestampA;
        });

        setPhotos(fetchedPhotos);
      } catch (err) {
        console.error('Error fetching photos:', err);
        setError('Failed to load photos');
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [user, refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No photos</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by uploading your first photo.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((photo, index) => (
          <div
            key={photo.name}
            className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 group"
          >
            <Image
              src={photo.url}
              alt={photo.name}
              fill
              className="object-cover transition-transform group-hover:scale-105 cursor-pointer"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              onClick={() => openLightbox(index)}
            />
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(photo.name);
              }}
              disabled={deletingPhoto === photo.name}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              aria-label="Delete photo"
            >
              {deletingPhoto === photo.name ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
      )}
    </>
  );
}
