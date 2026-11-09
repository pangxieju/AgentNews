import { useEffect, useMemo, useState } from 'preact/hooks';
import AgentIcon from './AgentIcon';
import { type Lang, bucketText, formLabel, pathFor, t } from '../i18n/dict';
import { fmt, fmtPct } from '../lib/shared';

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
  lang: Lang;
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

function rows(lang: Lang): Row[] {
  return [
    { kind: 'num', key: 'score', label: t(lang, 'metric.score'), get: (i) => i.score, better: 'high', fmt: (n) => String(n) },
    { kind: 'num', key: 'rank', label: t(lang, 'metric.rank'), get: (i) => i.rank_in_form, better: 'low', fmt: (n) => `#${n}` },
    { kind: 'num', key: 'stars', label: t(lang, 'metric.stars'), get: (i) => i.stars, better: 'high', fmt: (n) => fmt(n) },
    { kind: 'num', key: 'forks', label: t(lang, 'metric.forks'), get: (i) => i.forks, better: 'high', fmt: (n) => fmt(n) },
    { kind: 'num', key: 'contributors', label: t(lang, 'metric.contributors'), get: (i) => i.contributors, better: 'high', fmt: (n) => fmt(n) },
    { kind: 'num', key: 'installs', label: t(lang, 'metric.installs'), get: (i) => i.installs, better: 'high', fmt: (n) => fmt(n) },
    { kind: 'num', key: 'activity', label: t(lang, 'metric.activity'), get: (i) => i.activity, better: 'high', fmt: (n) => n.toFixed(2) },
    { kind: 'num', key: 'growth', label: t(lang, 'metric.growth30d'), get: (i) => i.growth_30d_pct, better: 'high', fmt: (n) => fmtPct(n) },
    { kind: 'text', key: 'level', label: t(lang, 'metric.level'), get: (i) => i.data_level },
    { kind: 'text', key: 'bucket', label: t(lang, 'metric.bucket'), get: (i) => bucketText(lang, i.oss_bucket) },
    { kind: 'text', key: 'license', label: t(lang, 'metric.license'), get: (i) => i.license ?? '—' },
    { kind: 'text', key: 'release', label: t(lang, 'metric.release'), get: (i) => (i.last_release ? i.last_release.slice(0, 10) : '—') },
    {
      kind: 'text',
      key: 'version',
      label: t(lang, 'metric.version'),
      get: (i) => (i.version ? (i.version_at ? `${i.version} · ${i.version_at.slice(0, 10)}` : i.version) : '—'),
    },
  ];
}

export default function CompareBoard({ items, lang }: Props) {
  const [slots, setSlots] = useState<string[]>(['', '', '']);
  const H = (p: string) => pathFor(lang, p);
  const table = rows(lang);

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
      [...new Set(items.map((i) => i.form))]
        .map((f) => ({
          form: f,
          list: items.filter((i) => i.form === f).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
        }))
        .filter((g) => g.list.length > 0),
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

  /** 最佳值：只在有 ≥2 个不同数值时标注 */
  const best = (row: NumRow): Set<string> => {
    const vals = active
      .map((i) => ({ slug: i.slug, v: row.get(i) }))
      .filter((x): x is { slug: string; v: number } => x.v != null);
    if (vals.length < 2) return new Set();
    const target =
      row.better === 'high' ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
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
              <i>{idx === 0 ? t(lang, 'compare.required') : t(lang, 'compare.optional')}</i>
            </span>
            <select
              value={slug}
              onChange={(e) => setSlot(idx, (e.currentTarget as HTMLSelectElement).value)}
            >
              <option value="">{t(lang, 'compare.pickPlaceholder')}</option>
              {grouped.map((g) => (
                <optgroup label={formLabel(lang, g.form)}>
                  {g.list.map((i) => (
                    <option value={i.slug} disabled={slots.includes(i.slug) && i.slug !== slug}>
                      {i.name}
                      {i.score != null ? ` · ${i.score}` : ` · ${t(lang, 'app.notRanked')}`}
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
          <span>{t(lang, 'compare.quick')}</span>
          {['cli', 'ide-plugin', 'framework', 'browser'].map((f) => (
            <button type="button" class="chip" onClick={() => preset(f)}>
              {t(lang, 'compare.preset', { form: formLabel(lang, f) })}
            </button>
          ))}
        </div>
      )}

      {mixedForms && (
        <div class="notice" style="margin:16px 0">
          <strong>{t(lang, 'compare.mixedTitle')}</strong>
          {t(lang, 'compare.mixed')}
        </div>
      )}

      {active.length >= 2 ? (
        <div class="table-wrap cmp-wrap">
          <table class="cmp-table">
            <thead>
              <tr>
                <th class="cmp-metric">{t(lang, 'agent.metric')}</th>
                {active.map((i) => (
                  <th class="cmp-col">
                    <a class="cmp-head" href={H(`/agent/${i.slug}/`)}>
                      <AgentIcon
                        slug={i.slug}
                        name={i.name}
                        icon={i.icon}
                        iconFallback={i.iconFallback}
                        size={30}
                      />
                      <span>
                        <span class="name">{i.name}</span>
                        <span class="cmp-sub">{formLabel(lang, i.form)}</span>
                      </span>
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((row) => {
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
                            {win && <i class="cmp-dot" aria-label="best in row" />}
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
          <h3>{t(lang, 'compare.emptyTitle')}</h3>
          <p class="muted">{t(lang, 'compare.empty')}</p>
        </div>
      )}

      <p class="cmp-foot">
        <i class="cmp-dot" /> {t(lang, 'compare.bestNote')} <a href={H('/about/')}>{t(lang, 'rank.method')}</a>.
      </p>
    </div>
  );
}