'use client';

import { useState, useEffect, useCallback } from 'react';
import { ref, listAll, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import Image from 'next/image';
import { PhotoLightbox } from './PhotoLightbox';

interface Photo {
  url: string;
  name: string;
  caption: string;
  favorite: boolean;
  albumId?: string;
  shareId?: string;
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
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkAlbumPicker, setShowBulkAlbumPicker] = useState(false);

  const deletePhoto = useCallback(async (photoName: string) => {
    if (!user || !storage) return;

    setDeletingPhoto(photoName);
    try {
      const photoRef = ref(storage, `photos/${user.uid}/${photoName}`);
      await deleteObject(photoRef);

      // Also delete from Firestore
      if (db) {
        try {
          await deleteDoc(doc(db, 'photos', `${user.uid}_${photoName}`));
        } catch (err) {
          console.error('Error deleting photo metadata:', err);
        }
      }

      setPhotos((prev) => {
        const newPhotos = prev.filter((p) => p.name !== photoName);
        // Adjust lightbox index if needed
        if (lightboxIndex !== null && lightboxIndex >= newPhotos.length) {
          setLightboxIndex(newPhotos.length > 0 ? newPhotos.length - 1 : null);
        }
        return newPhotos;
      });
    } catch (err) {
      console.error('Error deleting photo:', err);
      alert('Failed to delete photo. Please try again.');
      throw err;
    } finally {
      setDeletingPhoto(null);
    }
  }, [user, lightboxIndex]);

  const updateCaption = useCallback(async (photoName: string, caption: string) => {
    if (!user || !db) return;

    try {
      const docRef = doc(db, 'photos', `${user.uid}_${photoName}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await setDoc(docRef, { ...docSnap.data(), caption }, { merge: true });
      } else {
        // Create doc if it doesn't exist (for older photos without metadata)
        await setDoc(docRef, {
          userId: user.uid,
          fileName: photoName,
          caption,
          uploadedAt: parseInt(photoName.split('_')[0]) || Date.now(),
        });
      }

      setPhotos((prev) =>
        prev.map((p) => (p.name === photoName ? { ...p, caption } : p))
      );
    } catch (err) {
      console.error('Error updating caption:', err);
      throw err;
    }
  }, [user]);

  const toggleFavorite = useCallback(async (photoName: string) => {
    if (!user || !db) return;

    const photo = photos.find((p) => p.name === photoName);
    if (!photo) return;

    const newFavorite = !photo.favorite;

    try {
      const docRef = doc(db, 'photos', `${user.uid}_${photoName}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await setDoc(docRef, { ...docSnap.data(), favorite: newFavorite }, { merge: true });
      } else {
        await setDoc(docRef, {
          userId: user.uid,
          fileName: photoName,
          caption: '',
          favorite: newFavorite,
          uploadedAt: parseInt(photoName.split('_')[0]) || Date.now(),
        });
      }

      setPhotos((prev) =>
        prev.map((p) => (p.name === photoName ? { ...p, favorite: newFavorite } : p))
      );
    } catch (err) {
      console.error('Error toggling favorite:', err);
      throw err;
    }
  }, [user, photos]);

  const handleDelete = useCallback(async (photoName: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this photo?');
    if (!confirmed) return;
    await deletePhoto(photoName);
  }, [deletePhoto]);

  const updateAlbum = useCallback((photoName: string, albumId: string | null) => {
    setPhotos((prev) =>
      prev.map((p) => (p.name === photoName ? { ...p, albumId: albumId || undefined } : p))
    );
  }, []);

  const updateShare = useCallback((photoName: string, shareId: string | null) => {
    setPhotos((prev) =>
      prev.map((p) => (p.name === photoName ? { ...p, shareId: shareId || undefined } : p))
    );
  }, []);

  const togglePhotoSelection = useCallback((photoName: string) => {
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoName)) {
        newSet.delete(photoName);
      } else {
        newSet.add(photoName);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const displayedNames = (showFavoritesOnly ? photos.filter((p) => p.favorite) : photos).map((p) => p.name);
    setSelectedPhotos(new Set(displayedNames));
  }, [photos, showFavoritesOnly]);

  const clearSelection = useCallback(() => {
    setSelectedPhotos(new Set());
    setSelectionMode(false);
  }, []);

  const bulkDelete = useCallback(async () => {
    if (!user || !storage || selectedPhotos.size === 0) return;

    const confirmed = window.confirm(`Delete ${selectedPhotos.size} photo${selectedPhotos.size > 1 ? 's' : ''}? This cannot be undone.`);
    if (!confirmed) return;

    setBulkActionLoading(true);
    try {
      const deletePromises = Array.from(selectedPhotos).map(async (photoName) => {
        const photoRef = ref(storage, `photos/${user.uid}/${photoName}`);
        await deleteObject(photoRef);
        if (db) {
          try {
            await deleteDoc(doc(db, 'photos', `${user.uid}_${photoName}`));
          } catch (err) {
            console.error('Error deleting photo metadata:', err);
          }
        }
      });

      await Promise.all(deletePromises);
      setPhotos((prev) => prev.filter((p) => !selectedPhotos.has(p.name)));
      clearSelection();
    } catch (err) {
      console.error('Error bulk deleting photos:', err);
      alert('Failed to delete some photos. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  }, [user, selectedPhotos, clearSelection]);

  const bulkFavorite = useCallback(async (favorite: boolean) => {
    if (!user || !db || selectedPhotos.size === 0) return;

    setBulkActionLoading(true);
    try {
      const updatePromises = Array.from(selectedPhotos).map(async (photoName) => {
        const docRef = doc(db, 'photos', `${user.uid}_${photoName}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          await setDoc(docRef, { ...docSnap.data(), favorite }, { merge: true });
        } else {
          await setDoc(docRef, {
            userId: user.uid,
            fileName: photoName,
            caption: '',
            favorite,
            uploadedAt: parseInt(photoName.split('_')[0]) || Date.now(),
          });
        }
      });

      await Promise.all(updatePromises);
      setPhotos((prev) =>
        prev.map((p) => (selectedPhotos.has(p.name) ? { ...p, favorite } : p))
      );
      clearSelection();
    } catch (err) {
      console.error('Error bulk updating favorites:', err);
      alert('Failed to update favorites. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  }, [user, selectedPhotos, clearSelection]);

  const bulkAddToAlbum = useCallback(async (albumId: string) => {
    if (!user || !db || selectedPhotos.size === 0) return;

    setBulkActionLoading(true);
    try {
      const updatePromises = Array.from(selectedPhotos).map(async (photoName) => {
        const docRef = doc(db, 'photos', `${user.uid}_${photoName}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          await setDoc(docRef, { ...docSnap.data(), albumId }, { merge: true });
        } else {
          await setDoc(docRef, {
            userId: user.uid,
            fileName: photoName,
            caption: '',
            favorite: false,
            albumId,
            uploadedAt: parseInt(photoName.split('_')[0]) || Date.now(),
          });
        }
      });

      await Promise.all(updatePromises);

      // Update album photo count
      const albumRef = doc(db, 'albums', albumId);
      await updateDoc(albumRef, {
        photoCount: increment(selectedPhotos.size),
        updatedAt: Date.now(),
      });

      setPhotos((prev) =>
        prev.map((p) => (selectedPhotos.has(p.name) ? { ...p, albumId } : p))
      );
      clearSelection();
      setShowBulkAlbumPicker(false);
    } catch (err) {
      console.error('Error bulk adding to album:', err);
      alert('Failed to add photos to album. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  }, [user, selectedPhotos, clearSelection]);

  const displayedPhotos = showFavoritesOnly ? photos.filter((p) => p.favorite) : photos;
  const favoriteCount = photos.filter((p) => p.favorite).length;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  const nextPhoto = () => setLightboxIndex((i) => (i !== null && i < displayedPhotos.length - 1 ? i + 1 : i));

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
          let caption = '';
          let favorite = false;
          let albumId: string | undefined;
          let shareId: string | undefined;

          // Fetch metadata from Firestore if available
          if (db) {
            try {
              const docRef = doc(db, 'photos', `${user.uid}_${item.name}`);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const data = docSnap.data();
                caption = data.caption || '';
                favorite = data.favorite || false;
                albumId = data.albumId || undefined;
                shareId = data.shareId || undefined;
              }
            } catch (err) {
              console.error('Error fetching photo metadata:', err);
            }
          }

          return { url, name: item.name, caption, favorite, albumId, shareId };
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
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No photos</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Get started by uploading your first photo.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Selection mode toggle */}
          <button
            onClick={() => {
              if (selectionMode) {
                clearSelection();
              } else {
                setSelectionMode(true);
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              selectionMode
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {selectionMode ? 'Cancel' : 'Select'}
          </button>

          {/* Select all / Clear selection */}
          {selectionMode && (
            <>
              <button
                onClick={selectAll}
                className="px-3 py-1.5 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Select all
              </button>
              {selectedPhotos.size > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedPhotos.size} selected
                </span>
              )}
            </>
          )}
        </div>

        {/* Favorites filter */}
        {favoriteCount > 0 && !selectionMode && (
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              showFavoritesOnly
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {showFavoritesOnly ? `Favorites (${favoriteCount})` : `Show favorites (${favoriteCount})`}
          </button>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selectionMode && selectedPhotos.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-300 mr-2">
            Actions:
          </span>
          <button
            onClick={() => bulkFavorite(true)}
            disabled={bulkActionLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            Favorite
          </button>
          <button
            onClick={() => bulkFavorite(false)}
            disabled={bulkActionLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Unfavorite
          </button>
          <button
            onClick={() => setShowBulkAlbumPicker(true)}
            disabled={bulkActionLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Add to album
          </button>
          <button
            onClick={bulkDelete}
            disabled={bulkActionLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors ml-auto"
          >
            {bulkActionLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            Delete
          </button>
        </div>
      )}

      {showFavoritesOnly && displayedPhotos.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No favorites yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Click the heart icon on photos to add them to favorites.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {displayedPhotos.map((photo, index) => (
          <div
            key={photo.name}
            className={`aspect-square relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 group ${
              selectionMode && selectedPhotos.has(photo.name) ? 'ring-4 ring-blue-500' : ''
            }`}
          >
            <Image
              src={photo.url}
              alt={photo.name}
              fill
              className={`object-cover transition-transform cursor-pointer ${
                selectionMode ? '' : 'group-hover:scale-105'
              }`}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              onClick={() => {
                if (selectionMode) {
                  togglePhotoSelection(photo.name);
                } else {
                  openLightbox(index);
                }
              }}
            />
            {/* Selection checkbox */}
            {selectionMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePhotoSelection(photo.name);
                }}
                className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPhotos.has(photo.name)
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-white/80 border-gray-400 hover:border-blue-500'
                }`}
              >
                {selectedPhotos.has(photo.name) && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </button>
            )}
            {/* Favorite indicator */}
            {photo.favorite && !selectionMode && (
              <div className="absolute top-2 left-2 p-1 text-red-500">
                <svg className="w-5 h-5 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            )}
            {/* Delete button */}
            {!selectionMode && (
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
            )}
          </div>
        ))}
      </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={displayedPhotos}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevPhoto}
          onNext={nextPhoto}
          onDelete={deletePhoto}
          onUpdateCaption={updateCaption}
          onToggleFavorite={toggleFavorite}
          onUpdateAlbum={updateAlbum}
          onUpdateShare={updateShare}
        />
      )}

      {/* Bulk Album Picker */}
      {showBulkAlbumPicker && (
        <BulkAlbumPicker
          selectedCount={selectedPhotos.size}
          onClose={() => setShowBulkAlbumPicker(false)}
          onSelectAlbum={bulkAddToAlbum}
          loading={bulkActionLoading}
        />
      )}
    </>
  );
}

// Simplified album picker for bulk operations
function BulkAlbumPicker({
  selectedCount,
  onClose,
  onSelectAlbum,
  loading,
}: {
  selectedCount: number;
  onClose: () => void;
  onSelectAlbum: (albumId: string) => void;
  loading: boolean;
}) {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<Array<{ id: string; name: string; photoCount: number }>>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);

  useEffect(() => {
    const fetchAlbums = async () => {
      if (!user || !db) {
        setLoadingAlbums(false);
        return;
      }

      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const albumsRef = collection(db, 'albums');
        const q = query(albumsRef, where('userId', '==', user.uid));
        const snapshot = await getDocs(q);

        const fetchedAlbums = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          photoCount: doc.data().photoCount || 0,
        }));

        fetchedAlbums.sort((a, b) => a.name.localeCompare(b.name));
        setAlbums(fetchedAlbums);
      } catch (err) {
        console.error('Error fetching albums:', err);
      } finally {
        setLoadingAlbums(false);
      }
    };

    fetchAlbums();
  }, [user]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add {selectedCount} photo{selectedCount > 1 ? 's' : ''} to Album
          </h3>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {loadingAlbums ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading albums...</div>
          ) : albums.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No albums yet. Create one from the main page.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {albums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => onSelectAlbum(album.id)}
                  disabled={loading}
                  className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <p className="font-medium text-gray-900 dark:text-white">{album.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{album.photoCount} photos</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
