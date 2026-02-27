export function parseGameTextState<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
