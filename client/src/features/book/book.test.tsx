import type { BookDetail } from '@athenaeum/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { chapter, detail } from '../../test/books.ts';
import { callsTo, mockSignedIn, renderApp } from '../../test/render.tsx';

function bookApi(book: BookDetail = detail()) {
  return mockSignedIn({
    'GET /books/b1': { status: 200, body: book },
    'PUT /books/b1/chapters/0/read': { status: 204 },
    'PUT /books/b1/chapters/1/read': { status: 204 },
    'PUT /books/b1/chapters/2/read': { status: 204 },
  });
}

/** Chapter titles in the list, in the order shown. */
const listed = () =>
  within(screen.getByRole('list', { name: 'Chapters' }))
    .getAllByRole('link')
    .map((a) => a.querySelector('[data-title]')?.textContent);

describe('book page: details', () => {
  it('shows the title, author, format, size and description', async () => {
    bookApi();
    renderApp('/book/b1');
    expect(await screen.findByRole('heading', { level: 1, name: 'The Lantern Road' })).toBeInTheDocument();
    expect(screen.getByText('Mara Quill')).toBeInTheDocument();
    expect(screen.getByText('EPUB')).toBeInTheDocument();
    expect(screen.getByText('3 chapters')).toBeInTheDocument();
    expect(screen.getByText('2,400 words')).toBeInTheDocument();
    expect(screen.getByText('A quiet story.')).toBeInTheDocument();
  });

  it('leaves out the description when the book has none', async () => {
    bookApi(detail({ description: null }));
    renderApp('/book/b1');
    await screen.findByRole('heading', { level: 1, name: 'The Lantern Road' });
    expect(screen.queryByText('A quiet story.')).not.toBeInTheDocument();
  });

  it('offers a start button for a book you have not opened', async () => {
    bookApi();
    renderApp('/book/b1');
    expect(await screen.findByRole('link', { name: /Start reading/ })).toHaveAttribute('href', '/read/b1/1');
  });

  it('offers to continue from the chapter you were on', async () => {
    bookApi(detail({ chapterIndex: 1, percent: 40, progress: { chapterIndex: 1, blockIndex: 4, percent: 40, updatedAt: '' } }));
    renderApp('/book/b1');
    const button = await screen.findByRole('link', { name: /Continue/ });
    expect(button).toHaveAttribute('href', '/read/b1/2');
    expect(button).toHaveTextContent('The Storm');
  });

  it('links to the original file', async () => {
    bookApi();
    renderApp('/book/b1');
    expect(await screen.findByRole('link', { name: /Download original/ })).toHaveAttribute('href', '/api/books/b1/file');
  });

  it('says so when the book does not exist', async () => {
    mockSignedIn({ 'GET /books/missing': { status: 404, body: { error: 'Book not found' } } });
    renderApp('/book/missing');
    expect(await screen.findByText('This book is not on your shelf.')).toBeInTheDocument();
  });
});

describe('book page: after reading', () => {
  it('shows where you are when you come back from the reader', async () => {
    // The server's copy of the book changes once the reader saves your place.
    let saved: { chapterIndex: number; blockIndex: number; percent: number } | null = null;
    mockSignedIn({
      'GET /books/b1': () => ({
        status: 200,
        body: detail(saved ? { chapterIndex: saved.chapterIndex, percent: saved.percent, progress: { ...saved, updatedAt: '' } } : {}),
      }),
      'GET /books/b1/chapters/1': { status: 200, body: chapter(1) },
      'GET /books/b1/chapters/2': { status: 200, body: chapter(2) },
      'PUT /books/b1/progress': ({ body }) => {
        saved = body as typeof saved;
        return { status: 200, body: { ...(body as object), updatedAt: '' } };
      },
    });
    renderApp('/book/b1');
    await userEvent.click(await screen.findByRole('link', { name: /The Storm/ }));
    await screen.findByRole('heading', { level: 1, name: 'The Storm' });
    await waitFor(() => expect(saved).not.toBeNull());

    await userEvent.click(screen.getByRole('link', { name: 'Book details' }));
    expect(await screen.findByRole('link', { name: /Continue/ })).toHaveTextContent('The Storm');
  });

  it("titles the browser tab with the book's name", async () => {
    bookApi();
    renderApp('/book/b1');
    await screen.findByRole('heading', { level: 1, name: 'The Lantern Road' });
    expect(document.title).toBe('The Lantern Road · Athenaeum');
  });
});

describe('book page: chapter list', () => {
  it('lists every chapter in order, each opening the reader', async () => {
    bookApi();
    renderApp('/book/b1');
    await screen.findByRole('list', { name: 'Chapters' });
    expect(listed()).toEqual(['The Arrival', 'The Storm', 'The Return']);
    const links = within(screen.getByRole('list', { name: 'Chapters' })).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/read/b1/1', '/read/b1/2', '/read/b1/3']);
  });

  it('marks the chapter you are currently reading', async () => {
    bookApi(detail({ chapterIndex: 1, progress: { chapterIndex: 1, blockIndex: 0, percent: 34, updatedAt: '' } }));
    renderApp('/book/b1');
    await screen.findByRole('list', { name: 'Chapters' });
    const links = within(screen.getByRole('list', { name: 'Chapters' })).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([null, 'step', null]);
  });

  it('filters to read or unread chapters', async () => {
    const book = detail();
    book.chapters[0]!.read = true;
    bookApi(book);
    renderApp('/book/b1');
    await screen.findByRole('list', { name: 'Chapters' });

    await userEvent.click(screen.getByRole('button', { name: 'Unread' }));
    expect(listed()).toEqual(['The Storm', 'The Return']);
    await userEvent.click(screen.getByRole('button', { name: 'Read' }));
    expect(listed()).toEqual(['The Arrival']);
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(listed()).toEqual(['The Arrival', 'The Storm', 'The Return']);
  });

  it('says so when a filter matches nothing', async () => {
    bookApi();
    renderApp('/book/b1');
    await screen.findByRole('list', { name: 'Chapters' });
    await userEvent.click(screen.getByRole('button', { name: 'Read' }));
    expect(screen.getByText('No chapters match.')).toBeInTheDocument();
  });

  it('reverses the order', async () => {
    bookApi();
    renderApp('/book/b1');
    await screen.findByRole('list', { name: 'Chapters' });
    await userEvent.click(screen.getByRole('button', { name: 'Newest first' }));
    expect(listed()).toEqual(['The Return', 'The Storm', 'The Arrival']);
    await userEvent.click(screen.getByRole('button', { name: 'Oldest first' }));
    expect(listed()).toEqual(['The Arrival', 'The Storm', 'The Return']);
  });

  it('searches chapter titles', async () => {
    bookApi();
    renderApp('/book/b1');
    await screen.findByRole('list', { name: 'Chapters' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search chapters' }), 'storm');
    expect(listed()).toEqual(['The Storm']);
  });

  it('marks a chapter read or unread with its checkbox', async () => {
    const api = bookApi();
    renderApp('/book/b1');
    const box = await screen.findByRole('checkbox', { name: 'Mark “The Storm” as read' });
    expect(box).not.toBeChecked();

    await userEvent.click(box);
    await waitFor(() => expect(box).toBeChecked());
    expect(callsTo(api, 'PUT /books/b1/chapters/1/read')).toEqual([{ read: true }]);

    await userEvent.click(box);
    await waitFor(() => expect(box).not.toBeChecked());
    expect(callsTo(api, 'PUT /books/b1/chapters/1/read')).toEqual([{ read: true }, { read: false }]);
  });
});
