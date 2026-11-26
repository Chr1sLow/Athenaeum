import { describe, expect, it } from 'vitest';

// Every file under src/, by path relative to this file. Only the paths are used; nothing is loaded.
const files = Object.keys(import.meta.glob(['./**/*.tsx', './**/*.module.scss']));

/** "./features/book/BookPage/BookPage.module.scss" → { folder: "BookPage", name: "BookPage" }. */
function parts(path: string) {
  const segments = path.split('/');
  const file = segments.at(-1)!;
  return { folder: segments.at(-2)!, name: file.replace(/(\.test)?\.tsx$|\.module\.scss$/, '') };
}

// Components are PascalCase files (BookPage.tsx, BookPage.module.scss, BookPage.test.tsx).
// Lowercase files are not components: main.tsx, router.tsx, test helpers, feature-level route tests.
const componentFiles = files.filter((path) => /^[A-Z]/.test(parts(path).name));

describe('project structure', () => {
  it('finds the components', () => {
    expect(componentFiles.length).toBeGreaterThan(20);
  });

  it('keeps every component in its own folder named after it (Name/Name.tsx, Name.module.scss, Name.test.tsx)', () => {
    const misplaced = componentFiles.filter((path) => {
      const { folder, name } = parts(path);
      return folder !== name;
    });
    expect(misplaced).toEqual([]);
  });

  it('gives every component folder its component file', () => {
    const folders = new Set(componentFiles.map((path) => path.slice(0, path.lastIndexOf('/'))));
    const withoutComponent = [...folders].filter(
      (folder) => !files.includes(`${folder}/${folder.split('/').at(-1)}.tsx`),
    );
    expect(withoutComponent).toEqual([]);
  });
});
