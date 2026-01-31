'use client';

import { useAuth } from '@/components/AuthProvider';
import { PhotoUpload } from '@/components/PhotoUpload';
import { PhotoGallery } from '@/components/PhotoGallery';
import { AlbumList } from '@/components/AlbumList';
import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Photo App
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Sign in with your Google account to upload and manage your photos.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Photos</h1>
        <PhotoUpload onUploadComplete={handleUploadComplete} />
      </div>

      <div className="mt-8 mb-12">
        <AlbumList />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Photos</h2>
        <PhotoGallery refreshKey={refreshKey} />
      </div>
    </div>
  );
}
