'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

interface PhotoUploadProps {
  onUploadComplete?: () => void;
}

export function PhotoUpload({ onUploadComplete }: PhotoUploadProps) {
  const { user } = useAuth();
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploads.some((u) => u.status === 'uploading');

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return `${file.name}: Not an image file`;
    }
    if (file.size > 10 * 1024 * 1024) {
      return `${file.name}: File size must be less than 10MB`;
    }
    return null;
  };

  const uploadFile = (file: File) => {
    if (!user || !storage) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;

    setUploads((prev) => [
      ...prev,
      { id, name: file.name, progress: 0, status: 'uploading' },
    ]);

    const storageRef = ref(storage, `photos/${user.uid}/${filename}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploads((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, progress: Math.round(progress) } : u
          )
        );
      },
      (error) => {
        console.error('Upload error:', error);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, status: 'error', error: 'Upload failed' } : u
          )
        );
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

        // Save photo metadata to Firestore
        if (db) {
          try {
            await setDoc(doc(db, 'photos', `${user.uid}_${filename}`), {
              userId: user.uid,
              fileName: filename,
              url: downloadUrl,
              caption: '',
              uploadedAt: timestamp,
            });
          } catch (err) {
            console.error('Failed to save photo metadata:', err);
          }
        }

        setUploads((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, status: 'complete', progress: 100 } : u
          )
        );
        onUploadComplete?.();
      }
    );
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || !user || !storage) return;

    setError(null);
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
      } else {
        uploadFile(file);
      }
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status === 'uploading'));
  };

  const activeUploads = uploads.filter((u) => u.status === 'uploading');
  const completedUploads = uploads.filter((u) => u.status !== 'uploading');

  return (
    <div className="w-full">
      <div className="flex flex-col items-center justify-center w-full">
        <label
          htmlFor="photo-upload"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : isUploading
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className={`w-10 h-10 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
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
            <p className="text-xs text-gray-400">PNG, JPG, GIF up to 10MB (multiple files supported)</p>
          </div>
          <input
            id="photo-upload"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={!storage}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500 text-center whitespace-pre-line">{error}</p>
      )}

      {/* Upload Progress List */}
      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {completedUploads.length > 0 && (
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">
                {completedUploads.filter((u) => u.status === 'complete').length} uploaded
                {completedUploads.filter((u) => u.status === 'error').length > 0 &&
                  `, ${completedUploads.filter((u) => u.status === 'error').length} failed`}
              </span>
              <button
                onClick={clearCompleted}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear
              </button>
            </div>
          )}

          {activeUploads.map((upload) => (
            <div key={upload.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700 truncate max-w-[200px]">
                  {upload.name}
                </span>
                <span className="text-sm text-blue-600">{upload.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            </div>
          ))}

          {completedUploads.slice(0, 3).map((upload) => (
            <div
              key={upload.id}
              className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                upload.status === 'complete'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {upload.status === 'complete' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className="truncate">{upload.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
