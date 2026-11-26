import type { AdminRow, AdminRowsResponse, AdminTable } from '@athenaeum/shared';
import { type ByRoleOptions, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TEST_USER, callsTo, mockApi, mockSignedIn, renderApp } from '../../test/render.tsx';

const USERS: AdminTable = {
  name: 'users',
  rowCount: 2,
  primaryKey: ['id'],
  columns: [
    { name: 'id', type: 'uuid', nullable: false, editable: false, primaryKey: true },
    { name: 'email', type: 'text', nullable: false, editable: true, primaryKey: false },
    { name: 'is_admin', type: 'boolean', nullable: false, editable: true, primaryKey: false },
    { name: 'created_at', type: 'timestamp', nullable: false, editable: true, primaryKey: false },
  ],
};

const BOOKS: AdminTable = {
  name: 'books',
  rowCount: 120,
  primaryKey: ['id'],
  columns: [
    { name: 'id', type: 'uuid', nullable: false, editable: false, primaryKey: true },
    { name: 'user_id', type: 'uuid', nullable: false, editable: true, primaryKey: false, references: 'users' },
    { name: 'title', type: 'text', nullable: false, editable: true, primaryKey: false },
    { name: 'author', type: 'text', nullable: true, editable: true, primaryKey: false },
    {
      name: 'format',
      type: 'enum',
      nullable: false,
      editable: true,
      primaryKey: false,
      enumValues: ['epub', 'pdf', 'docx', 'txt'],
    },
    { name: 'cover', type: 'binary', nullable: true, editable: false, primaryKey: false },
    { name: 'word_count', type: 'integer', nullable: false, editable: true, primaryKey: false },
  ],
};

const BOOK_ID = '6f1c2a9e-0000-4000-8000-000000000001';
const OWNER_ID = '9b7d3c4f-0000-4000-8000-000000000002';

const USER_ROWS: AdminRow[] = [
  { id: TEST_USER.id, email: TEST_USER.email, is_admin: true, created_at: '2026-11-22T00:00:00.000Z' },
  { id: OWNER_ID, email: 'friend@example.com', is_admin: false, created_at: '2026-11-22T00:00:00.000Z' },
];

const BOOK_ROWS: AdminRow[] = [
  { id: BOOK_ID, user_id: OWNER_ID, title: 'Dune', author: null, format: 'epub', cover: 12_800, word_count: 1000 },
];

const page = (rows: AdminRow[], total = rows.length, n = 1): AdminRowsResponse => ({ rows, total, page: n, pageSize: 50 });

/** An admin's view of the API: two tables, users and books. */
function mockAdmin(handlers: Parameters<typeof mockSignedIn>[0] = {}) {
  return mockSignedIn({
    'GET /admin/tables': { status: 200, body: [USERS, BOOKS] },
    'GET /admin/tables/users/rows': { status: 200, body: page(USER_ROWS) },
    'GET /admin/tables/books/rows': { status: 200, body: page(BOOK_ROWS, 120) },
    ...handlers,
  });
}

/** Query strings of the GET requests sent for `path`, e.g. "/admin/tables/books/rows". */
function queriesTo(fetchMock: ReturnType<typeof mockApi>, path: string) {
  return fetchMock.mock.calls
    .map(([input, init]) => ({ url: new URL(String(input), 'http://localhost'), method: init?.method ?? 'GET' }))
    .filter(({ url, method }) => method === 'GET' && url.pathname === `/api${path}`)
    .map(({ url }) => Object.fromEntries(url.searchParams));
}

/** Opens a row in the right-hand pane by clicking it in the middle list. Returns that pane. */
async function openRow(text: ByRoleOptions['name']) {
  const rows = await screen.findByRole('list', { name: /rows$/ });
  await userEvent.click(await within(rows).findByRole('link', { name: text }));
  return rowPane();
}

/** The right-hand pane that shows one row's fields. */
const rowPane = () => screen.getByRole('region', { name: /^Row / });

/** The value shown next to a field name in the row pane. */
function field(pane: HTMLElement, name: string) {
  return within(pane).getByText(name, { selector: 'dt' }).nextElementSibling as HTMLElement;
}

/** An item of the row pane's "Row actions" menu, or null if the menu doesn't offer it. */
async function rowMenuItem(pane: HTMLElement, name: string) {
  await userEvent.click(within(pane).getByRole('button', { name: 'Row actions' }));
  return screen.queryByRole('menuitem', { name });
}

beforeAll(async () => {
  // /admin loads its page lazily. Import it once up front, so the first test doesn't spend its
  // whole wait compiling the page on a cold run.
  await import('./AdminPage/AdminPage.tsx');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('who can open /admin', () => {
  it('shows "Page not found" to signed-in users who are not admins', async () => {
    mockSignedIn(); // the admin API answers 404, as it does for anyone who isn't an admin
    renderApp('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Tables' })).not.toBeInTheDocument();
    // The browser tab mustn't hint at what the page is, either.
    expect(document.title).toBe('Athenaeum');
  });

  it('titles the tab "Database" for admins', async () => {
    mockAdmin();
    renderApp('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Database' });
    await waitFor(() => expect(document.title).toBe('Database · Athenaeum'));
  });

  it('shows the app header straight away, while the admin page is still loading', async () => {
    mockAdmin();
    renderApp('/admin');
    // Checked synchronously: a router-level lazy route renders a blank page until its code arrives.
    expect(screen.getByRole('banner')).toBeInTheDocument();
    await screen.findByRole('heading', { level: 1, name: 'Database' });
  });

  it("leaves the shelf search out of the header, since it doesn't search the database", async () => {
    mockAdmin();
    const { unmount } = renderApp('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Database' });
    const header = screen.getByRole('banner');
    expect(within(header).queryByRole('searchbox')).not.toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /account/i })).toBeInTheDocument();
    unmount();

    // Everywhere else it's still there.
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    expect(within(screen.getByRole('banner')).getByRole('searchbox', { name: 'Search your shelf' })).toBeInTheDocument();
  });

  it('sends signed-out visitors to sign in first', async () => {
    mockApi();
    const { router } = renderApp('/admin');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/admin')}`);
  });

  it('is never linked from the app, even for admins', async () => {
    mockAdmin();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    await userEvent.click(screen.getByRole('button', { name: /account/i }));
    const hrefs = screen.queryAllByRole('link').map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((h) => h.startsWith('/admin'))).toEqual([]);
  });
});

describe('browsing the database', () => {
  it('lists every table with its row count in the left pane, and the first table in the middle', async () => {
    mockAdmin();
    renderApp('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Database' })).toBeInTheDocument();
    const links = within(screen.getByRole('navigation', { name: 'Tables' })).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/admin?table=users', '/admin?table=books']);
    expect(within(links[0]!).getByText('users')).toBeInTheDocument();
    expect(within(links[1]!).getByText('120')).toBeInTheDocument();
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links[1]).not.toHaveAttribute('aria-current');

    expect(screen.getByRole('heading', { level: 2, name: 'users' })).toBeInTheDocument();
    const rows = await screen.findByRole('list', { name: 'users rows' });
    // Each row shows its id, and its first text column to tell rows apart.
    const friend = within(rows).getByRole('link', { name: /friend@example\.com/ });
    expect(friend).toHaveTextContent(OWNER_ID);
    // No row is open until you pick one.
    expect(screen.getByText('Choose a row to see its fields.')).toBeInTheDocument();
  });

  it('switches tables and remembers the choice in the URL', async () => {
    mockAdmin();
    const { router } = renderApp('/admin');
    const tables = await screen.findByRole('navigation', { name: 'Tables' });
    await userEvent.click(within(tables).getByRole('link', { name: /books/ }));
    expect(await screen.findByRole('list', { name: 'books rows' })).toHaveTextContent('Dune');
    expect(router.state.location.search).toBe('?table=books');
  });

  it("opens a row's fields in the right pane, and remembers it in the URL", async () => {
    mockAdmin();
    const { router } = renderApp('/admin?table=books');
    const pane = await openRow(/Dune/);
    expect(router.state.location.search).toBe(`?table=books&row=${BOOK_ID}`);
    expect(within(pane).getByRole('heading', { level: 2, name: BOOK_ID })).toBeInTheDocument();
    const listed = within(screen.getByRole('list', { name: 'books rows' })).getByRole('link', { name: /Dune/ });
    expect(listed).toHaveAttribute('aria-current', 'true');
    expect(within(pane).getAllByRole('term').map((t) => t.textContent)).toEqual(BOOKS.columns.map((c) => c.name));
    expect(field(pane, 'title')).toHaveTextContent('"Dune"');
    expect(field(pane, 'word_count')).toHaveTextContent('1000');
  });

  it('shows nulls, file sizes, booleans, dates, and links to the rows that ids point to', async () => {
    mockAdmin();
    renderApp(`/admin?table=books&row=${BOOK_ID}`);
    await screen.findByRole('heading', { level: 2, name: BOOK_ID });
    const pane = rowPane();
    expect(field(pane, 'author')).toHaveTextContent('null');
    expect(field(pane, 'cover')).toHaveTextContent('12.5 KB');
    const owner = within(field(pane, 'user_id')).getByRole('link', { name: `Show users row ${OWNER_ID}` });
    expect(owner).toHaveAttribute('href', `/admin?table=users&q=${OWNER_ID}&row=${OWNER_ID}`);

    await userEvent.click(owner);
    const user = await screen.findByRole('region', { name: `Row ${OWNER_ID}` });
    expect(field(user, 'is_admin')).toHaveTextContent('false');
    expect(field(user, 'created_at')).toHaveTextContent('November 22, 2026 at 12:00:00 AM UTC');
  });

  it('shows a breadcrumb trail back to the table and the table list', async () => {
    mockAdmin();
    renderApp(`/admin?table=books&row=${BOOK_ID}`);
    const trail = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(trail).findByText(BOOK_ID)).toHaveAttribute('aria-current', 'page');
    expect(within(trail).getByRole('link', { name: 'All tables' })).toHaveAttribute('href', '/admin');
    expect(within(trail).getByRole('link', { name: 'books' })).toHaveAttribute('href', '/admin?table=books');
  });

  it('searches the table as you type, from the filter panel', async () => {
    const fetchMock = mockAdmin();
    const { router } = renderApp('/admin?table=books');
    await screen.findByRole('list', { name: 'books rows' });
    const toggle = screen.getByRole('button', { name: 'Filter and sort' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('searchbox', { name: 'Search books' })).not.toBeInTheDocument();
    await userEvent.click(toggle);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search books' }), 'dun');
    await waitFor(() => expect(queriesTo(fetchMock, '/admin/tables/books/rows').at(-1)).toEqual({ q: 'dun' }));
    expect(router.state.location.search).toBe('?table=books&q=dun');
  });

  it('keeps the filter panel open when the URL already has a search', async () => {
    mockAdmin();
    renderApp('/admin?table=books&q=dune');
    expect(await screen.findByRole('searchbox', { name: 'Search books' })).toHaveValue('dune');
    expect(screen.getByRole('button', { name: 'Filter and sort' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('says so when nothing matches the search', async () => {
    mockAdmin({ 'GET /admin/tables/books/rows': { status: 200, body: page([]) } });
    renderApp('/admin?table=books&q=zzz');
    expect(await screen.findByText('No rows match “zzz”.')).toBeInTheDocument();
  });

  it('sorts by a column, then reverses it', async () => {
    const fetchMock = mockAdmin();
    renderApp('/admin?table=books');
    await screen.findByRole('list', { name: 'books rows' });
    await userEvent.click(screen.getByRole('button', { name: 'Filter and sort' }));
    const sortBy = screen.getByRole('combobox', { name: 'Sort by' });
    // Binary and JSON columns can't be sorted.
    expect(within(sortBy).queryByRole('option', { name: 'cover' })).not.toBeInTheDocument();
    await userEvent.selectOptions(sortBy, 'title');
    await waitFor(() =>
      expect(queriesTo(fetchMock, '/admin/tables/books/rows').at(-1)).toEqual({ sort: 'title', dir: 'asc' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Descending' }));
    await waitFor(() =>
      expect(queriesTo(fetchMock, '/admin/tables/books/rows').at(-1)).toEqual({ sort: 'title', dir: 'desc' }),
    );
    expect(screen.getByRole('button', { name: 'Descending' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('pages through big tables', async () => {
    const fetchMock = mockAdmin();
    renderApp('/admin?table=books');
    await screen.findByRole('list', { name: 'books rows' });
    expect(screen.getByText('120 rows')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(queriesTo(fetchMock, '/admin/tables/books/rows').at(-1)).toEqual({ page: '2' }));
  });
});

describe('changing the database', () => {
  it('edits a row, sending only the values that changed', async () => {
    const fetchMock = mockAdmin({
      'PATCH /admin/tables/books/rows': ({ body }) => ({
        status: 200,
        body: { ...BOOK_ROWS[0], ...(body as { values: AdminRow }).values },
      }),
    });
    renderApp('/admin?table=books');
    const pane = await openRow(/Dune/);
    await userEvent.click(within(pane).getByRole('button', { name: 'Edit row' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit books row' });
    expect(within(dialog).queryByRole('textbox', { name: 'id' })).not.toBeInTheDocument();
    expect(within(dialog).getByText(BOOK_ID)).toBeInTheDocument();
    const title = within(dialog).getByRole('textbox', { name: 'title' });
    await userEvent.clear(title);
    await userEvent.type(title, 'Dune Messiah');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'author' }), 'Frank Herbert');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: 'format' }), 'pdf');
    const words = within(dialog).getByRole('spinbutton', { name: 'word_count' });
    await userEvent.clear(words);
    await userEvent.type(words, '2000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(fetchMock, 'PATCH /admin/tables/books/rows')).toEqual([
      {
        key: { id: BOOK_ID },
        values: { title: 'Dune Messiah', author: 'Frank Herbert', format: 'pdf', word_count: 2000 },
      },
    ]);
    // The table is reloaded to show the change.
    await waitFor(() => expect(queriesTo(fetchMock, '/admin/tables/books/rows').length).toBeGreaterThan(1));
  });

  it('saves an emptied optional field as NULL, and toggles booleans', async () => {
    const fetchMock = mockAdmin({
      'GET /admin/tables/books/rows': { status: 200, body: page([{ ...BOOK_ROWS[0]!, author: 'F. H.' }]) },
      'PATCH /admin/tables/books/rows': { status: 200, body: BOOK_ROWS[0] },
      'PATCH /admin/tables/users/rows': { status: 200, body: USER_ROWS[1] },
    });
    const { unmount } = renderApp('/admin?table=books');
    await userEvent.click(within(await openRow(/Dune/)).getByRole('button', { name: 'Edit row' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'author' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(callsTo(fetchMock, 'PATCH /admin/tables/books/rows')).toEqual([{ key: { id: BOOK_ID }, values: { author: null } }]),
    );
    unmount();

    renderApp('/admin?table=users');
    await userEvent.click(within(await openRow(/friend@example\.com/)).getByRole('button', { name: 'Edit row' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'is_admin' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(callsTo(fetchMock, 'PATCH /admin/tables/users/rows')).toEqual([
        { key: { id: OWNER_ID }, values: { is_admin: true } },
      ]),
    );
  });

  it("shows the server's reason when a change is refused, and keeps the dialog open", async () => {
    mockAdmin({
      'PATCH /admin/tables/books/rows': { status: 400, body: { error: 'word_count must be a whole number' } },
    });
    renderApp('/admin?table=books');
    await userEvent.click(within(await openRow(/Dune/)).getByRole('button', { name: 'Edit row' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'word_count' }), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('word_count must be a whole number');
    expect(screen.getByRole('dialog', { name: 'Edit books row' })).toBeInTheDocument();
  });

  it('deletes a row after you confirm, then closes it', async () => {
    const fetchMock = mockAdmin({ 'DELETE /admin/tables/books/rows': { status: 204 } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { router } = renderApp('/admin?table=books');
    const pane = await openRow(/Dune/);

    await userEvent.click((await rowMenuItem(pane, 'Delete row'))!);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Delete this row from books?'));
    expect(callsTo(fetchMock, 'DELETE /admin/tables/books/rows')).toEqual([]);

    await userEvent.click((await rowMenuItem(pane, 'Delete row'))!);
    await waitFor(() => expect(callsTo(fetchMock, 'DELETE /admin/tables/books/rows')).toEqual([{ key: { id: BOOK_ID } }]));
    await waitFor(() => expect(router.state.location.search).toBe('?table=books'));
  });

  it('gives a user a temporary password and shows it to you', async () => {
    const fetchMock = mockAdmin({
      [`POST /admin/users/${OWNER_ID}/reset-password`]: { status: 200, body: { password: 'tmp-Pass-1234567' } },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/admin?table=users');
    await userEvent.click((await rowMenuItem(await openRow(/friend@example\.com/), 'Reset password'))!);
    const dialog = await screen.findByRole('dialog', { name: 'Temporary password' });
    expect(within(dialog).getByText('tmp-Pass-1234567')).toBeInTheDocument();
    expect(within(dialog).getByText(/friend@example\.com/)).toBeInTheDocument();
    expect(callsTo(fetchMock, `POST /admin/users/${OWNER_ID}/reset-password`)).toHaveLength(1);
  });

  it("won't let you delete your own account or reset your own password from here", async () => {
    mockAdmin();
    renderApp('/admin?table=users');
    const pane = await openRow((name) => name.includes(TEST_USER.email));
    expect(within(pane).getByRole('button', { name: 'Edit row' })).toBeEnabled();
    expect(await rowMenuItem(pane, 'Delete row')).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Reset password' })).toBeDisabled();
  });

  it('offers no password reset outside the users table', async () => {
    mockAdmin();
    renderApp('/admin?table=books');
    const pane = await openRow(/Dune/);
    expect(await rowMenuItem(pane, 'Reset password')).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Delete row' })).toBeInTheDocument();
  });
});
