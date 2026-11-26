import styles from './FormError.module.scss';

export interface FormErrorProps {
  message?: string | null;
  id?: string;
}

/** The error box at the top of a form. Renders nothing when there is no message. */
export function FormError({ message, id }: FormErrorProps) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={styles.error}>
      {message}
    </p>
  );
}
