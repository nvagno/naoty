import "server-only";

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export const notFound = (what = "Note") => error(404, `${what} introuvable.`);

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
