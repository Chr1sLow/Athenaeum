import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs.tsx';

const ITEMS = [
  { id: 'a', label: 'Dune' },
  { id: 'b', label: 'Emma' },
  { id: 'c', label: 'Ivanhoe' },
];

function Harness({ onSelect = () => {} }: { onSelect?: (id: string) => void }) {
  const [selected, setSelected] = useState('a');
  return (
    <Tabs
      label="Books in this collection"
      items={ITEMS}
      selectedId={selected}
      onSelect={(id) => {
        setSelected(id);
        onSelect(id);
      }}
      aside={<span>Sort</span>}
    >
      Panel for {selected}
    </Tabs>
  );
}

describe('Tabs', () => {
  it('is a named tablist; the selected tab labels the panel and is the only tab stop', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Books in this collection' })).toBeInTheDocument();
    const dune = screen.getByRole('tab', { name: 'Dune' });
    expect(dune).toHaveAttribute('aria-selected', 'true');
    expect(dune).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Emma' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel', { name: 'Dune' })).toHaveTextContent('Panel for a');
    expect(screen.getByText('Sort')).toBeInTheDocument();
  });

  it('shows an optional count beside a label', () => {
    const items = [
      {
        id: 'users',
        label: 'users',
        count: 1234,
      },
    ];
    render(
      <Tabs label="Tables" items={items} selectedId="users" onSelect={() => {}}>
        Rows
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'users 1,234' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'users 1,234' })).toHaveTextContent('Rows');
  });

  it('selects a tab on click', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Emma' }));
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(screen.getByRole('tabpanel', { name: 'Emma' })).toBeInTheDocument();
  });

  it('moves with the arrow, Home and End keys, wrapping around and taking focus along', async () => {
    render(<Harness />);
    screen.getByRole('tab', { name: 'Dune' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Ivanhoe' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Ivanhoe' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Dune' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Emma' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Ivanhoe' })).toHaveFocus();
  });
});
