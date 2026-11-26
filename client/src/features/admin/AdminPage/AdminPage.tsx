import { useSearchParams } from 'react-router';
import { useAdminTables } from '../../../api/admin.ts';
import { HttpError } from '../../../api/client.ts';
import { Button } from '../../../components/Button/Button.tsx';
import { EmptyState } from '../../../components/EmptyState/EmptyState.tsx';
import { NotFoundPage } from '../../../components/NotFoundPage/NotFoundPage.tsx';
import { PageSkeleton } from '../../../components/PageSkeleton/PageSkeleton.tsx';
import { useDocumentTitle } from '../../../lib/useDocumentTitle.ts';
import { AdminBreadcrumbs } from '../AdminBreadcrumbs/AdminBreadcrumbs.tsx';
import { type AdminView, readRow, readView, viewParams } from '../adminView.ts';
import { TableBrowser } from '../TableBrowser/TableBrowser.tsx';
import { TablesPane } from '../TablesPane/TablesPane.tsx';
import styles from './AdminPage.module.scss';

/**
 * /admin: browse and edit every table in the database, laid out like the Firestore console
 * (tables | rows | the open row's fields). Nothing links here; you type the URL.
 * The server answers 404 to anyone who isn't an admin, and then this page is "Page not found".
 */
export function AdminPage() {
  const tables = useAdminTables();
  const [params, setParams] = useSearchParams();
  // Only once the server has said you're an admin: the tab title mustn't give the page away.
  useDocumentTitle(tables.data ? 'Database' : undefined);

  if (tables.isPending) return <PageSkeleton label="Loading database" />;
  if (tables.error instanceof HttpError && tables.error.status === 404) return <NotFoundPage />;
  if (tables.isError) {
    return (
      <EmptyState
        variant="card"
        title="Couldn't load the database"
        headingLevel={1}
        message={tables.error.message}
        action={<Button onClick={() => void tables.refetch()}>Try again</Button>}
      />
    );
  }

  const current = tables.data.find((t) => t.name === params.get('table')) ?? tables.data[0];
  if (!current) return <EmptyState variant="card" title="The database has no tables" headingLevel={1} />;

  const view = readView(params);
  const row = readRow(params);
  // Phones have room for one pane: the deepest thing the URL points at.
  const phoneShows = row ? 'row' : params.has('table') ? 'rows' : 'tables';
  const changeView = (next: AdminView) => setParams(viewParams(current.name, next), { replace: true });

  return (
    <div className={styles.page}>
      <AdminBreadcrumbs table={current.name} row={row} />
      <div className={styles.console}>
        <TablesPane tables={tables.data} current={current.name} hiddenOnPhone={phoneShows !== 'tables'} />
        <TableBrowser
          key={current.name}
          table={current}
          view={view}
          selected={row}
          phoneShows={phoneShows}
          onViewChange={changeView}
        />
      </div>
    </div>
  );
}
