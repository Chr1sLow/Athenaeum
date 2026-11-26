import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// findBy/waitFor give up after 3s instead of the default 1s. Test files run in parallel, and the
// first render of a file (which compiles the whole app) can pass 1s when the machine is busy.
// A wait only lasts as long as it needs to, so passing tests aren't slowed down.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
