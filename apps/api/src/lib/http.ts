import type { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') => new HttpError(404, `${what} não encontrado.`);
export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const forbidden = (message = 'Você não tem permissão para esta ação.') => new HttpError(403, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Valida a entrada com zod e converte falhas em 400 com a lista de campos inválidos. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw badRequest(
      'Dados inválidos.',
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}

export function idParam(params: unknown): number {
  const id = Number((params as { id?: string }).id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  return id;
}

export const nowIso = () => new Date().toISOString();
