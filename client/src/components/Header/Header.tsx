import { useRef } from 'react';
import { Link } from 'react-router';
import { useMe } from '../../api/auth.ts';
import { useFocusShortcut } from '../../lib/useFocusShortcut.ts';
import { AccountMenu } from '../AccountMenu/AccountMenu.tsx';
import { SearchField } from '../SearchField/SearchField.tsx';
import styles from './Header.module.scss';

export interface HeaderProps {
  /** Show the shelf search box (default). Off on pages it can't search, like /admin. */
  search?: boolean;
}

/** The bar across the top: logo, then search + account menu when signed in, or Login / Sign up. */
export function Header({ search = true }: HeaderProps) {
  const me = useMe();
  const user = me.data;
  const searchRef = useRef<HTMLInputElement>(null);
  useFocusShortcut(searchRef, 'k');

  return (
    <header className={styles.header}>
      <div className={`wrapper ${styles.inner}`}>
        <Link to="/" className={styles.logo}>
          Athenaeum
        </Link>

        {user && (
          <>
            {search && (
              <div className={styles.search}>
                <SearchField ref={searchRef} label="Search your shelf" placeholder="Search" size="large" shortcutHint="Ctrl K" />
              </div>
            )}
            <nav className={`${styles.actions} ${!search ? styles.pushRight : ''}`} aria-label="Account">
              <AccountMenu user={user} />
            </nav>
          </>
        )}

        {!user && me.isSuccess && (
          <nav className={`${styles.actions} ${styles.pushRight}`} aria-label="Account">
            <Link to="/login" className={styles.textLink}>
              Login
            </Link>
            <Link to="/signup" className={styles.textLink}>
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
