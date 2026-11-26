import type { BookSummary } from '@athenaeum/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectionSummary, summary } from '../../test/books.ts';
import { callsTo, mockSignedIn, renderApp } from '../../test/render.tsx';

describe('shelf', () => {
  it('shows each book as a card with its title, author and format', async () => {
    mockSignedIn({
      'GET /books': {
        status: 200,
        body: [summary({ id: 'b1', title: 'The Lantern Road', format: 'epub' }), summary({ id: 'b2', title: 'Paper Moons', author: null, format: 'pdf' })],
      },
    });
    renderApp('/');
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByRole('heading', { name: 'The Lantern Road' })).toBeInTheDocument();
    expect(within(cards[0]!).getByText('Mara Quill')).toBeInTheDocument();
    expect(within(cards[0]!).getByText('EPUB')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('PDF')).toBeInTheDocument();
  });

  it('shows how far you have read, only once you have started', async () => {
    mockSignedIn({
      'GET /books': { status: 200, body: [summary({ id: 'b1', percent: 45.4 }), summary({ id: 'b2', title: 'Unread', percent: 0 })] },
    });
    renderApp('/');
    const [started, unread] = await screen.findAllByRole('article');
    expect(within(started!).getByText('45%')).toBeInTheDocument();
    expect(within(unread!).queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("uses the book's cover image when it has one", async () => {
    mockSignedIn({ 'GET /books': { status: 200, body: [summary({ id: 'b1', hasCover: true })] } });
    renderApp('/');
    const card = await screen.findByRole('article');
    expect(within(card).getByRole('img', { name: 'Cover of The Lantern Road' })).toHaveAttribute('src', '/api/books/b1/cover');
  });

  it('draws a title cover for books without an image', async () => {
    mockSignedIn({ 'GET /books': { status: 200, body: [summary({ id: 'b1', hasCover: false })] } });
    renderApp('/');
    const card = await screen.findByRole('article');
    expect(within(card).queryByRole('img', { name: /Cover of/ })).not.toBeInTheDocument();
    expect(within(card).getByTestId('generated-cover')).toHaveTextContent('The Lantern Road');
  });

  it("opens the book's page with its chapter list", async () => {
    mockSignedIn({ 'GET /books': { status: 200, body: [summary({ id: 'b1', chapterIndex: 2 })] } });
    renderApp('/');
    const card = await screen.findByRole('article');
    expect(within(card).getByRole('link')).toHaveAttribute('href', '/book/b1');
  });

  it('shows the empty state when there are no books', async () => {
    mockSignedIn({ 'GET /books': { status: 200, body: [] } });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Your shelf is empty' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

describe('deleting a book', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Two books, both in "Favorites". DELETE /books/b1 succeeds (or fails with `deleteReply`) and the server state follows. */
  function shelfApi(deleteReply?: { status: number; body?: unknown }) {
    let shelf: BookSummary[] = [summary({ id: 'b1', title: 'The Lantern Road' }), summary({ id: 'b2', title: 'Paper Moons' })];
    const favorites = () =>
      collectionSummary({ bookCount: shelf.length, previewBooks: shelf.map((b) => ({ id: b.id, title: b.title, hasCover: false })) });
    return mockSignedIn({
      'GET /books': () => ({ status: 200, body: shelf }),
      'GET /collections': () => ({ status: 200, body: [favorites()] }),
      'DELETE /books/b1': () => {
        if (deleteReply) return deleteReply;
        shelf = shelf.filter((b) => b.id !== 'b1');
        return { status: 204 };
      },
    });
  }

  async function openMenu(title: string) {
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: `Options for ${title}` }));
    return screen.getByRole('menu', { name: `Options for ${title}` });
  }

  it('gives each book an options menu with Delete in it', async () => {
    shelfApi();
    renderApp('/');
    const cards = await screen.findAllByRole('article');
    expect(within(cards[0]!).getByRole('button', { name: 'Options for The Lantern Road' })).toBeInTheDocument();
    expect(within(cards[1]!).getByRole('button', { name: 'Options for Paper Moons' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(within(cards[0]!).getByRole('button', { name: 'Options for The Lantern Road' }));
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('deletes the book after you confirm, and takes it off the shelf and out of its collections', async () => {
    const api = shelfApi();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const menu = await openMenu('The Lantern Road');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('The Lantern Road'));
    await waitFor(() => expect(callsTo(api, 'DELETE /books/b1')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'The Lantern Road' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Paper Moons' })).toBeInTheDocument();
    // The collection card refetches: it now holds one book.
    const collections = screen.getByRole('region', { name: 'Your Collections' });
    expect(await within(collections).findByText('1 book')).toBeInTheDocument();
  });

  it('keeps the book when you cancel', async () => {
    const api = shelfApi();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const menu = await openMenu('The Lantern Road');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }));

    expect(callsTo(api, 'DELETE /books/b1')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'The Lantern Road' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it("says why when the server can't delete it, and keeps it on the shelf", async () => {
    shelfApi({ status: 500, body: { error: 'Something went wrong.' } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const menu = await openMenu('The Lantern Road');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('Something went wrong.')));
    expect(screen.getByRole('heading', { name: 'The Lantern Road' })).toBeInTheDocument();
  });
});
