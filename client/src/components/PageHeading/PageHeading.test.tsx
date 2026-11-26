import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeading } from './PageHeading.tsx';

describe('PageHeading', () => {
  it('renders the title as an h1 by default, with subtitle and actions', () => {
    render(<PageHeading title="Favorites" subtitle="3 books" actions={<button type="button">Edit</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Favorites' })).toBeInTheDocument();
    expect(screen.getByText('3 books')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('renders at the level asked for, with the given id', () => {
    render(<PageHeading level={2} title="Your Collections" titleId="collections-heading" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Your Collections' })).toHaveAttribute('id', 'collections-heading');
  });
});
