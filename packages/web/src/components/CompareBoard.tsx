import { useEffect, useMemo, useState } from 'preact/hooks';
import AgentIcon from './AgentIcon';
import { FORM_ORDER, bucketText, fmt, fmtPct, formLabel } from '../lib/shared';

export type CompareItem = {
  slug: string;
  name: string;
  form: string;
  oss_bucket: string;
  score: number | null;
  rank_in_form: number | null;
  stars: number | null;
  forks: number | null;
  contributors: number | null;
  installs: number | null;
  activity: number | null;
  growth_30d_pct: number | null;
  license: string | null;
  last_release: string | null;
  version: string | null;
  version_at: string | null;
  data_level: string;
  icon: string | null;
  iconFallback: string | null;
};

interface Props {
  items: CompareItem[];
}

type NumRow = {
  kind: 'num';
  key: string;
  label: string;
  get: (i: CompareItem) => number | null;
  better: 'high' | 'low';
  fmt: (n: number) => string;
};
type TextRow = {
  kind: 'text';
  key: string;
  label: string;
  get: (i: CompareItem) => string;
};
type Row = NumRow | TextRow;

const ROWS: Row[] = [
  { kind: 'num', key: 'score', label: '综合分', get: (i) => i.score, better: 'high', fmt: (n) => String(n) },
  { kind: 'num', key: 'rank', label: '组内排名', get: (i) => i.rank_in_form, better: 'low', fmt: (n) => `#${n}` },
  { kind: 'num', key: 'stars', label: 'Star', get: (i) => i.stars, better: 'high', fmt: (n) => fmt(n) },
  { kind: 'num', key: 'forks', label: 'Fork', get: (i) => i.forks, better: 'high', fmt: (n) => fmt(n) },
  { kind: 'num', key: 'contributors', label: '贡献者', get: (i) => i.contributors, better: 'high', fmt: (n) => fmt(n) },
  { kind: 'num', key: 'installs', label: '安装量', get: (i) => i.installs, better: 'high', fmt: (n) => fmt(n) },
  { kind: 'num', key: 'activity', label: '活跃度', get: (i) => i.activity, better: 'high', fmt: (n) => n.toFixed(2) },
  { kind: 'num', key: 'growth', label: '30d 增速', get: (i) => i.growth_30d_pct, better: 'high', fmt: (n) => fmtPct(n) },
  { kind: 'text', key: 'level', label: '数据完整度', get: (i) => i.data_level },
  { kind: 'text', key: 'bucket', label: '归属', get: (i) => bucketText(i.oss_bucket) },
  { kind: 'text', key: 'license', label: 'License', get: (i) => i.license ?? '—' },
  { kind: 'text', key: 'release', label: '最近发版', get: (i) => (i.last_release ? i.last_release.slice(0, 10) : '—') },
  { kind: 'text', key: 'version', label: '当前版本', get: (i) => (i.version ? (i.version_at ? `${i.version} · ${i.version_at.slice(0, 10)}` : i.version) : '—') },
];

export default function CompareBoard({ items }: Props) {
  const [slots, setSlots] = useState<string[]>(['', '', '']);

  // URL 是唯一状态源：可分享、可刷新
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setSlots([p.get('a') ?? '', p.get('b') ?? '', p.get('c') ?? '']);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    slots.forEach((s, i) => {
      if (s) p.set(['a', 'b', 'c'][i]!, s);
    });
    const qs = p.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', url);
    }
  }, [slots]);

  const bySlug = useMemo(() => new Map(items.map((i) => [i.slug, i])), [items]);
  const picked = slots.map((s) => (s ? bySlug.get(s) ?? null : null));
  const active = picked.filter((x): x is CompareItem => x != null);
  const forms = new Set(active.map((x) => x.form));
  const mixedForms = forms.size > 1;

  const grouped = useMemo(
    () =>
      FORM_ORDER.map((f) => ({
        form: f,
        list: items.filter((i) => i.form === f).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
      })).filter((g) => g.list.length > 0),
    [items],
  );

  const setSlot = (idx: number, slug: string) =>
    setSlots((prev) => prev.map((v, i) => (i === idx ? slug : v)));

  const preset = (form: string) => {
    const top = items
      .filter((i) => i.form === form && i.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 2)
      .map((i) => i.slug);
    setSlots([top[0] ?? '', top[1] ?? '', '']);
  };

  /** 最佳值：只在有 ≥2 个不同数值时标注，避免「唯一有数据」也算赢 */
  const best = (row: NumRow): Set<string> => {
    const vals = active
      .map((i) => ({ slug: i.slug, v: row.get(i) }))
      .filter((x): x is { slug: string; v: number } => x.v != null);
    if (vals.length < 2) return new Set();
    const target = row.better === 'high' ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
    const winners = vals.filter((x) => x.v === target);
    if (winners.length === vals.length) return new Set();
    return new Set(winners.map((x) => x.slug));
  };

  return (
    <div>
      <div class="cmp-pickers">
        {slots.map((slug, idx) => (
          <label class="cmp-pick">
            <span class="cmp-pick-label">
              {['A', 'B', 'C'][idx]}
              <i>{idx === 0 ? '必选' : '可选'}</i>
            </span>
            <select
              value={slug}
              onChange={(e) => setSlot(idx, (e.currentTarget as HTMLSelectElement).value)}
            >
              <option value="">选择 agent…</option>
              {grouped.map((g) => (
                <optgroup label={formLabel(g.form)}>
                  {g.list.map((i) => (
                    <option value={i.slug} disabled={slots.includes(i.slug) && i.slug !== slug}>
                      {i.name}
                      {i.score != null ? ` · ${i.score}` : ' · 未上榜'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}
      </div>

      {active.length < 2 && (
        <div class="cmp-presets">
          <span class="muted">快速开始：</span>
          {['cli', 'ide-plugin', 'framework', 'browser'].map((f) => (
            <button type="button" class="chip" onClick={() => preset(f)}>
              比 {formLabel(f)} 前二
            </button>
          ))}
        </div>
      )}

      {mixedForms && (
        <div class="notice" style="margin:16px 0">
          <strong>跨形态对比：</strong>不同形态的 Star / 安装量不可直接比较，综合分也来自不同分组。这里只做参数参考。
        </div>
      )}

      {active.length >= 2 ? (
        <div class="table-wrap cmp-wrap">
          <table class="cmp-table">
            <thead>
              <tr>
                <th class="cmp-metric">指标</th>
                {active.map((i) => (
                  <th class="cmp-col">
                    <a class="cmp-head" href={`/agent/${i.slug}/`}>
                      <AgentIcon
                        slug={i.slug}
                        name={i.name}
                        icon={i.icon}
                        iconFallback={i.iconFallback}
                        size={30}
                      />
                      <span>
                        <span class="name">{i.name}</span>
                        <span class="cmp-sub">{formLabel(i.form)}</span>
                      </span>
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const winners = row.kind === 'num' ? best(row) : new Set<string>();
                return (
                  <tr>
                    <th class="cmp-metric" scope="row">{row.label}</th>
                    {active.map((i) => {
                      const win = winners.has(i.slug);
                      if (row.kind === 'num') {
                        const v = row.get(i);
                        return (
                          <td class={`cmp-cell num${win ? ' is-best' : ''}`}>
                            {v == null ? '—' : row.fmt(v)}
                            {win && <i class="cmp-dot" aria-label="本行最佳" />}
                          </td>
                        );
                      }
                      return <td class="cmp-cell">{row.get(i)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div class="cmp-empty">
          <span class="eyebrow">Compare</span>
          <h3>选两个 agent，并排看差异</h3>
          <p class="muted">
            同一形态内的指标才有可比性。上面选 A / B，或用「快速开始」直接对比某形态的前两名。
          </p>
        </div>
      )}

      <p class="cmp-foot muted">
        标注 <i class="cmp-dot" /> 的是该行最优值（仅在有 ≥2 个不同数值时标注）。跨形态不排名，详情见
        <a href="/about/">口径说明</a>。
      </p>
    </div>
  );
}