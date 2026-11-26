import type { BookDetail, BookSummary, Chapter, CollectionDetail, CollectionSummary } from '@athenaeum/shared';

/** A complete BookSummary, as the server returns it. */
export function summary(over: Partial<BookSummary> = {}): BookSummary {
  return {
    id: 'b1',
    title: 'The Lantern Road',
    author: 'Mara Quill',
    format: 'epub',
    hasCover: false,
    chapterCount: 3,
    wordCount: 2400,
    percent: 0,
    chapterIndex: 0,
    addedAt: '2026-11-22T10:00:00.000Z',
    lastReadAt: null,
    pinned: false,
    ...over,
  };
}

export function detail(over: Partial<BookDetail> = {}): BookDetail {
  return {
    ...summary(),
    description: 'A quiet story.',
    filename: 'lantern.epub',
    sizeBytes: 12345,
    progress: null,
    chapters: [
      { index: 0, title: 'The Arrival', wordCount: 944, read: false },
      { index: 1, title: 'The Storm', wordCount: 600, read: false },
      { index: 2, title: 'The Return', wordCount: 856, read: false },
    ],
    ...over,
  };
}

export function chapter(index: number, over: Partial<Chapter> = {}): Chapter {
  const titles = ['The Arrival', 'The Storm', 'The Return'];
  return {
    bookId: 'b1',
    index,
    title: titles[index] ?? `Chapter ${index + 1}`,
    wordCount: [944, 600, 856][index] ?? 100,
    blocks: [
      { type: 'p', text: `Opening line of chapter ${index + 1}.` },
      { type: 'p', text: 'She walked on.' },
    ],
    gallery: [],
    ...over,
  };
}

export function collectionSummary(over: Partial<CollectionSummary> = {}): CollectionSummary {
  return {
    id: 'c1',
    name: 'Favorites',
    bookCount: 2,
    previewBooks: [
      { id: 'b1', title: 'Dune', hasCover: true },
      { id: 'b2', title: 'Emma', hasCover: false },
    ],
    createdAt: '2026-11-20T10:00:00.000Z',
    ...over,
  };
}

/** A collection whose books arrive deliberately out of order, so sorting is the client's job. */
export function collectionDetail(over: Partial<CollectionDetail> = {}): CollectionDetail {
  return {
    id: 'c1',
    name: 'Favorites',
    createdAt: '2026-11-20T10:00:00.000Z',
    books: [
      { ...summary({ id: 'b2', title: 'Emma' }), addedToCollectionAt: '2026-11-21T09:00:00.000Z' },
      { ...summary({ id: 'b4', title: 'anna karenina' }), addedToCollectionAt: '2026-11-20T09:00:00.000Z' },
      { ...summary({ id: 'b1', title: 'Dune' }), addedToCollectionAt: '2026-11-22T09:00:00.000Z' },
    ],
    ...over,
  };
}
