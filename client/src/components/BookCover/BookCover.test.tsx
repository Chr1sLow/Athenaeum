import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookCover } from './BookCover.tsx';

describe('BookCover', () => {
  it('shows the uploaded cover image', () => {
    render(<BookCover book={{ id: 'b1', title: 'Dune', hasCover: true }} />);
    const img = screen.getByRole('img', { name: 'Cover of Dune' });
    expect(img).toHaveAttribute('src', '/api/books/b1/cover');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('can be decorative when the title is already shown next to it', () => {
    const { container } = render(<BookCover decorative book={{ id: 'b1', title: 'Dune', hasCover: true }} />);
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('falls back to a generated cover with the title', () => {
    render(<BookCover book={{ id: 'b1', title: 'The Lantern Road', hasCover: false }} />);
    expect(screen.getByTestId('generated-cover')).toHaveTextContent('The Lantern Road');
  });
});
