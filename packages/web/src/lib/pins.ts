/** 对比钉选（pins）：localStorage + 跨组件事件，全站共用 */

const KEY = 'an-pins';
const MAX = 3;
export const PIN_EVENT = 'an-pins-change';

export function readPins(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(pins: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pins));
  } catch {}
  window.dispatchEvent(new CustomEvent(PIN_EVENT, { detail: pins }));
}

/** 返回切换后的 pin 列表 */
export function togglePin(slug: string): string[] {
  const cur = readPins();
  const next = cur.includes(slug)
    ? cur.filter((s) => s !== slug)
    : [...cur, slug].slice(-MAX);
  write(next);
  return next;
}

export function clearPins(): string[] {
  write([]);
  return [];
}

export function removePin(slug: string): string[] {
  const next = readPins().filter((s) => s !== slug);
  write(next);
  return next;
}
