'use client';

import { useState } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';

interface ShareModalProps {
  photoName: string;
  photoUrl: string;
  currentShareId?: string;
  onClose: () => void;
  onUpdate: (shareId: string | null) => void;
}

function generateShareId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function ShareModal({ photoName, photoUrl, currentShareId, onClose, onUpdate }: ShareModalProps) {
  const { user } = useAuth();
  const [shareId, setShareId] = useState<string | null>(currentShareId || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareId ? `${window.location.origin}/share/${shareId}` : null;

  const createShareLink = async () => {
    if (!user || !db) return;

    setLoading(true);
    try {
      const newShareId = generateShareId();
      const photoDocId = `${user.uid}_${photoName}`;
      const photoDocRef = doc(db, 'photos', photoDocId);
      const photoDoc = await getDoc(photoDocRef);

      // Update or create photo document with shareId
      if (photoDoc.exists()) {
        await setDoc(photoDocRef, { ...photoDoc.data(), shareId: newShareId }, { merge: true });
      } else {
        await setDoc(photoDocRef, {
          userId: user.uid,
          fileName: photoName,
          shareId: newShareId,
          url: photoUrl,
          caption: '',
          favorite: false,
          uploadedAt: parseInt(photoName.split('_')[0]) || Date.now(),
        });
      }

      // Create a share document for public access
      await setDoc(doc(db, 'shares', newShareId), {
        photoName,
        photoUrl,
        userId: user.uid,
        createdAt: Date.now(),
      });

      setShareId(newShareId);
      onUpdate(newShareId);
    } catch (err) {
      console.error('Error creating share link:', err);
      alert('Failed to create share link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeShareLink = async () => {
    if (!user || !db || !shareId) return;

    setLoading(true);
    try {
      const photoDocId = `${user.uid}_${photoName}`;
      const photoDocRef = doc(db, 'photos', photoDocId);
      const photoDoc = await getDoc(photoDocRef);

      if (photoDoc.exists()) {
        const data = photoDoc.data();
        delete data.shareId;
        await setDoc(photoDocRef, data);
      }

      // Note: We keep the share document for a grace period, but it won't work without the photo shareId

      setShareId(null);
      onUpdate(null);
    } catch (err) {
      console.error('Error removing share link:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Share Photo</h3>
        </div>

        <div className="p-4">
          {shareId ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Anyone with this link can view this photo:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl || ''}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button
                onClick={removeShareLink}
                disabled={loading}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
              >
                {loading ? 'Removing...' : 'Remove share link'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Create a shareable link that anyone can use to view this photo.
              </p>
              <button
                onClick={createShareLink}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Create Share Link
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
