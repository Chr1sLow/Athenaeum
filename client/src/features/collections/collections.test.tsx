import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectionDetail, collectionSummary, detail, summary } from '../../test/books.ts';
import { callsTo, mockSignedIn, renderApp } from '../../test/render.tsx';

const SHELF = [
  summary({ id: 'b1', title: 'Dune' }),
  summary({ id: 'b2', title: 'Emma' }),
  summary({ id: 'b3', title: 'Ivanhoe' }),
  summary({ id: 'b4', title: 'anna karenina' }),
];

/** The book tabs on a collection page, in the order shown. */
const tabsShown = () => screen.getAllByRole('tab').map((t) => t.textContent);

/** Full details for a book in the collection, each with its own chapters. */
const bookDetail = (id: string, title: string) =>
  detail({
    id,
    title,
    chapters: [1, 2].map((n, index) => ({ index, title: `${title} chapter ${n}`, wordCount: 500, read: false })),
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collections on the shelf', () => {
  it('shows each collection with its name, size and a link inside', async () => {
    mockSignedIn({
      'GET /books': { status: 200, body: SHELF },
      'GET /collections': { status: 200, body: [collectionSummary(), collectionSummary({ id: 'c2', name: 'Classics', bookCount: 1 })] },
    });
    renderApp('/');
    const section = await screen.findByRole('region', { name: 'Your Collections' });
    const links = await within(section).findAllByRole('link');
    expect(links.map((a) => [a.getAttribute('href'), a.textContent])).toEqual([
      ['/collections/c1', expect.stringContaining('Favorites')],
      ['/collections/c2', expect.stringContaining('Classics')],
    ]);
    expect(within(links[0]!).getByText('2 books')).toBeInTheDocument();
    expect(within(links[1]!).getByText('1 book')).toBeInTheDocument();
  });

  it('shows the covers of the books inside', async () => {
    mockSignedIn({ 'GET /books': { status: 200, body: SHELF }, 'GET /collections': { status: 200, body: [collectionSummary()] } });
    renderApp('/');
    const section = await screen.findByRole('region', { name: 'Your Collections' });
    const card = await within(section).findByRole('link');
    expect(within(card).getByRole('img', { name: 'Cover of Dune' })).toHaveAttribute('src', '/api/books/b1/cover');
  });

  it('invites you to make one when you have none yet', async () => {
    mockSignedIn({ 'GET /books': { status: 200, body: SHELF }, 'GET /collections': { status: 200, body: [] } });
    renderApp('/');
    const section = await screen.findByRole('region', { name: 'Your Collections' });
    expect(await within(section).findByText(/Group novels into collections/)).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'New collection' })).toBeInTheDocument();
  });

  it('is hidden while the shelf has no books', async () => {
    mockSignedIn({ 'GET /books': { status: 200, body: [] }, 'GET /collections': { status: 200, body: [] } });
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    expect(screen.queryByRole('region', { name: 'Your Collections' })).not.toBeInTheDocument();
  });
});

describe('creating a collection', () => {
  function createApi(reply: object = { status: 201, body: collectionSummary({ id: 'c9', name: 'Favorites' }) }) {
    return mockSignedIn({
      'GET /books': { status: 200, body: SHELF },
      'GET /collections': { status: 200, body: [] },
      'POST /collections': reply as never,
      'GET /collections/c9': { status: 200, body: collectionDetail({ id: 'c9', books: [] }) },
    });
  }

  async function openDialog() {
    renderApp('/');
    const section = await screen.findByRole('region', { name: 'Your Collections' });
    await userEvent.click(await within(section).findByRole('button', { name: 'New collection' }));
    return screen.getByRole('dialog', { name: 'New collection' });
  }

  it('names the collection, puts the ticked books in it, and opens it', async () => {
    const api = createApi();
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Favorites');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Dune' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Emma' }));
    expect(within(dialog).getByText('2 selected')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create collection' }));

    await waitFor(() => expect(callsTo(api, 'POST /collections')).toEqual([{ name: 'Favorites', bookIds: ['b1', 'b2'] }]));
    expect(await screen.findByRole('heading', { level: 1, name: 'Favorites' })).toBeInTheDocument();
  });

  it('asks for a name before sending anything', async () => {
    const api = createApi();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create collection' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Give the collection a name');
    expect(callsTo(api, 'POST /collections')).toHaveLength(0);
  });

  it("shows the server's reason when the name is taken", async () => {
    createApi({ status: 409, body: { error: 'You already have a collection called “Favorites”.' } });
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Favorites');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create collection' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already have a collection');
  });

  it('filters the book list by title', async () => {
    createApi();
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Filter books' }), 'iva');
    expect(within(dialog).getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Ivanhoe']);
  });

  it('closes with Escape without saving', async () => {
    const api = createApi();
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Draft');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callsTo(api, 'POST /collections')).toHaveLength(0);
  });
});

describe('inside a collection', () => {
  function collectionApi(detail = collectionDetail()) {
    return mockSignedIn({
      'GET /books': { status: 200, body: SHELF },
      'GET /collections': { status: 200, body: [collectionSummary()] },
      'GET /collections/c1': { status: 200, body: detail },
      'GET /books/b1': { status: 200, body: bookDetail('b1', 'Dune') },
      'GET /books/b2': { status: 200, body: bookDetail('b2', 'Emma') },
      'GET /books/b4': { status: 200, body: bookDetail('b4', 'anna karenina') },
      'PATCH /collections/c1': ({ body }) => ({ status: 200, body: collectionSummary(body as object) }),
      'PUT /collections/c1/books': { status: 200, body: collectionSummary() },
      'DELETE /collections/c1': { status: 204 },
    });
  }

  it('shows the name and how many books it holds', async () => {
    collectionApi();
    renderApp('/collections/c1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Favorites' })).toBeInTheDocument();
    expect(screen.getByText('3 books')).toBeInTheDocument();
  });

  it('has a tab for each book, ordered by date added (newest first) by default', async () => {
    collectionApi();
    renderApp('/collections/c1');
    await screen.findByRole('heading', { level: 1, name: 'Favorites' });
    expect(screen.getByRole('button', { name: 'Date added' })).toHaveAttribute('aria-pressed', 'true');
    expect(tabsShown()).toEqual(['Dune', 'Emma', 'anna karenina']);
  });

  it('orders the tabs alphabetically, ignoring capitalization', async () => {
    collectionApi();
    renderApp('/collections/c1');
    await screen.findByRole('heading', { level: 1, name: 'Favorites' });
    await userEvent.click(screen.getByRole('button', { name: 'A–Z' }));
    expect(tabsShown()).toEqual(['anna karenina', 'Dune', 'Emma']);
    await userEvent.click(screen.getByRole('button', { name: 'Date added' }));
    expect(tabsShown()).toEqual(['Dune', 'Emma', 'anna karenina']);
  });

  it("opens on the first tab, showing that book's details and chapter list", async () => {
    collectionApi();
    renderApp('/collections/c1');
    const panel = await screen.findByRole('tabpanel', { name: 'Dune' });
    expect(screen.getByRole('tab', { name: 'Dune' })).toHaveAttribute('aria-selected', 'true');
    expect(await within(panel).findByRole('heading', { level: 2, name: 'Dune' })).toBeInTheDocument();
    expect(await within(panel).findByRole('link', { name: /Start reading/ })).toHaveAttribute('href', '/read/b1/1');
    const chapters = within(panel).getByRole('list', { name: 'Chapters' });
    expect(within(chapters).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/read/b1/1', '/read/b1/2']);
    expect(within(chapters).getByText('Dune chapter 1')).toBeInTheDocument();
  });

  it("switches to another book's chapters when you pick its tab", async () => {
    collectionApi();
    const { router } = renderApp('/collections/c1');
    await screen.findByRole('tabpanel', { name: 'Dune' });
    await userEvent.click(screen.getByRole('tab', { name: 'Emma' }));

    const panel = await screen.findByRole('tabpanel', { name: 'Emma' });
    expect(await within(panel).findByText('Emma chapter 2')).toBeInTheDocument();
    expect(within(panel).queryByText('Dune chapter 1')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Emma' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Dune' })).toHaveAttribute('aria-selected', 'false');
    expect(router.state.location.search).toBe('?book=b2');
  });

  it('remembers the chosen tab in the address', async () => {
    collectionApi();
    renderApp('/collections/c1?book=b4');
    const panel = await screen.findByRole('tabpanel', { name: 'anna karenina' });
    expect(await within(panel).findByText('anna karenina chapter 1')).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    collectionApi();
    renderApp('/collections/c1');
    await screen.findByRole('tabpanel', { name: 'Dune' });
    screen.getByRole('tab', { name: 'Dune' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Emma' })).toHaveFocus();
    expect(await screen.findByRole('tabpanel', { name: 'Emma' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'anna karenina' })).toHaveFocus();
  });

  it('keeps the collection name as the only top-level heading', async () => {
    collectionApi();
    renderApp('/collections/c1');
    await screen.findByRole('tabpanel', { name: 'Dune' });
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Favorites']);
  });

  it('says so when it is empty', async () => {
    collectionApi(collectionDetail({ books: [] }));
    renderApp('/collections/c1');
    expect(await screen.findByText('No books in this collection yet.')).toBeInTheDocument();
  });

  it('renames it and changes which books it holds', async () => {
    const api = collectionApi();
    renderApp('/collections/c1');
    await screen.findByRole('heading', { level: 1, name: 'Favorites' });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit collection' });
    const nameField = within(dialog).getByLabelText('Name');
    expect(nameField).toHaveValue('Favorites');
    expect(within(dialog).getByRole('checkbox', { name: 'Dune' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Ivanhoe' })).not.toBeChecked();

    await userEvent.clear(nameField);
    await userEvent.type(nameField, 'Best Of');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Dune' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Ivanhoe' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(api, 'PATCH /collections/c1')).toEqual([{ name: 'Best Of' }]);
    expect(callsTo(api, 'PUT /collections/c1/books')).toEqual([{ bookIds: ['b2', 'b3', 'b4'] }]);
  });

  it('only sends what changed', async () => {
    const api = collectionApi();
    renderApp('/collections/c1');
    await screen.findByRole('heading', { level: 1, name: 'Favorites' });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit collection' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Ivanhoe' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(api, 'PUT /collections/c1/books')).toHaveLength(1));
    expect(callsTo(api, 'PATCH /collections/c1')).toHaveLength(0);
  });

  it('deletes it after you confirm, and returns to the shelf', async () => {
    const api = collectionApi();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { router } = renderApp('/collections/c1');
    await screen.findByRole('heading', { level: 1, name: 'Favorites' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('The books stay on your shelf'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(callsTo(api, 'DELETE /collections/c1')).toHaveLength(1);
  });

  it('keeps it when you cancel the delete', async () => {
    const api = collectionApi();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp('/collections/c1');
    await screen.findByRole('heading', { level: 1, name: 'Favorites' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(callsTo(api, 'DELETE /collections/c1')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Favorites' })).toBeInTheDocument();
  });

  it('says so when the collection does not exist', async () => {
    mockSignedIn({ 'GET /collections/nope': { status: 404, body: { error: 'Collection not found' } } });
    renderApp('/collections/nope');
    expect(await screen.findByText("This collection doesn't exist.")).toBeInTheDocument();
  });
});
