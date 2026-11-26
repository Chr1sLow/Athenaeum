import { ButtonLink } from '../Button/Button.tsx';
import { EmptyState } from '../EmptyState/EmptyState.tsx';

/** Any URL the router doesn't know. */
export function NotFoundPage() {
  return (
    <EmptyState
      variant="card"
      title="Page not found"
      headingLevel={1}
      message="That page doesn't exist."
      action={<ButtonLink to="/">Back to shelf</ButtonLink>}
    />
  );
}
