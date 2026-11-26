import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../../../api/auth.ts';
import { Button } from '../../../components/Button/Button.tsx';
import { EmptyState } from '../../../components/EmptyState/EmptyState.tsx';
import { Spinner } from '../../../components/Spinner/Spinner.tsx';

/** Route guard for pages that need an account. Signed-out visitors go to /login, then come back here. */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <Spinner />;
  if (me.isError) {
    return (
      <EmptyState
        message="Couldn't check whether you're signed in."
        action={<Button onClick={() => void me.refetch()}>Try again</Button>}
      />
    );
  }
  if (!me.data) {
    const next = location.pathname + location.search;
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
