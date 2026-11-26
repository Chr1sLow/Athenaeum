import { type KeyboardEvent, type ReactNode, useId } from 'react';
import { formatCount } from '../../lib/format.ts';
import styles from './Tabs.module.scss';

export interface TabItem {
  id: string;
  label: string;
  /** A number shown after the label, e.g. how many rows or books are inside. */
  count?: number;
}

export interface TabsProps {
  /** Name of the tab list. */
  label: string;
  items: readonly TabItem[];
  selectedId: string;
  onSelect(id: string): void;
  /** Shown beside the tab strip, e.g. a sort control. */
  aside?: ReactNode;
  /** Content of the selected tab. */
  children: ReactNode;
}

const KEY_STEP: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

/** A scrollable strip of tabs over one panel. Arrow keys, Home and End move between tabs. */
export function Tabs({ label, items, selectedId, onSelect, aside, children }: TabsProps) {
  const prefix = useId();
  const tabId = (id: string) => `${prefix}-tab-${id}`;
  const panelId = `${prefix}-panel`;

  const onKeyDown = (e: KeyboardEvent) => {
    const step = KEY_STEP[e.key];
    if (!step || !items.length) return;
    e.preventDefault();
    const current = items.findIndex((item) => item.id === selectedId);
    const target = items[step(Math.max(0, current), items.length)]!;
    onSelect(target.id);
    document.getElementById(tabId(target.id))?.focus();
  };

  return (
    <>
      <div className={styles.bar}>
        <div role="tablist" aria-label={label} className={styles.tabs} onKeyDown={onKeyDown}>
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <button
                key={item.id}
                id={tabId(item.id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={selected ? panelId : undefined}
                tabIndex={selected ? 0 : -1}
                className={styles.tab}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
                {item.count !== undefined && (
                  <>
                    {' '}
                    <span className={styles.count}>{formatCount(item.count)}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {aside}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(selectedId)} className={styles.panel}>
        {children}
      </div>
    </>
  );
}
