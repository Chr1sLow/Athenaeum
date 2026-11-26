import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState.tsx';

describe('EmptyState', () => {
  it('shows the message and the action', () => {
    render(<EmptyState message="This book is not on your shelf." action={<button type="button">Back</button>} />);
    expect(screen.getByText('This book is not on your shelf.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('labels its region with the title, at the heading level asked for', () => {
    render(<EmptyState title="Page not found" headingLevel={1} message="That page doesn't exist." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('uses an h2 for its title by default', () => {
    render(<EmptyState title="Your shelf is empty" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Your shelf is empty' })).toBeInTheDocument();
  });
});
