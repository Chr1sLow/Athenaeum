import type { Block } from '@athenaeum/shared';

export interface ImportedChapter {
  title: string;
  blocks: Block[];
  wordCount: number;
  /** Illustrations shown in the chapter's gallery; `key` is an `ImportedImage` key. */
  gallery: { key: string; width: number; height: number }[];
}

export interface ImportedImage {
  /** Temporary id used by `img` blocks until the image is stored and gets a real id. */
  key: string;
  mime: string;
  data: Buffer;
}

/** What every importer produces, whatever the source format. */
export interface ImportedBook {
  title: string;
  author: string | null;
  description: string | null;
  cover: { mime: string; data: Buffer } | null;
  chapters: ImportedChapter[];
  images: ImportedImage[];
}
