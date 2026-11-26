import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner } from './Spinner.tsx';

describe('Spinner', () => {
  it('is a status named "Loading" by default', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('takes a more specific label', () => {
    render(<Spinner label="Checking your session" />);
    expect(screen.getByRole('status', { name: 'Checking your session' })).toBeInTheDocument();
  });
});
