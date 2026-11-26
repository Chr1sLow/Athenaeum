import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArrowUp } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl.tsx';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'read', label: 'Read' },
] as const;

describe('SegmentedControl', () => {
  it('is a named group whose current option is pressed', () => {
    render(<SegmentedControl label="Show" options={OPTIONS} value="read" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the option you pick, and ignores clicks on the current one', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Show" options={OPTIONS} value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Read' }));
    expect(onChange).toHaveBeenCalledWith('read');
  });

  it('shows the label when asked', () => {
    render(<SegmentedControl label="Sort by" showLabel options={OPTIONS} value="all" onChange={() => {}} />);
    expect(screen.getByText('Sort by')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Sort by' })).toBeInTheDocument();
  });

  it('names icon-only options by their label', () => {
    const options = [
      {
        value: 'old',
        label: 'Oldest first',
        icon: <ArrowUp />,
      },
    ];
    render(<SegmentedControl label="Order" options={options} value="old" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Oldest first' })).toBeInTheDocument();
    expect(screen.queryByText('Oldest first')).not.toBeInTheDocument();
  });
});
