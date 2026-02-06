'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import Image from 'next/image';
import Link from 'next/link';
import { Album, Photo } from '@/types';

export default function AlbumPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [albumName, setAlbumName] = useState('');

  const albumId = params.id as string;

  const fetchAlbumAndPhotos = useCallback(async () => {
    if (!user || !db || !albumId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch album
      const albumDoc = await getDoc(doc(db, 'albums', albumId));
      if (!albumDoc.exists()) {
        router.push('/');
        return;
      }

      const albumData = { id: albumDoc.id, ...albumDoc.data() } as Album;
      if (albumData.userId !== user.uid) {
        router.push('/');
        return;
      }

      setAlbum(albumData);
      setAlbumName(albumData.name);

      // Fetch photos in this album
      const photosRef = collection(db, 'photos');
      const q = query(
        photosRef,
        where('userId', '==', user.uid),
        where('albumId', '==', albumId)
      );
      const photosSnapshot = await getDocs(q);

      const photoPromises = photosSnapshot.docs.map(async (photoDoc) => {
        const data = photoDoc.data();
        let url = data.url;

        // If url is not stored, try to get from storage
        if (!url && storage) {
          try {
            const photoRef = ref(storage, `photos/${user.uid}/${data.fileName}`);
            url = await getDownloadURL(photoRef);
          } catch {
            console.error('Error fetching photo URL');
          }
        }

        return {
          url,
          name: data.fileName,
          caption: data.caption || '',
          favorite: data.favorite || false,
          albumId: data.albumId,
        } as Photo;
      });

      const fetchedPhotos = await Promise.all(photoPromises);
      // Sort by upload time (newest first)
      fetchedPhotos.sort((a, b) => {
        const timestampA = parseInt(a.name.split('_')[0]) || 0;
        const timestampB = parseInt(b.name.split('_')[0]) || 0;
        return timestampB - timestampA;
      });

      setPhotos(fetchedPhotos);
    } catch (err) {
      console.error('Error fetching album:', err);
    } finally {
      setLoading(false);
    }
  }, [user, albumId, router]);

  useEffect(() => {
    if (!authLoading) {
      fetchAlbumAndPhotos();
    }
  }, [authLoading, fetchAlbumAndPhotos]);

  const updateAlbumName = async () => {
    if (!db || !album || !albumName.trim()) return;

    try {
      await updateDoc(doc(db, 'albums', album.id), {
        name: albumName.trim(),
        updatedAt: Date.now(),
      });
      setAlbum({ ...album, name: albumName.trim() });
      setIsEditingName(false);
    } catch (err) {
      console.error('Error updating album name:', err);
    }
  };

  const deletePhoto = async (photoName: string) => {
    if (!user || !storage || !db || !album) return;

    setDeletingPhoto(photoName);
    try {
      // Delete from storage
      const photoRef = ref(storage, `photos/${user.uid}/${photoName}`);
      await deleteObject(photoRef);

      // Update photo doc to remove albumId (or delete entirely)
      const photoDocId = `${user.uid}_${photoName}`;
      await updateDoc(doc(db, 'photos', photoDocId), {
        albumId: null,
      });

      // Update album photo count
      await updateDoc(doc(db, 'albums', album.id), {
        photoCount: Math.max(0, album.photoCount - 1),
        updatedAt: Date.now(),
      });

      setPhotos((prev) => prev.filter((p) => p.name !== photoName));
      setAlbum({ ...album, photoCount: Math.max(0, album.photoCount - 1) });

      if (lightboxIndex !== null && photos.length <= 1) {
        setLightboxIndex(null);
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
    } finally {
      setDeletingPhoto(null);
    }
  };

  const removeFromAlbum = async (photoName: string) => {
    if (!user || !db || !album) return;

    try {
      const photoDocId = `${user.uid}_${photoName}`;
      await updateDoc(doc(db, 'photos', photoDocId), {
        albumId: null,
      });

      // Update album photo count
      await updateDoc(doc(db, 'albums', album.id), {
        photoCount: Math.max(0, album.photoCount - 1),
        updatedAt: Date.now(),
      });

      setPhotos((prev) => prev.filter((p) => p.name !== photoName));
      setAlbum({ ...album, photoCount: Math.max(0, album.photoCount - 1) });

      if (lightboxIndex !== null && photos.length <= 1) {
        setLightboxIndex(null);
      }
    } catch (err) {
      console.error('Error removing from album:', err);
    }
  };

  const setAsCover = async (photoUrl: string) => {
    if (!db || !album) return;

    try {
      await updateDoc(doc(db, 'albums', album.id), {
        coverPhotoUrl: photoUrl,
        updatedAt: Date.now(),
      });
      setAlbum({ ...album, coverPhotoUrl: photoUrl });
    } catch (err) {
      console.error('Error setting cover photo:', err);
    }
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  const nextPhoto = () => setLightboxIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button and album header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Gallery
          </Link>

          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateAlbumName();
                  if (e.key === 'Escape') {
                    setAlbumName(album?.name || '');
                    setIsEditingName(false);
                  }
                }}
              />
              <button
                onClick={updateAlbumName}
                className="p-1 text-blue-600 hover:text-blue-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          ) : (
            <h1
              onClick={() => setIsEditingName(true)}
              className="text-2xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
            >
              {album?.name}
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({photos.length} photos)
              </span>
            </h1>
          )}
        </div>

        {/* Photos grid */}
        {photos.length === 0 ? (
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
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No photos in this album</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add photos from your gallery using the &quot;Add to album&quot; button.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div
                key={photo.name}
                className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 group"
              >
                <Image
                  src={photo.url}
                  alt={photo.name}
                  fill
                  className="object-cover transition-transform group-hover:scale-105 cursor-pointer"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  onClick={() => openLightbox(index)}
                />
                {/* Cover indicator */}
                {album?.coverPhotoUrl === photo.url && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                    Cover
                  </div>
                )}
                {/* Favorite indicator */}
                {photo.favorite && album?.coverPhotoUrl !== photo.url && (
                  <div className="absolute top-2 left-2 p-1 text-red-500">
                    <svg className="w-5 h-5 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>
                )}
                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Set as cover button */}
                  {album?.coverPhotoUrl !== photo.url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAsCover(photo.url);
                      }}
                      className="p-1.5 bg-black/50 hover:bg-blue-600 text-white rounded-full"
                      aria-label="Set as cover"
                      title="Set as album cover"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromAlbum(photo.name);
                    }}
                    className="p-1.5 bg-black/50 hover:bg-orange-600 text-white rounded-full"
                    aria-label="Remove from album"
                    title="Remove from album"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this photo permanently?')) {
                        deletePhoto(photo.name);
                      }
                    }}
                    disabled={deletingPhoto === photo.name}
                    className="p-1.5 bg-black/50 hover:bg-red-600 text-white rounded-full disabled:opacity-50"
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
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <PhotoLightbox
            photos={photos}
            currentIndex={lightboxIndex}
            onClose={closeLightbox}
            onPrev={prevPhoto}
            onNext={nextPhoto}
            onDelete={deletePhoto}
          />
        )}
      </main>
    </div>
  );
}
