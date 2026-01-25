'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from './AuthProvider';

interface PhotoUploadProps {
  onUploadComplete?: () => void;
}

export function PhotoUpload({ onUploadComplete }: PhotoUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !storage) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Create unique filename with timestamp
      const timestamp = Date.now();
      const filename = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `photos/${user.uid}/${filename}`);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(Math.round(progress));
        },
        (error) => {
          console.error('Upload error:', error);
          setError('Failed to upload photo. Please try again.');
          setUploading(false);
        },
        async () => {
          await getDownloadURL(uploadTask.snapshot.ref);
          setUploading(false);
          setProgress(0);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          onUploadComplete?.();
        }
      );
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload photo. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center justify-center w-full">
        <label
          htmlFor="photo-upload"
          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            uploading
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <div className="w-48 bg-gray-200 rounded-full h-2.5 mb-4">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-blue-600 font-medium">
                Uploading... {progress}%
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-10 h-10 mb-3 text-gray-400"
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
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-400">PNG, JPG, GIF up to 10MB</p>
            </div>
          )}
          <input
            id="photo-upload"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading || !storage}
            className="hidden"
          />
        </label>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
