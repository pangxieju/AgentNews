import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { bucketText, formLabel, type Lang, pathFor, t } from '../i18n/dict';
import { FOCUS_FORMS, fmt, fmtPct } from '../lib/shared';
import AgentIcon from './AgentIcon';

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
  /** 定价与约束（来自 data/plans.yml 或 license 推导） */
  plan: {
    free: string;
    price_monthly: number | null;
    price_note: string | null;
    self_host: string;
    confidence: string;
    source_url: string | null;
    checked_at: string | null;
  } | null;
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
    {
      kind: 'text',
      key: 'free',
      label: lang === 'en' ? 'Free tier' : '免费版',
      get: (i) =>
        ({ yes: lang === 'en' ? 'Yes' : '有', limited: lang === 'en' ? 'Limited' : '有限', no: lang === 'en' ? 'No' : '无', unknown: '—' })[
          i.plan?.free ?? 'unknown'
        ] ?? '—',
    },
    {
      kind: 'text',
      key: 'price',
      label: lang === 'en' ? 'Starts at' : '起步价',
      get: (i) => {
        const p = i.plan;
        if (!p) return '—';
        if (p.confidence !== 'verified' || p.price_monthly == null) return lang === 'en' ? 'Unverified' : '未核验';
        return p.price_monthly === 0 ? (lang === 'en' ? '$0 (self-host)' : '$0（自托管）') : `$${p.price_monthly}/mo`;
      },
    },
    {
      kind: 'text',
      key: 'selfhost',
      label: lang === 'en' ? 'Self-host' : '自托管',
      get: (i) =>
        ({ yes: lang === 'en' ? 'Yes' : '可', partial: lang === 'en' ? 'Partial' : '部分', no: lang === 'en' ? 'No' : '不可', unknown: '—' })[
          i.plan?.self_host ?? 'unknown'
        ] ?? '—',
    },
    { kind: 'text', key: 'release', label: t(lang, 'metric.release'), get: (i) => (i.last_release ? i.last_release.slice(0, 10) : '—') },
    {
      kind: 'text',
      key: 'version',
      label: t(lang, 'metric.version'),
      get: (i) => (i.version ? (i.version_at ? `${i.version} · ${i.version_at.slice(0, 10)}` : i.version) : '—'),
    },
  ];
}

/** 三个对比位：URL query 用 a/b/c，槽位数量与 key 一一对应 */
const SLOT_KEYS = ['a', 'b', 'c'] as const;

/** 单元格是否为空（空值统一渲染为 —，用于隐藏全空指标行） */
function blank(row: Row, item: CompareItem): boolean {
  if (row.kind === 'num') {
    const v = row.get(item);
    return v == null || (typeof v === 'number' && Number.isNaN(v));
  }
  const s = (row.get(item) ?? '').trim();
  return s === '' || s === '—';
}

export default function CompareBoard({ items, lang }: Props) {
  const [slots, setSlots] = useState<string[]>(() => SLOT_KEYS.map(() => ''));
  const H = (p: string) => pathFor(lang, p);
  const table = rows(lang);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const seen = new Set<string>();
    setSlots(
      SLOT_KEYS.map((k) => {
        const v = p.get(k) ?? '';
        if (!v || seen.has(v)) return '';
        seen.add(v);
        return v;
      }),
    );
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    slots.forEach((s, i) => {
      const key = SLOT_KEYS[i];
      if (s && key) p.set(key, s);
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
  /** 开源 / 闭源是两套分位命名空间：混比时 score / rank 不可比，不标「最优」 */
  const nsOf = (i: CompareItem) => (i.oss_bucket === 'closed' ? 'closed' : 'open');
  const mixedNamespaces = new Set(active.map(nsOf)).size > 1;

  /* 决策事件：选满 ≥2 个候选计一次 compare（同一组只计一次） */
  const tracked = useRef<Set<string>>(new Set());
  // 用「排序后的 slug 串」当依赖：active 每次渲染都是新数组，直接依赖会每帧都跑 effect
  const activeKey = active
    .map((x) => x.slug)
    .sort()
    .join(',');
  useEffect(() => {
    if (active.length < 2 || tracked.current.has(activeKey)) return;
    tracked.current.add(activeKey);
    (window as unknown as { anTrack?: (e: string, extra?: Record<string, string>) => void })
      .anTrack?.('compare', { a: activeKey });
    // active 由 slots 派生，activeKey 变化时 active 必然同步变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

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

  /** 快速开始：预填该形态前二（第三位留空，最多可再加 1 个） */
  const preset = (form: string) => {
    const top = items
      .filter((i) => i.form === form && i.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 2)
      .map((i) => i.slug);
    setSlots(SLOT_KEYS.map((_, i) => top[i] ?? ''));
  };

  /** 除最优点亮外，全空指标行（含 growth_30d、排名等无数据项）整行隐藏 */
  const visibleRows = table.filter((row) => active.some((i) => !blank(row, i)));

  /** 最佳值：只在有 ≥2 个不同数值时标注 */
  const best = (row: NumRow): Set<string> => {
    if (mixedNamespaces && (row.key === 'score' || row.key === 'rank')) return new Set();
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
          <label key={SLOT_KEYS[idx]} class="cmp-pick">
            <span class="cmp-pick-label">
              {String.fromCharCode(65 + idx)}
              <i>{idx === 0 ? t(lang, 'compare.required') : t(lang, 'compare.optional')}</i>
            </span>
            <select
              value={slug}
              onChange={(e) => setSlot(idx, (e.currentTarget as HTMLSelectElement).value)}
            >
              <option value="">{t(lang, 'compare.pickPlaceholder')}</option>
              {grouped.map((g) => (
                <optgroup key={g.form} label={formLabel(lang, g.form)}>
                  {g.list.map((i) => (
                    <option key={i.slug} value={i.slug} disabled={slots.includes(i.slug) && i.slug !== slug}>
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
          {FOCUS_FORMS.map((f) => (
            <button key={f} type="button" class="chip" onClick={() => preset(f)}>
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

      {mixedNamespaces && (
        <div class="notice" style="margin:16px 0">
          <strong>{t(lang, 'compare.mixedNsTitle')}</strong>
          {t(lang, 'compare.mixedNs')}
        </div>
      )}

      {active.length >= 2 ? (
        <div class="table-wrap cmp-wrap">
          <table class="cmp-table">
            <thead>
              <tr>
                <th class="cmp-metric">{t(lang, 'agent.metric')}</th>
                {active.map((i) => (
                  <th key={i.slug} class="cmp-col">
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
              {visibleRows.map((row) => {
                const winners = row.kind === 'num' ? best(row) : new Set<string>();
                return (
                  <tr key={row.key}>
                    <th class="cmp-metric" scope="row">{row.label}</th>
                    {active.map((i) => {
                      const win = winners.has(i.slug);
                      if (row.kind === 'num') {
                        const v = row.get(i);
                        return (
                          <td key={i.slug} class={`cmp-cell num${win ? ' is-best' : ''}`}>
                            {v == null ? '—' : row.fmt(v)}
                            {win && <i class="cmp-dot" role="img" aria-label="best in row" />}
                          </td>
                        );
                      }
                      return <td key={i.slug} class="cmp-cell">{row.get(i)}</td>;
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