import { useEffect } from 'react';

/** Sets the browser tab title: "<title> · Athenaeum", or just "Athenaeum". */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · Athenaeum` : 'Athenaeum';
  }, [title]);
}
