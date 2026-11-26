import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '../../api/queryClient.ts';
import { summary } from '../../test/books.ts';
import { mockSignedIn } from '../../test/render.tsx';
import { CreateCollectionButton } from './CreateCollectionButton.tsx';

function renderButton() {
  mockSignedIn({
    'GET /books': { status: 200, body: [summary({ id: 'b1', title: 'Dune' }), summary({ id: 'b2', title: 'Emma' })] },
  });
  render(
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      <MemoryRouter>
        <CreateCollectionButton />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreateCollectionButton', () => {
  it('is a "New collection" button that opens the dialog, offering the books on the shelf', async () => {
    renderButton();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New collection' }));
    const dialog = screen.getByRole('dialog', { name: 'New collection' });
    expect(await within(dialog).findByRole('checkbox', { name: 'Dune' })).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Emma' })).toBeInTheDocument();
  });

  it('closes the dialog on Cancel, and can open it again', async () => {
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: 'New collection' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New collection' }));
    expect(screen.getByRole('dialog', { name: 'New collection' })).toBeInTheDocument();
  });
});
