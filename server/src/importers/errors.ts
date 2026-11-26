/** A problem with the uploaded file itself. The message is shown to the user as-is. */
export class ImportError extends Error {
  constructor(
    message: string,
    /** 415 = unsupported file type, 422 = recognized but unreadable. */
    readonly status: 415 | 422 = 422,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}
