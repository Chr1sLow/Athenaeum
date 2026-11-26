import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormError } from './FormError.tsx';

describe('FormError', () => {
  it('announces the message as an alert', () => {
    render(<FormError message="Invalid email or password" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('renders nothing when there is no message', () => {
    render(<FormError message={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
