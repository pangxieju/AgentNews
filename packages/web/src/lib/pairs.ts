/**
 * 高意图对比页（/vs/{a}-vs-{b}/）。
 *
 * 为什么只配对「同形态 + 已上榜」：
 * - 跨形态比较违反产品原则（可比的才排名）
 * - 未上榜条目没有可比数据，配对页只会是空白
 *
 * 规则：每个形态取综合分前 N，两两组合；slug 字典序保证正反向只生成一页。
 */
import { FOCUS_FORMS } from './shared';

type Row = {
  slug: string;
  name: string;
  form: string;
  score: number | null;
  rank_in_form: number | null;
  oss_bucket: string;
};

export type Pair = { a: string; b: string; form: string };

export function buildPairs(rows: Row[], perForm = 6): Pair[] {
  const out: Pair[] = [];
  for (const form of FOCUS_FORMS) {
    const ranked = rows
      .filter((r) => r.form === form && r.score != null)
      .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
      .slice(0, perForm);
    for (let i = 0; i < ranked.length; i++) {
      for (let j = i + 1; j < ranked.length; j++) {
        // 字典序保证正反向只生成一页（slug 是字符串，不能用 Math.min/max）
        const [a, b] = [ranked[i]!.slug, ranked[j]!.slug].sort() as [string, string];
        out.push({ a, b, form });
      }
    }
  }
  return out;
}

export function pairSlug(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `${x}-vs-${y}`;
}

export function parsePair(slug: string): { a: string; b: string } | null {
  const i = slug.indexOf('-vs-');
  if (i <= 0) return null;
  const a = slug.slice(0, i);
  const b = slug.slice(i + 4);
  if (!a || !b || a === b) return null;
  return { a, b };
}
