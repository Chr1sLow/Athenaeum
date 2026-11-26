import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar.tsx';

describe('ProgressBar', () => {
  it('is a named progressbar with its value when labelled', () => {
    render(<ProgressBar label="lantern.epub" value={42} />);
    const bar = screen.getByRole('progressbar', { name: 'lantern.epub' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('is hidden from assistive technology when unlabelled (decoration next to a visible percentage)', () => {
    const { container } = render(<ProgressBar value={30} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('never draws past 100%', () => {
    const { container } = render(<ProgressBar value={140} />);
    expect(container.querySelector('[style]')).toHaveStyle({ width: '100%' });
  });
});
