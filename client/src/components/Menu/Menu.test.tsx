import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Menu, type MenuItem } from './Menu.tsx';

function renderMenu(items: Partial<MenuItem>[] = [{}]) {
  const full = items.map((it, i) => ({ label: `Item ${i + 1}`, onSelect: vi.fn(), ...it }));
  render(
    <>
      <Menu label="Options for Dune" icon={<Ellipsis />} items={full} />
      <p>Somewhere else</p>
    </>,
  );
  return { items: full, trigger: screen.getByRole('button', { name: 'Options for Dune' }) };
}

describe('Menu', () => {
  it('is a closed menu button named by its label', () => {
    const { trigger } = renderMenu();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click with focus on the first item, and runs an item then closes', async () => {
    const menuItems: Partial<MenuItem>[] = [
      {
        label: 'Edit',
        icon: <Pencil />,
      },
      {
        label: 'Delete',
        icon: <Trash2 />,
        danger: true,
      },
    ];
    const { items, trigger } = renderMenu(menuItems);
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Options for Dune' });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();

    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(items[1]!.onSelect).toHaveBeenCalledTimes(1);
    expect(items[0]!.onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves between items with the arrow keys, Home and End', async () => {
    const { trigger } = renderMenu([{ label: 'One' }, { label: 'Two' }, { label: 'Three' }]);
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Three' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Three' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
  });

  it('closes on Escape and gives focus back to the button', async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when you click outside it, without running anything', async () => {
    const { items, trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByText('Somewhere else'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(items[0]!.onSelect).not.toHaveBeenCalled();
  });

  it('does not run a disabled item', async () => {
    const { items, trigger } = renderMenu([{ label: 'Delete', disabled: true }]);
    await userEvent.click(trigger);
    const item = screen.getByRole('menuitem', { name: 'Delete' });
    expect(item).toBeDisabled();
    await userEvent.click(item);
    expect(items[0]!.onSelect).not.toHaveBeenCalled();
  });
});
