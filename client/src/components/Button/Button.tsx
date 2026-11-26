import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'icon' | 'text';

interface ButtonLookProps {
  /** `icon` is a square, icon-only button: give it an `aria-label`. `text` is accent-coloured text with no box. */
  variant?: ButtonVariant;
  size?: 'medium' | 'large';
  /** Stretch to the container's width. With `iconPosition="end"` the label and icon sit at opposite ends. */
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  children?: ReactNode;
}

export type ButtonProps = ButtonLookProps & Omit<ComponentPropsWithRef<'button'>, 'className' | 'children'>;
export type ButtonLinkProps = ButtonLookProps & Omit<LinkProps, 'className' | 'children'>;
export type ButtonAnchorProps = ButtonLookProps & Omit<ComponentPropsWithRef<'a'>, 'className' | 'children'>;

const VARIANT_CLASS: Record<ButtonVariant, string | undefined> = {
  primary: styles.primary,
  secondary: undefined, // the base look
  danger: styles.danger,
  icon: styles.iconOnly,
  text: styles.text,
};

function lookClasses({ variant = 'secondary', size = 'medium', fullWidth, iconPosition = 'start' }: ButtonLookProps) {
  return [
    styles.button,
    VARIANT_CLASS[variant],
    size === 'large' && styles.large,
    fullWidth && styles.fullWidth,
    iconPosition === 'end' && styles.iconEnd,
  ]
    .filter(Boolean)
    .join(' ');
}

/** The inside of every button: optional icon (hidden from screen readers) and the label. */
function renderContent({ icon, iconPosition = 'start', children }: ButtonLookProps) {
  const iconEl = icon ? (
    <span className={styles.icon} aria-hidden>
      {icon}
    </span>
  ) : null;
  return (
    <>
      {iconPosition === 'start' && iconEl}
      {children !== undefined && <span className={styles.label}>{children}</span>}
      {iconPosition === 'end' && iconEl}
    </>
  );
}

/** The app's button. Pick a `variant` instead of passing class names. */
export function Button({ variant, size, fullWidth, icon, iconPosition, children, type = 'button', ...rest }: ButtonProps) {
  const look = { variant, size, fullWidth, icon, iconPosition, children };
  return (
    <button type={type} className={lookClasses(look)} {...rest}>
      {renderContent(look)}
    </button>
  );
}

/** A router link that looks like a button. */
export function ButtonLink({ variant, size, fullWidth, icon, iconPosition, children, ...rest }: ButtonLinkProps) {
  const look = { variant, size, fullWidth, icon, iconPosition, children };
  return (
    <Link className={lookClasses(look)} {...rest}>
      {renderContent(look)}
    </Link>
  );
}

/** A plain `<a>` that looks like a button, for downloads and anything the router shouldn't handle. */
export function ButtonAnchor({ variant, size, fullWidth, icon, iconPosition, children, ...rest }: ButtonAnchorProps) {
  const look = { variant, size, fullWidth, icon, iconPosition, children };
  return (
    <a className={lookClasses(look)} {...rest}>
      {renderContent(look)}
    </a>
  );
}
