import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardGrid } from './CardGrid.tsx';

describe('CardGrid', () => {
  it('lays out its children', () => {
    render(
      <CardGrid>
        <article>One</article>
        <article>Two</article>
      </CardGrid>,
    );
    expect(screen.getAllByRole('article').map((a) => a.textContent)).toEqual(['One', 'Two']);
  });
});
