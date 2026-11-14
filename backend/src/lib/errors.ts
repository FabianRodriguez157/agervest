export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const BadRequest   = (msg: string, d?: unknown) => new HttpError(400, msg, d);
export const Unauthorized = (msg = 'No autenticado') => new HttpError(401, msg);
export const Forbidden    = (msg = 'No autorizado')   => new HttpError(403, msg);
export const NotFound     = (msg = 'Recurso no encontrado') => new HttpError(404, msg);
export const Conflict     = (msg: string) => new HttpError(409, msg);
