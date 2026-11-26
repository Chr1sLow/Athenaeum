import type { User } from '@athenaeum/shared';
import { LogOut } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLogout } from '../../api/auth.ts';
import styles from './AccountMenu.module.scss';

export function AccountMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const logout = useLogout();
  const navigate = useNavigate();

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function signOut() {
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.avatar}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        {user.email.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div id={menuId} role="menu" className={styles.menu}>
          <div className={styles.who}>
            <span className={styles.whoLabel}>Signed in as</span>
            <span className={styles.email}>{user.email}</span>
          </div>
          <button type="button" role="menuitem" className={styles.item} onClick={signOut} disabled={logout.isPending}>
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
