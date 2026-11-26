import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil, Plus } from 'lucide-react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Button, ButtonAnchor, ButtonLink } from './Button.tsx';

describe('Button', () => {
  it('is a button named by its text, and does not submit forms by default', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the icon out of the accessible name', () => {
    render(<Button icon={<Pencil data-testid="icon" />}>Edit</Button>);
    expect(screen.getByRole('button', { name: 'Edit' })).toContainElement(screen.getByTestId('icon'));
  });

  it('passes native attributes through', async () => {
    const onClick = vi.fn();
    render(
      <Button type="submit" disabled onClick={onClick}>
        Create
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Create' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('names an icon-only button with aria-label', () => {
    render(<Button variant="icon" icon={<Plus />} aria-label="Upload books" />);
    expect(screen.getByRole('button', { name: 'Upload books' })).toBeInTheDocument();
  });
});

describe('ButtonLink', () => {
  it('is a router link to the given path', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/book/1">Back to shelf</ButtonLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Back to shelf' })).toHaveAttribute('href', '/book/1');
  });
});

describe('ButtonAnchor', () => {
  it('is a plain link, so downloads work', () => {
    render(
      <ButtonAnchor href="/api/books/1/file" download="book.epub">
        Download original
      </ButtonAnchor>,
    );
    const link = screen.getByRole('link', { name: 'Download original' });
    expect(link).toHaveAttribute('href', '/api/books/1/file');
    expect(link).toHaveAttribute('download', 'book.epub');
  });
});
