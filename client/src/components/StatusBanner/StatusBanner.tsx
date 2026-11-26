import { TriangleAlert } from 'lucide-react';
import { useConnectionState } from '../../api/health.ts';
import styles from './StatusBanner.module.scss';

const MESSAGES = {
  'db-down': {
    title: "Can't reach the database.",
    hint: 'Start Docker Desktop, then run npm run db:up.',
  },
  'server-down': {
    title: "Can't reach the Athenaeum server.",
    hint: 'Run npm run dev from the project folder.',
  },
} as const;

export function StatusBanner() {
  const state = useConnectionState();
  if (state !== 'db-down' && state !== 'server-down') return null;
  const { title, hint } = MESSAGES[state];
  return (
    <div className="wrapper">
      <div role="alert" className={styles.banner}>
        <TriangleAlert size={18} aria-hidden />
        <span>
          <strong>{title}</strong> {hint}
        </span>
      </div>
    </div>
  );
}
