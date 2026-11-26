import type { Chapter } from '@athenaeum/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chapter, detail } from '../../test/books.ts';
import { callsTo, mockSignedIn, renderApp } from '../../test/render.tsx';

function readerApi(opts: { chapters?: Record<number, Chapter>; progress?: object | null; read?: boolean[] } = {}) {
  const book = detail({
    progress: (opts.progress as never) ?? null,
    chapters: detail().chapters.map((c, i) => ({ ...c, read: opts.read?.[i] ?? false })),
  });
  return mockSignedIn({
    'GET /books/b1': { status: 200, body: book },
    'GET /books/b1/chapters/0': { status: 200, body: opts.chapters?.[0] ?? chapter(0) },
    'GET /books/b1/chapters/1': { status: 200, body: opts.chapters?.[1] ?? chapter(1) },
    'GET /books/b1/chapters/2': { status: 200, body: opts.chapters?.[2] ?? chapter(2) },
    'PUT /books/b1/progress': ({ body }) => ({ status: 200, body: { ...(body as object), updatedAt: '' } }),
    'PUT /books/b1/chapters/0/read': { status: 204 },
    'PUT /books/b1/chapters/1/read': { status: 204 },
    'PUT /books/b1/chapters/2/read': { status: 204 },
  });
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as never;
});

describe('reader: chapter text', () => {
  it('shows the chapter title, its length and reading time, then the text', async () => {
    readerApi();
    renderApp('/read/b1/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'The Arrival' })).toBeInTheDocument();
    expect(screen.getByText('944 words · 4 min')).toBeInTheDocument();
    expect(screen.getByText('Opening line of chapter 1.')).toBeInTheDocument();
    expect(screen.getByText('She walked on.')).toBeInTheDocument();
  });

  it('renders italics, section headings, scene breaks and illustrations', async () => {
    readerApi({
      chapters: {
        0: chapter(0, {
          blocks: [
            { type: 'p', text: 'She whispered, run.', html: 'She <em>whispered</em>, run.' },
            { type: 'h', level: 2, text: 'Later' },
            { type: 'hr' },
            { type: 'img', imageId: 'img-1', alt: 'A map of the valley' },
          ],
        }),
      },
    });
    renderApp('/read/b1/1');
    expect(await screen.findByText('whispered', { selector: 'em' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Later' })).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'A map of the valley' })).toHaveAttribute('src', '/api/books/b1/images/img-1');
  });

  it("lists the chapter's footnotes after its text, with their numbers raised in the text", async () => {
    readerApi({
      chapters: {
        0: chapter(0, {
          blocks: [
            { type: 'p', text: 'A dokkaebi7 appeared.', html: 'A dokkaebi<sup>7</sup> appeared.' },
            { type: 'p', text: 'Is this AR8?', html: 'Is this AR<sup>8</sup>?' },
            { type: 'note', label: '7', text: 'Dokkaebi are Korean goblins.' },
            { type: 'note', label: '8', text: 'AR is augmented reality.', html: '<em>AR</em> is augmented reality.' },
          ],
        }),
      },
    });
    renderApp('/read/b1/1');
    expect(await screen.findByText('7', { selector: 'sup' })).toBeInTheDocument();

    const notes = screen.getByRole('region', { name: 'Notes' });
    const items = within(notes).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['7 Dokkaebi are Korean goblins.', '8 AR is augmented reality.']);
    expect(within(items[1]!).getByText('AR', { selector: 'em' })).toBeInTheDocument();
    // After the text, and still tracked for "where you left off" like any other block.
    const lastParagraph = screen.getByText(/Is this AR/);
    expect(lastParagraph.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(items.map((li) => li.getAttribute('data-block'))).toEqual(['2', '3']);
  });

  it('shows no notes section for a chapter without notes', async () => {
    readerApi();
    renderApp('/read/b1/1');
    await screen.findByText('She walked on.');
    expect(screen.queryByRole('region', { name: 'Notes' })).not.toBeInTheDocument();
  });

  it('shows a message for a chapter number past the end of the book', async () => {
    readerApi();
    renderApp('/read/b1/9');
    expect(await screen.findByText('This book has no chapter 9.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to chapter 1' })).toHaveAttribute('href', '/read/b1/1');
  });
});

describe('reader: chapter illustrations', () => {
  const withGallery = () =>
    readerApi({
      chapters: {
        0: chapter(0, {
          gallery: [
            { imageId: 'pic-1', width: 1106, height: 1600 },
            { imageId: 'pic-2', width: 1600, height: 1100 },
          ],
        }),
      },
    });

  it('opens a grid of the chapter illustrations from a button in the corner', async () => {
    withGallery();
    renderApp('/read/b1/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Chapter images (2)' }));
    const gallery = screen.getByRole('dialog', { name: 'Chapter images' });
    const thumbs = within(gallery).getAllByRole('button', { name: /^View image/ });
    expect(thumbs.map((t) => t.getAttribute('aria-label'))).toEqual(['View image 1 of 2', 'View image 2 of 2']);
    // The thumbnail picture is decorative (the button carries the name), so it has no img role.
    expect(thumbs[1]!.querySelector('img')).toHaveAttribute('src', '/api/books/b1/images/pic-2');
  });

  it('opens an illustration larger, and steps through them without changing chapter', async () => {
    withGallery();
    const { router } = renderApp('/read/b1/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Chapter images (2)' }));
    await userEvent.click(screen.getByRole('button', { name: 'View image 1 of 2' }));

    const viewer = screen.getByRole('dialog', { name: 'Image 1 of 2' });
    expect(within(viewer).getByRole('img', { name: 'Image 1 of 2' })).toHaveAttribute('src', '/api/books/b1/images/pic-1');
    expect(within(viewer).getByRole('button', { name: 'Previous image' })).toBeDisabled();
    await userEvent.click(within(viewer).getByRole('button', { name: 'Next image' }));
    expect(screen.getByRole('dialog', { name: 'Image 2 of 2' })).toBeInTheDocument();

    // The arrow keys move between pictures here, not between chapters.
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('dialog', { name: 'Image 1 of 2' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('dialog', { name: 'Image 2 of 2' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/read/b1/1');

    // Escape goes back to the grid, then closes it.
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Chapter images' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(router.state.location.pathname).toBe('/read/b1/1');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no gallery button for a chapter without illustrations', async () => {
    readerApi();
    renderApp('/read/b1/1');
    await screen.findByText('She walked on.');
    expect(screen.queryByRole('button', { name: /Chapter images/ })).not.toBeInTheDocument();
  });
});

describe('reader: moving between chapters', () => {
  it('goes to the next chapter and marks the one you finished as read', async () => {
    const api = readerApi();
    const { router } = renderApp('/read/b1/1');
    await screen.findByRole('heading', { level: 1, name: 'The Arrival' });

    await userEvent.click(screen.getByRole('link', { name: /Next chapter/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Storm' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/read/b1/2');
    await waitFor(() => expect(callsTo(api, 'PUT /books/b1/chapters/0/read')).toEqual([{ read: true }]));
  });

  it('has no previous link on the first chapter and no next link on the last', async () => {
    readerApi();
    const first = renderApp('/read/b1/1');
    await screen.findByRole('heading', { level: 1, name: 'The Arrival' });
    expect(screen.queryByRole('link', { name: /Previous chapter/ })).not.toBeInTheDocument();
    first.unmount();

    renderApp('/read/b1/3');
    await screen.findByRole('heading', { level: 1, name: 'The Return' });
    expect(screen.queryByRole('link', { name: /Next chapter/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Back to shelf' }).length).toBeGreaterThan(0);
  });

  it('changes chapter with the arrow keys', async () => {
    readerApi();
    const { router } = renderApp('/read/b1/2');
    await screen.findByRole('heading', { level: 1, name: 'The Storm' });
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/read/b1/3'));
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/read/b1/2'));
  });

  it('lists every chapter in a side panel, marking the current one and the ones you have read', async () => {
    readerApi({ read: [true, false, false] });
    const { router } = renderApp('/read/b1/2');
    await screen.findByRole('heading', { level: 1, name: 'The Storm' });

    await userEvent.click(screen.getByRole('button', { name: 'Chapters' }));
    const panel = screen.getByRole('dialog', { name: 'The Lantern Road' });
    const items = within(panel).getAllByRole('link');
    expect(items.map((a) => a.textContent)).toEqual([
      expect.stringContaining('The Arrival'),
      expect.stringContaining('The Storm'),
      expect.stringContaining('The Return'),
    ]);
    expect(items[1]).toHaveAttribute('aria-current', 'page');
    expect(within(items[0]!).getByLabelText('Read')).toBeInTheDocument();

    await userEvent.click(items[2]!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/read/b1/3'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the chapter panel with Escape', async () => {
    readerApi();
    renderApp('/read/b1/1');
    await screen.findByRole('heading', { level: 1, name: 'The Arrival' });
    await userEvent.click(screen.getByRole('button', { name: 'Chapters' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has a way back to the shelf', async () => {
    readerApi();
    renderApp('/read/b1/1');
    await screen.findByRole('heading', { level: 1, name: 'The Arrival' });
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it("has a way back to the book's chapter list", async () => {
    readerApi();
    renderApp('/read/b1/2');
    await screen.findByRole('heading', { level: 1, name: 'The Storm' });
    expect(screen.getByRole('link', { name: 'Book details' })).toHaveAttribute('href', '/book/b1');
  });
});

describe('reader: remembering your place', () => {
  it('saves your position when you open a chapter', async () => {
    const api = readerApi();
    renderApp('/read/b1/2');
    await screen.findByRole('heading', { level: 1, name: 'The Storm' });
    await waitFor(() => expect(callsTo(api, 'PUT /books/b1/progress')).toHaveLength(1));
    const [saved] = callsTo(api, 'PUT /books/b1/progress');
    expect(saved.chapterIndex).toBe(1);
    expect(saved.blockIndex).toBe(0);
    expect(saved.percent).toBeCloseTo(33.33, 1);
  });

  it('scrolls back to the paragraph you were reading', async () => {
    readerApi({
      progress: { chapterIndex: 1, blockIndex: 1, percent: 50, updatedAt: '' },
    });
    renderApp('/read/b1/2');
    const target = await screen.findByText('She walked on.');
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    const scrolled = vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1) as Element;
    expect(scrolled).toBe(target.closest('[data-block]'));
  });
});
