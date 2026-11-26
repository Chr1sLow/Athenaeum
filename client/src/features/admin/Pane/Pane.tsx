import { type ReactNode, useId } from 'react';
import styles from './Pane.module.scss';

export interface PaneProps {
  /** Shown before the title. */
  icon: ReactNode;
  title: string;
  headingLevel?: 1 | 2;
  /** The region's accessible name, when it should say more than the title ("Row 6f1c…"). */
  label?: string;
  /** Buttons at the right end of the title bar. */
  actions?: ReactNode;
  /** The row under the title bar: a count, an action button, a filter panel. */
  toolbar?: ReactNode;
  /** Pinned under the scrolling body. */
  footer?: ReactNode;
  /** Hidden on phones, where only one pane fits at a time. */
  hiddenOnPhone?: boolean;
  children: ReactNode;
}

/** One column of the database console: a title bar, a toolbar, and a body that scrolls on its own. */
export function Pane({ icon, title, headingLevel = 2, label, actions, toolbar, footer, hiddenOnPhone, children }: PaneProps) {
  const headingId = useId();
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section
      className={hiddenOnPhone ? `${styles.pane} ${styles.hiddenOnPhone}` : styles.pane}
      aria-label={label}
      aria-labelledby={label ? undefined : headingId}
    >
      <div className={styles.titleBar}>
        <span className={styles.icon} aria-hidden>
          {icon}
        </span>
        <Heading id={headingId} className={styles.title} title={title}>
          {title}
        </Heading>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </section>
  );
}
