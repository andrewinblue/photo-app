'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';
import Link from 'next/link';

interface ShareData {
  photoName: string;
  photoUrl: string;
  userId: string;
  createdAt: number;
  caption?: string;
}

export default function SharePage() {
  const params = useParams();
  const shareId = params.id as string;
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShareData = async () => {
      if (!db || !shareId) {
        setError('Unable to load shared photo');
        setLoading(false);
        return;
      }

      try {
        const shareDoc = await getDoc(doc(db, 'shares', shareId));

        if (!shareDoc.exists()) {
          setError('This share link is no longer valid');
          setLoading(false);
          return;
        }

        const data = shareDoc.data() as ShareData;

        // Verify the photo still has this shareId
        const photoDocId = `${data.userId}_${data.photoName}`;
        const photoDoc = await getDoc(doc(db, 'photos', photoDocId));

        if (!photoDoc.exists() || photoDoc.data()?.shareId !== shareId) {
          setError('This share link is no longer valid');
          setLoading(false);
          return;
        }

        // Get caption from photo doc if available
        const photoData = photoDoc.data();
        setShareData({
          ...data,
          caption: photoData?.caption || '',
        });
      } catch (err) {
        console.error('Error fetching share data:', err);
        setError('Failed to load shared photo');
      } finally {
        setLoading(false);
      }
    };

    fetchShareData();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-center px-4">
        <svg className="w-16 h-16 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h1 className="text-xl font-semibold text-white mb-2">Photo Not Found</h1>
        <p className="text-gray-400 mb-6">{error || 'This photo may have been removed or the link is invalid.'}</p>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Photo App
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            Photo App
          </Link>
          <span className="text-sm text-gray-400">Shared Photo</span>
        </div>
      </header>

      {/* Photo */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="relative w-full max-w-4xl aspect-auto">
          <div className="relative w-full" style={{ paddingBottom: '75%' }}>
            <Image
              src={shareData.photoUrl}
              alt={shareData.caption || 'Shared photo'}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              priority
            />
          </div>
        </div>

        {shareData.caption && (
          <p className="mt-4 text-white text-center max-w-2xl">{shareData.caption}</p>
        )}

        {/* Download button */}
        <a
          href={shareData.photoUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-3 text-center">
        <p className="text-sm text-gray-400">
          Shared via{' '}
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            Photo App
          </Link>
        </p>
      </footer>
    </div>
  );
}
