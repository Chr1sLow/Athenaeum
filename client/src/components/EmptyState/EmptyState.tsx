import { type ReactNode, useId } from 'react';
import styles from './EmptyState.module.scss';

export interface EmptyStateProps {
  title?: string;
  /** 1 when the empty state is the whole page (e.g. "Page not found"). */
  headingLevel?: 1 | 2;
  message?: ReactNode;
  icon?: ReactNode;
  /** A button or link, e.g. "Back to shelf". */
  action?: ReactNode;
  /** `plain`: just centered text. `outlined`: dashed box. `card`: raised box. */
  variant?: 'plain' | 'outlined' | 'card';
}

/** What a page shows instead of its content: nothing here yet, not found, or an error. */
export function EmptyState({ title, headingLevel = 2, message, icon, action, variant = 'plain' }: EmptyStateProps) {
  const titleId = useId();
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const Root = title ? 'section' : 'div';

  return (
    <Root className={`${styles.root} ${styles[variant]}`} aria-labelledby={title ? titleId : undefined}>
      {icon && (
        <span className={styles.icon} aria-hidden>
          {icon}
        </span>
      )}
      {title && (
        <Heading id={titleId} className={styles.title}>
          {title}
        </Heading>
      )}
      {message && <p className={styles.message}>{message}</p>}
      {action}
    </Root>
  );
}
