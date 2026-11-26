import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GeneratedCover, coverGradient } from './GeneratedCover.tsx';

describe('GeneratedCover', () => {
  it('gives the same title the same colors every time, and different titles different ones', () => {
    expect(coverGradient('Dune')).toBe(coverGradient('Dune'));
    expect(coverGradient('Dune')).not.toBe(coverGradient('Emma'));
  });

  it('shows the full title on large and small covers', () => {
    render(<GeneratedCover title="The Lantern Road" size="small" />);
    expect(screen.getByTestId('generated-cover')).toHaveTextContent('The Lantern Road');
  });

  it('shows only the first letter on tiny covers', () => {
    render(<GeneratedCover title="The Lantern Road" size="tiny" />);
    expect(screen.getByTestId('generated-cover')).toHaveTextContent(/^T$/);
  });
});
