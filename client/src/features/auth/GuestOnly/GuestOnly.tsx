import { Navigate, Outlet, useSearchParams } from 'react-router';
import { safeNextPath, useMe } from '../../../api/auth.ts';
import { Spinner } from '../../../components/Spinner/Spinner.tsx';

/** Route guard for log in / sign up. Already signed in? Skip straight to where you were going. */
export function GuestOnly() {
  const me = useMe();
  const [params] = useSearchParams();
  if (me.isPending) return <Spinner />;
  if (me.data) return <Navigate to={safeNextPath(params.get('next'))} replace />;
  return <Outlet />;
}
