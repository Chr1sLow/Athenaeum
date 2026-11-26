import { Suspense, lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppLayout } from './components/AppLayout/AppLayout.tsx';
import { NotFoundPage } from './components/NotFoundPage/NotFoundPage.tsx';
import { PageSkeleton } from './components/PageSkeleton/PageSkeleton.tsx';
import { BookPage } from './features/book/BookPage/BookPage.tsx';
import { AuthPage } from './features/auth/AuthPage/AuthPage.tsx';
import { GuestOnly } from './features/auth/GuestOnly/GuestOnly.tsx';
import { RequireAuth } from './features/auth/RequireAuth/RequireAuth.tsx';
import { CollectionPage } from './features/collections/CollectionPage/CollectionPage.tsx';
import { ReaderPage } from './features/reader/ReaderPage/ReaderPage.tsx';
import { ShelfPage } from './features/shelf/ShelfPage/ShelfPage.tsx';

// Loaded on demand, so the admin page's code isn't part of the app everyone downloads. React's
// lazy (rather than the router's) keeps the header on screen while it loads.
const AdminPage = lazy(async () => ({ default: (await import('./features/admin/AdminPage/AdminPage.tsx')).AdminPage }));

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: 'login', element: <AuthPage key="login" mode="login" /> },
          { path: 'signup', element: <AuthPage key="signup" mode="signup" /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <ShelfPage /> },
          { path: '/shelf', element: <ShelfPage /> },
          { path: '/collections', element: <CollectionPage /> },
          { path: 'book/:id', element: <BookPage /> },
          { path: 'collections/:id', element: <CollectionPage /> },
          // Not linked anywhere: admins type the URL. The page itself shows "Page not found" to non-admins.
          {
            path: 'admin',
            element: (
              <Suspense fallback={<PageSkeleton label="Loading" />}>
                <AdminPage />
              </Suspense>
            ),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [{ path: 'read/:id/:chapter', element: <ReaderPage /> }],
  },
];

export const router = createBrowserRouter(routes);
