import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../api/queryClient.ts';
import { mockSignedIn } from '../../test/render.tsx';
import { UploadProvider } from '../UploadProvider/UploadProvider.tsx';
import { UploadButton } from './UploadButton.tsx';

describe('UploadButton', () => {
  it('is an "Add book" button that opens the file picker', async () => {
    mockSignedIn();
    render(
      <QueryClientProvider client={createQueryClient({ retry: false })}>
        <UploadProvider>
          <UploadButton />
        </UploadProvider>
      </QueryClientProvider>,
    );
    const pickerClick = vi.spyOn(await screen.findByLabelText('Add books'), 'click');

    await userEvent.click(screen.getByRole('button', { name: 'Add book' }));
    expect(pickerClick).toHaveBeenCalledTimes(1);
  });
});
