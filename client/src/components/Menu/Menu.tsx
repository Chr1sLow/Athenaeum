import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import styles from './Menu.module.scss';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect(): void;
  /** Destructive actions (Delete) are shown in red. */
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** Accessible name of the button, also used to name the menu. */
  label: string;
  /** The button's only content, e.g. a "…" icon. */
  icon: ReactNode;
  items: MenuItem[];
  /** `overlay` is a dark round button for sitting on top of images such as book covers. */
  look?: 'plain' | 'overlay';
}

/**
 * An icon button that opens a small menu of actions below it. Escape or a click outside closes it;
 * arrow keys, Home and End move between items.
 */
export function Menu({ label, icon, items, look = 'plain' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus the first usable item on open; close on a click outside.
  useEffect(() => {
    if (!open) return;
    itemRefs.current.find((el) => el && !el.disabled)?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const usable = itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled);
    const at = usable.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) => usable[(i + usable.length) % usable.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        focusAt(at + 1);
        break;
      case 'ArrowUp':
        focusAt(at - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(usable.length - 1);
        break;
      case 'Escape':
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        return; // let focus move on as usual
      default:
        return;
    }
    e.preventDefault();
  }

  function select(item: MenuItem) {
    setOpen(false);
    item.onSelect();
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${look === 'overlay' ? styles.overlay : ''}`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden className={styles.triggerIcon}>
          {icon}
        </span>
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={styles.menu} onKeyDown={onMenuKeyDown}>
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`${styles.item} ${item.danger ? styles.danger : ''}`}
              disabled={item.disabled}
              onClick={() => select(item)}
            >
              {item.icon && (
                <span aria-hidden className={styles.itemIcon}>
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
