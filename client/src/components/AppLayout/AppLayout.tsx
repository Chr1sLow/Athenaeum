import { Outlet, useLocation } from 'react-router';
import { UploadProvider } from '../UploadProvider/UploadProvider.tsx';
import { Header } from '../Header/Header.tsx';
import { StatusBanner } from '../StatusBanner/StatusBanner.tsx';

export function AppLayout() {
  const location = useLocation();
  // The shelf search has nothing to find on the admin page, which has its own per-table search.
  const isSearchHidden = location.pathname.startsWith('/admin');
  return (
    <UploadProvider>
      <Header search={!isSearchHidden} />
      <StatusBanner />
      <main className="wrapper" style={{ paddingBottom: 64 }}>
        <Outlet />
      </main>
    </UploadProvider>
  );
}
