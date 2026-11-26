import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSkeleton } from './PageSkeleton.tsx';

describe('PageSkeleton', () => {
  it('is a busy status named by its label', () => {
    render(<PageSkeleton label="Loading book" />);
    const status = screen.getByRole('status', { name: 'Loading book' });
    expect(status).toHaveAttribute('aria-busy', 'true');
  });
});
