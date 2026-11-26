import type { BookSummary } from '@athenaeum/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { summary } from '../../test/books.ts';
import { FakeXHR, installFakeXhr } from '../../test/fakeXhr.ts';
import { mockSignedIn, renderApp } from '../../test/render.tsx';

const epubFile = (name = 'lantern.epub') => new File(['epub bytes'], name, { type: 'application/epub+zip' });
const pdfFile = (name = 'paper.pdf') => new File(['pdf bytes'], name, { type: 'application/pdf' });

/** A shelf whose contents the test controls, so a finished upload can appear on it. */
function shelfApi(initial: BookSummary[] = []) {
  const shelf = [...initial];
  mockSignedIn({ 'GET /books': () => ({ status: 200, body: shelf }) });
  return shelf;
}

describe('uploading books', () => {
  beforeEach(() => {
    installFakeXhr();
  });

  it('uploads each file chosen in the file picker and adds it to the shelf', async () => {
    const shelf = shelfApi();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });

    await userEvent.upload(screen.getByLabelText('Add books'), [epubFile(), pdfFile()]);
    expect(FakeXHR.instances.map((x) => [x.method, x.url, x.file?.name])).toEqual([
      ['POST', '/api/books', 'lantern.epub'],
      ['POST', '/api/books', 'paper.pdf'],
    ]);

    const book = summary({ id: 'new1', title: 'The Lantern Road' });
    shelf.push(book);
    act(() => FakeXHR.instances[0]!.respond(201, book));
    expect(await screen.findByRole('heading', { name: 'The Lantern Road', level: 3 })).toBeInTheDocument();
  });

  it('shows progress while a file uploads and then while it is processed', async () => {
    shelfApi();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    await userEvent.upload(screen.getByLabelText('Add books'), [epubFile()]);

    const panel = screen.getByRole('region', { name: 'Uploads' });
    act(() => FakeXHR.instances[0]!.progress(50, 100));
    expect(within(panel).getByText('lantern.epub')).toBeInTheDocument();
    expect(within(panel).getByRole('progressbar', { name: 'lantern.epub' })).toHaveAttribute('aria-valuenow', '50');

    act(() => FakeXHR.instances[0]!.progress(100, 100));
    expect(within(panel).getByText('Processing…')).toBeInTheDocument();

    act(() => FakeXHR.instances[0]!.respond(201, summary()));
    expect(await within(panel).findByText('Added to your shelf')).toBeInTheDocument();
  });

  it('clears finished uploads after a few seconds but keeps failures on screen', async () => {
    shelfApi();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    await userEvent.upload(screen.getByLabelText('Add books'), [epubFile(), pdfFile('scan.pdf')]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      act(() => FakeXHR.instances[0]!.respond(201, summary()));
      act(() => FakeXHR.instances[1]!.respond(422, { error: 'This PDF has no text layer.' }));
      const panel = screen.getByRole('region', { name: 'Uploads' });
      expect(await within(panel).findByText('Added to your shelf')).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(6000));
      expect(within(panel).queryByText('lantern.epub')).not.toBeInTheDocument();
      expect(within(panel).getByText(/no text layer/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the server's reason when a file is rejected", async () => {
    shelfApi();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    await userEvent.upload(screen.getByLabelText('Add books'), [pdfFile('scan.pdf')]);
    act(() =>
      FakeXHR.instances[0]!.respond(422, { error: 'This PDF has no text layer (it may be a scan), so it cannot be reflowed.' }),
    );
    const panel = screen.getByRole('region', { name: 'Uploads' });
    expect(await within(panel).findByText(/no text layer/)).toBeInTheDocument();
  });

  it('says so when the connection fails mid-upload', async () => {
    shelfApi();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    await userEvent.upload(screen.getByLabelText('Add books'), [epubFile()]);
    act(() => FakeXHR.instances[0]!.failNetwork());
    expect(await screen.findByText(/Upload failed/)).toBeInTheDocument();
  });

  it('refuses other file types without uploading them', async () => {
    shelfApi();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Your shelf is empty' });
    const docx = new File(['x'], 'notes.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await userEvent.upload(screen.getByLabelText('Add books'), [docx], { applyAccept: false });
    expect(FakeXHR.instances).toHaveLength(0);
    expect(await screen.findByText(/Only EPUB and PDF files/)).toBeInTheDocument();
  });

  it('accepts files dropped onto the shelf', async () => {
    shelfApi();
    renderApp('/');
    const empty = await screen.findByRole('heading', { name: 'Your shelf is empty' });
    const dataTransfer = { files: [epubFile()], types: ['Files'] };
    fireEvent.dragEnter(empty, { dataTransfer });
    expect(screen.getByText('Drop to add to your shelf')).toBeInTheDocument();
    fireEvent.drop(empty, { dataTransfer });
    await waitFor(() => expect(FakeXHR.instances.map((x) => x.file?.name)).toEqual(['lantern.epub']));
    expect(screen.queryByText('Drop to add to your shelf')).not.toBeInTheDocument();
  });

  it('opens the same file picker from the empty shelf button', async () => {
    shelfApi();
    renderApp('/');
    const emptyShelfButton = await screen.findByRole('button', { name: 'Add book' });
    const pickerClick = vi.spyOn(screen.getByLabelText('Add books'), 'click');

    await userEvent.click(emptyShelfButton);
    expect(pickerClick).toHaveBeenCalledTimes(1);
  });
});
