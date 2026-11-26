import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchField } from './SearchField.tsx';

describe('SearchField', () => {
  it('is a search box named by its label, showing the placeholder', () => {
    render(<SearchField label="Search chapters" placeholder="Search" />);
    const input = screen.getByRole('searchbox', { name: 'Search chapters' });
    expect(input).toHaveAttribute('placeholder', 'Search');
  });

  it('reports the typed text', async () => {
    const onChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState('');
      return (
        <SearchField
          label="Filter books"
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }
    render(<Controlled />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Filter books' }), 'dune');
    expect(onChange).toHaveBeenLastCalledWith('dune');
    expect(screen.getByRole('searchbox')).toHaveValue('dune');
  });

  it('shows a keyboard shortcut hint without adding it to the name', () => {
    render(<SearchField label="Search your shelf" shortcutHint="Ctrl K" />);
    expect(screen.getByText('Ctrl K')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search your shelf' })).toBeInTheDocument();
  });
});
