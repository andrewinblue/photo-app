'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import Image from 'next/image';
import Link from 'next/link';
import { Album } from '@/types';

export function AlbumList() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [deletingAlbum, setDeletingAlbum] = useState<string | null>(null);

  const fetchAlbums = useCallback(async () => {
    if (!user || !db) {
      setAlbums([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const albumsRef = collection(db, 'albums');
      const q = query(albumsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);

      const fetchedAlbums: Album[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Album));

      // Sort by createdAt (newest first)
      fetchedAlbums.sort((a, b) => b.createdAt - a.createdAt);
      setAlbums(fetchedAlbums);
    } catch (err) {
      console.error('Error fetching albums:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const createAlbum = async () => {
    if (!user || !db || !newAlbumName.trim()) return;

    try {
      const albumData = {
        userId: user.uid,
        name: newAlbumName.trim(),
        photoCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const docRef = await addDoc(collection(db, 'albums'), albumData);

      setAlbums((prev) => [
        { id: docRef.id, ...albumData },
        ...prev,
      ]);
      setNewAlbumName('');
      setIsCreating(false);
    } catch (err) {
      console.error('Error creating album:', err);
      alert('Failed to create album. Please try again.');
    }
  };

  const deleteAlbum = async (albumId: string) => {
    if (!user || !db) return;

    const confirmed = window.confirm('Are you sure you want to delete this album? Photos will not be deleted.');
    if (!confirmed) return;

    setDeletingAlbum(albumId);
    try {
      await deleteDoc(doc(db, 'albums', albumId));
      setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    } catch (err) {
      console.error('Error deleting album:', err);
      alert('Failed to delete album. Please try again.');
    } finally {
      setDeletingAlbum(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header with create button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Albums</h2>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Album
          </button>
        )}
      </div>

      {/* Create album form */}
      {isCreating && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <input
            type="text"
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            placeholder="Album name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') createAlbum();
              if (e.key === 'Escape') {
                setIsCreating(false);
                setNewAlbumName('');
              }
            }}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setIsCreating(false);
                setNewAlbumName('');
              }}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={createAlbum}
              disabled={!newAlbumName.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Albums grid */}
      {albums.length === 0 ? (
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No albums</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create an album to organize your photos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {albums.map((album) => (
            <div
              key={album.id}
              className="group relative"
            >
              <Link href={`/album/${album.id}`}>
                <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer">
                  {album.coverPhotoUrl ? (
                    <Image
                      src={album.coverPhotoUrl}
                      alt={album.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                      <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Overlay with album info */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <h3 className="text-white font-medium text-sm truncate">{album.name}</h3>
                    <p className="text-white/70 text-xs">{album.photoCount} photos</p>
                  </div>
                </div>
              </Link>
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  deleteAlbum(album.id);
                }}
                disabled={deletingAlbum === album.id}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                aria-label="Delete album"
              >
                {deletingAlbum === album.id ? (
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
      )}
    </div>
  );
}
