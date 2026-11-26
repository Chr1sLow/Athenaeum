import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../../api/auth.ts';
import { TEST_USER, callsTo, mockApi, mockSignedIn, renderApp } from '../../test/render.tsx';

const ok = { status: 200, body: { user: TEST_USER } };

async function fillAndSubmit(email: string, password: string, submit: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: submit }));
  return user;
}

describe('route guard', () => {
  it('sends signed-out visitors to the login page', async () => {
    mockApi();
    const { router } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
  });

  it('remembers the page you wanted and returns you there after logging in', async () => {
    const fetchMock = mockApi({ 'POST /auth/login': ok });
    const { router } = renderApp('/book/abc');
    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.search).toBe('?next=%2Fbook%2Fabc');

    await fillAndSubmit('reader@example.com', 'correct horse', 'Log in');
    await waitFor(() => expect(router.state.location.pathname).toBe('/book/abc'));
    expect(callsTo(fetchMock, 'POST /auth/login')).toEqual([
      { email: 'reader@example.com', password: 'correct horse' },
    ]);
  });

  it('skips the login page when you are already signed in', async () => {
    mockSignedIn();
    const { router } = renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Your shelf is empty' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('login', () => {
  it('lands on the shelf after a successful login', async () => {
    mockApi({ 'POST /auth/login': ok });
    renderApp('/login');
    await fillAndSubmit('reader@example.com', 'correct horse', 'Log in');
    expect(await screen.findByRole('heading', { name: 'Your shelf is empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toHaveTextContent('R');
  });

  it("shows the server's error for a wrong password", async () => {
    mockApi({ 'POST /auth/login': { status: 401, body: { error: 'Invalid email or password' } } });
    renderApp('/login');
    await fillAndSubmit('reader@example.com', 'wrong', 'Log in');
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('can show and hide the password', async () => {
    mockApi();
    renderApp('/login');
    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});

describe('signup', () => {
  it('checks the password length before sending anything', async () => {
    const fetchMock = mockApi();
    renderApp('/signup');
    await fillAndSubmit('new@example.com', 'short', 'Create account');
    expect(await screen.findByRole('alert')).toHaveTextContent('Password must be at least 8 characters');
    expect(callsTo(fetchMock, 'POST /auth/signup')).toHaveLength(0);
  });

  it('creates the account and lands on the shelf', async () => {
    const fetchMock = mockApi({ 'POST /auth/signup': { status: 201, body: { user: TEST_USER } } });
    renderApp('/signup');
    await fillAndSubmit('reader@example.com', 'long enough password', 'Create account');
    expect(await screen.findByRole('heading', { name: 'Your shelf is empty' })).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST /auth/signup')).toEqual([
      { email: 'reader@example.com', password: 'long enough password' },
    ]);
  });

  it('shows a duplicate-email error from the server', async () => {
    mockApi({ 'POST /auth/signup': { status: 409, body: { error: 'An account with that email already exists' } } });
    renderApp('/signup');
    await fillAndSubmit('reader@example.com', 'long enough password', 'Create account');
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with that email already exists');
  });

  it('keeps the return path when switching between log in and sign up', async () => {
    mockApi();
    renderApp('/login?next=%2Fbook%2Fabc');
    const link = await screen.findByRole('link', { name: 'Create an account' });
    expect(link).toHaveAttribute('href', '/signup?next=%2Fbook%2Fabc');
  });
});

describe('sign out', () => {
  it('signs out from the account menu and returns to the login page', async () => {
    let signedIn = true;
    const fetchMock = mockApi({
      'GET /auth/me': () => (signedIn ? ok : { status: 200, body: { user: null } }),
      'POST /auth/logout': () => {
        signedIn = false;
        return { status: 204 };
      },
    });
    const { router } = renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menu')).toHaveTextContent(TEST_USER.email);
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(callsTo(fetchMock, 'POST /auth/logout')).toHaveLength(1);
  });

  it('closes the account menu with Escape', async () => {
    mockSignedIn();
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('safeNextPath', () => {
  it('only allows paths on this site', () => {
    expect(safeNextPath('/book/1')).toBe('/book/1');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
  });
});
