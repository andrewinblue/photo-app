'use client';

import { useState, useEffect } from 'react';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import Image from 'next/image';

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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <div
          key={photo.name}
          className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 group"
        >
          <Image
            src={photo.url}
            alt={photo.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
          />
        </div>
      ))}
    </div>
  );
}
