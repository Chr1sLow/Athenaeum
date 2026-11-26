// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileAsync } from 'sass-embedded';
import { describe, expect, it } from 'vitest';

// Every stylesheet under src/. The glob is only used to list them: with `css: false` Vitest stubs
// stylesheet imports (even `?raw`), so the files are read from disk instead.
const paths = Object.keys(import.meta.glob('../**/*.{css,scss}'));
const scss = paths
  .filter((path) => path.endsWith('.scss'))
  .map((path) => {
    const file = fileURLToPath(new URL(path, import.meta.url));
    return [path, file, readFileSync(file, 'utf8')] as const;
  });

// Comments may mention colors; only real declarations count.
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('stylesheets', () => {
  it('are all SCSS, with no plain .css files left in src', () => {
    expect(paths.filter((path) => path.endsWith('.css'))).toEqual([]);
    expect(scss.length).toBeGreaterThan(0);
  });

  it.each(scss)('%s compiles without warnings', async (_path, file) => {
    const warnings: string[] = [];
    const result = await compileAsync(file, {
      logger: { warn: (message) => warnings.push(message), debug: () => {} },
    });
    expect(warnings).toEqual([]);
    expect(result.css).toBeTypeOf('string');
  });

  it.each(scss)('%s uses @use, never the deprecated @import', (_path, _file, source) => {
    expect(stripComments(source)).not.toMatch(/@import\b/);
  });

  // Themes switch colors at runtime through CSS variables, so a literal color bypasses them.
  it.each(scss.filter(([path]) => !path.endsWith('/tokens.scss')))(
    '%s takes its colors from tokens.scss, not hex literals',
    (_path, _file, source) => {
      expect(stripComments(source).match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    },
  );
});
