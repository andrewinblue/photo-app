'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, getDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { Album } from '@/types';

interface AlbumPickerProps {
  photoName: string;
  currentAlbumId?: string;
  onClose: () => void;
  onUpdate: (albumId: string | null) => void;
}

export function AlbumPicker({ photoName, currentAlbumId, onClose, onUpdate }: AlbumPickerProps) {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAlbums = async () => {
      if (!user || !db) {
        setLoading(false);
        return;
      }

      try {
        const albumsRef = collection(db, 'albums');
        const q = query(albumsRef, where('userId', '==', user.uid));
        const snapshot = await getDocs(q);

        const fetchedAlbums: Album[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Album));

        fetchedAlbums.sort((a, b) => b.createdAt - a.createdAt);
        setAlbums(fetchedAlbums);
      } catch (err) {
        console.error('Error fetching albums:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, [user]);

  const addToAlbum = async (albumId: string) => {
    if (!user || !db) return;

    setSaving(true);
    try {
      const photoDocId = `${user.uid}_${photoName}`;
      const photoDocRef = doc(db, 'photos', photoDocId);
      const photoDoc = await getDoc(photoDocRef);

      // Update or create photo document
      if (photoDoc.exists()) {
        await updateDoc(photoDocRef, { albumId });
      } else {
        await setDoc(photoDocRef, {
          userId: user.uid,
          fileName: photoName,
          albumId,
          caption: '',
          favorite: false,
          uploadedAt: parseInt(photoName.split('_')[0]) || Date.now(),
        });
      }

      // Update album photo count
      const albumRef = doc(db, 'albums', albumId);
      await updateDoc(albumRef, {
        photoCount: increment(1),
        updatedAt: Date.now(),
      });

      // If removing from a previous album, decrement its count
      if (currentAlbumId && currentAlbumId !== albumId) {
        const prevAlbumRef = doc(db, 'albums', currentAlbumId);
        await updateDoc(prevAlbumRef, {
          photoCount: increment(-1),
          updatedAt: Date.now(),
        });
      }

      onUpdate(albumId);
      onClose();
    } catch (err) {
      console.error('Error adding to album:', err);
      alert('Failed to add to album. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeFromAlbum = async () => {
    if (!user || !db || !currentAlbumId) return;

    setSaving(true);
    try {
      const photoDocId = `${user.uid}_${photoName}`;
      await updateDoc(doc(db, 'photos', photoDocId), { albumId: null });

      // Decrement album photo count
      const albumRef = doc(db, 'albums', currentAlbumId);
      await updateDoc(albumRef, {
        photoCount: increment(-1),
        updatedAt: Date.now(),
      });

      onUpdate(null);
      onClose();
    } catch (err) {
      console.error('Error removing from album:', err);
    } finally {
      setSaving(false);
    }
  };

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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add to Album</h3>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
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
                  onClick={() => addToAlbum(album.id)}
                  disabled={saving || album.id === currentAlbumId}
                  className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                    album.id === currentAlbumId ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  } disabled:opacity-50`}
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{album.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{album.photoCount} photos</p>
                  </div>
                  {album.id === currentAlbumId && (
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          {currentAlbumId && (
            <button
              onClick={removeFromAlbum}
              disabled={saving}
              className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
            >
              Remove from album
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 ml-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
