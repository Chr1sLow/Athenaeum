import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, mockSignedIn, renderApp } from './test/render.tsx';

describe('app shell (signed in)', () => {
  it('shows the header and the empty shelf', async () => {
    mockSignedIn();
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Your shelf is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Athenaeum' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
  });

  it('focuses the search box on Ctrl+K', async () => {
    mockSignedIn();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(screen.getByPlaceholderText('Search')).toHaveFocus();
  });

  it('shows no warning when the server and database are up', async () => {
    mockSignedIn();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a not-found page for unknown routes', async () => {
    mockSignedIn();
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('connection warnings', () => {
  it('tells you to start Docker when the database is down', async () => {
    mockApi({ 'GET /health': { status: 503, body: { status: 'degraded', db: 'down', time: '' } } });
    renderApp('/login');
    expect(await screen.findByText("Can't reach the database.", { exact: false })).toBeInTheDocument();
  });

  it('tells you to start the server when it is unreachable', async () => {
    mockApi({ 'GET /health': 'network-error', 'GET /auth/me': 'network-error' });
    renderApp('/');
    expect(await screen.findByText("Can't reach the Athenaeum server.", { exact: false })).toBeInTheDocument();
    expect(await screen.findByText("Couldn't check whether you're signed in.")).toBeInTheDocument();
  });
});
