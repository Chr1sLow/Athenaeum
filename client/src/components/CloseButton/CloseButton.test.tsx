import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CloseButton } from './CloseButton.tsx';

describe('CloseButton', () => {
  it('is named "Close" unless told otherwise, and calls onClick', async () => {
    const onClick = vi.fn();
    render(<CloseButton onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('takes a more specific label', () => {
    render(<CloseButton label="Dismiss uploads" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Dismiss uploads' })).toBeInTheDocument();
  });
});
