import { SUPPORTED_UPLOAD_EXTENSIONS } from '@athenaeum/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useMe } from '../../api/auth.ts';
import { BOOKS_KEY, uploadBook } from '../../api/books.ts';
import { UploadPanel } from '../UploadPanel/UploadPanel.tsx';

export type UploadStatus = 'uploading' | 'processing' | 'done' | 'error';

export interface UploadItem {
  id: number;
  name: string;
  status: UploadStatus;
  progress: number;
  error?: string;
}

interface UploadContextValue {
  /** Opens the system file picker. */
  pickFiles(): void;
  /** Starts uploading files (from the picker or a drop). */
  addFiles(files: Iterable<File>): void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploads must be used inside <UploadProvider>');
  return ctx;
}

const ACCEPT = [...SUPPORTED_UPLOAD_EXTENSIONS, 'application/epub+zip', 'application/pdf'].join(',');
const isSupported = (file: File) => SUPPORTED_UPLOAD_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

let nextId = 1;
const DONE_VISIBLE_MS = 5000;

export function UploadProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);

  const update = useCallback((id: number, patch: Partial<UploadItem>) => {
    setItems((all) => all.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      for (const file of files) {
        const id = nextId++;
        if (!isSupported(file)) {
          setItems((all) => [
            ...all,
            { id, name: file.name, status: 'error', progress: 0, error: 'Only EPUB and PDF files can be added for now.' },
          ]);
          continue;
        }
        setItems((all) => [...all, { id, name: file.name, status: 'uploading', progress: 0 }]);
        uploadBook(file, (progress) => update(id, progress >= 100 ? { progress, status: 'processing' } : { progress }))
          .then(() => {
            update(id, { status: 'done', progress: 100 });
            void qc.invalidateQueries({ queryKey: BOOKS_KEY });
            // Finished uploads tidy themselves away; failures stay until dismissed so the reason can be read.
            window.setTimeout(() => setItems((all) => all.filter((it) => it.id !== id)), DONE_VISIBLE_MS);
          })
          .catch((err: Error) => update(id, { status: 'error', error: err.message }));
      }
    },
    [qc, update],
  );

  const value = useMemo<UploadContextValue>(() => ({ pickFiles: () => inputRef.current?.click(), addFiles }), [addFiles]);
  const clearFinished = () => setItems((all) => all.filter((it) => it.status === 'uploading' || it.status === 'processing'));

  return (
    <UploadContext.Provider value={value}>
      {children}
      {me.data && (
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          aria-label="Add books"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      )}
      <UploadPanel items={items} onClear={clearFinished} />
    </UploadContext.Provider>
  );
}
