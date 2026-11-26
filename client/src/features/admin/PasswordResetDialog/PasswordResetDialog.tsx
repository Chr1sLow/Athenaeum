import { Button } from '../../../components/Button/Button.tsx';
import { Modal } from '../../../components/Modal/Modal.tsx';
import styles from './PasswordResetDialog.module.scss';

export interface PasswordResetDialogProps {
  email: string;
  password: string;
  onClose(): void;
}

/** Shows a temporary password once, right after it was set. It isn't stored anywhere you can read later. */
export function PasswordResetDialog({ email, password, onClose }: PasswordResetDialogProps) {
  return (
    <Modal
      title="Temporary password"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <p className={styles.text}>
        {email} has been signed out everywhere. They can sign in with this password, then change it on their account
        page. It won't be shown again.
      </p>
      <code className={styles.password}>{password}</code>
    </Modal>
  );
}
