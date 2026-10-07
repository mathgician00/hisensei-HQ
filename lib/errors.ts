/** Thrown for authentication/authorization problems; carries the HTTP status. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Thrown for business-rule violations that are safe to show to the user (HTTP 400). */
export class UserError extends Error {}
