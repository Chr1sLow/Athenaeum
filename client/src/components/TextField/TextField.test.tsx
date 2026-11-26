import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from './TextField.tsx';

describe('TextField', () => {
  it('is an input labelled by its visible label, passing native attributes through', async () => {
    const onChange = vi.fn();
    render(<TextField label="Email" type="email" autoComplete="email" onChange={onChange} />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    await userEvent.type(input, 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('links the hint to the input', () => {
    render(<TextField label="Password" hint="At least 8 characters." />);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('At least 8 characters.');
  });

  it('renders a trailing control inside the field', () => {
    render(<TextField label="Password" trailing={<button type="button">Show password</button>} />);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });
});
