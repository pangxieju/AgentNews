import { useEffect, useMemo, useState } from 'preact/hooks';
import AgentIcon from './AgentIcon';
import { PIN_EVENT, readPins, togglePin } from '../lib/pins';
import { fmt, fmtPct, fmtSigned, rankUrl, defaultSortFor, GRANS, FORM_ORDER } from '../lib/shared';
import { type Lang, bucketText, flagLabel, formLabel, granLabel, pathFor, t } from '../i18n/dict';

export type RankRow = {
  slug: string;
  name: string;
  form: string;
  oss_bucket: string;
  score: number | null;
  rank_in_form: number | null;
  delta_1d: number | null;
  delta_7d: number | null;
  growth_30d_pct: number | null;
  metrics: {
    stars: number | null;
    installs: number | null;
    activity: number | null;
    /** OpenRouter 月 token 用量（仅收录在该榜的 agent 有值） */
    openrouter_tokens_month?: number | null;
  };
  flags: string[];
  data_level: string;
};

export type IconMeta = { icon: string | null; iconFallback: string | null };

interface Props {
  rows: RankRow[];
  meta: Record<string, IconMeta>;
  bucket: string;
  form: string;
  g: string;
  lang: Lang;
}

type SortKey = 'score' | 'stars' | 'delta_1d' | 'delta_7d' | 'growth_30d_pct' | 'installs' | 'activity' | 'openrouter_tokens_month';

type Col = {
  key: SortKey;
  label: string;
  get: (r: RankRow) => number | null;
  show: (rows: RankRow[]) => boolean;
  format: (r: RankRow) => string;
  bar?: boolean;
};

function columns(lang: Lang): Col[] {
  return [
    { key: 'score', label: t(lang, 'metric.score'), get: (r) => r.score, show: () => true, format: (r) => (r.score != null ? String(r.score) : '—'), bar: true },
    { key: 'stars', label: t(lang, 'metric.stars'), get: (r) => r.metrics.stars, show: (rs) => rs.some((r) => r.metrics.stars != null), format: (r) => fmt(r.metrics.stars), bar: true },
    { key: 'installs', label: t(lang, 'metric.installs'), get: (r) => r.metrics.installs, show: (rs) => rs.some((r) => r.metrics.installs != null), format: (r) => fmt(r.metrics.installs), bar: true },
    { key: 'activity', label: t(lang, 'metric.activityShort'), get: (r) => r.metrics.activity, show: (rs) => rs.some((r) => r.metrics.activity != null), format: (r) => (r.metrics.activity != null ? r.metrics.activity.toFixed(2) : '—') },
    {
      key: 'openrouter_tokens_month',
      label: t(lang, 'metric.openrouterTokens'),
      get: (r) => r.metrics.openrouter_tokens_month ?? null,
      show: (rs) => rs.some((r) => r.metrics.openrouter_tokens_month != null),
      format: (r) => fmt(r.metrics.openrouter_tokens_month),
      bar: true,
    },
    { key: 'delta_1d', label: t(lang, 'metric.delta1d'), get: (r) => r.delta_1d, show: (rs) => rs.some((r) => r.delta_1d != null), format: (r) => fmtSigned(r.delta_1d) },
    { key: 'delta_7d', label: t(lang, 'metric.delta7d'), get: (r) => r.delta_7d, show: (rs) => rs.some((r) => r.delta_7d != null), format: (r) => fmtSigned(r.delta_7d) },
    { key: 'growth_30d_pct', label: t(lang, 'metric.growth30d'), get: (r) => r.growth_30d_pct, show: (rs) => rs.some((r) => r.growth_30d_pct != null), format: (r) => fmtPct(r.growth_30d_pct) },
  ];
}

export default function RankBoard(props: Props) {
  const { lang } = props;
  const allRows = props.rows;
  const COLS = useMemo(() => columns(lang), [lang]);
  const H = (p: string) => pathFor(lang, p);

  const [bucket, setBucket] = useState(props.bucket);
  const [form, setForm] = useState(props.form);
  const [gran, setGran] = useState(props.g);
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortFor(props.g) as SortKey);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [pins, setPins] = useState<string[]>([]);

  useEffect(() => {
    setPins(readPins());
    const onPins = (e: Event) => setPins((e as CustomEvent<string[]>).detail ?? readPins());
    window.addEventListener(PIN_EVENT, onPins);
    return () => window.removeEventListener(PIN_EVENT, onPins);
  }, []);

  const cols = useMemo(() => COLS.filter((c) => c.show(allRows)), [COLS, allRows]);

  const maxOf = useMemo(() => {
    const m: Partial<Record<SortKey, number>> = {};
    for (const c of COLS) {
      const vals = allRows.map((r) => c.get(r)).filter((v): v is number => v != null);
      if (vals.length) m[c.key] = Math.max(...vals.map(Math.abs));
    }
    return m;
  }, [COLS, allRows]);

  const filtered = useMemo(() => {
    let list = allRows;
    if (bucket === 'open') list = list.filter((r) => r.oss_bucket !== 'closed');
    if (bucket === 'closed') list = list.filter((r) => r.oss_bucket === 'closed');
    if (form !== 'all') list = list.filter((r) => r.form === form);
    return list;
  }, [allRows, bucket, form]);

  const groups = useMemo(() => {
    const col = COLS.find((c) => c.key === sortKey)!;
    return FORM_ORDER.map((f) => {
      const rows = filtered
        .filter((r) => r.form === f)
        .sort((a, b) => {
          const av = col.get(a);
          const bv = col.get(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return sortDir === 'desc' ? bv - av : av - bv;
        });
      let n = 0;
      return { form: f, rows: rows.map((r) => ({ ...r, _displayRank: r.score != null ? ++n : null })) };
    }).filter((g) => g.rows.length > 0);
  }, [COLS, filtered, sortKey, sortDir]);

  useEffect(() => {
    const url = H(rankUrl(bucket, form, gran));
    if (window.location.pathname !== url) window.history.replaceState(null, '', url);
    const title = bucket === 'open' ? t(lang, 'rank.titleOpen') : t(lang, 'rank.titleClosed');
    document.title = `${title} · AgentNews`;
    const h1 = document.getElementById('rank-title');
    if (h1) h1.textContent = title;
  }, [bucket, form, gran, lang]);

  const changeGran = (next: string) => {
    setGran(next);
    setSortKey(defaultSortFor(next) as SortKey);
    setSortDir('desc');
  };

  const clickHeader = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const rankedCount = groups.reduce((n, g) => n + g.rows.filter((r) => r._displayRank != null).length, 0);
  const hasDeltas = allRows.some((r) => r.delta_1d != null || r.delta_7d != null);
  const sortLabel = COLS.find((c) => c.key === sortKey)?.label ?? '';

  return (
    <div>
      <div class="rank-toolbar">
        <div class="row" style="gap:6px">
          <span class="eyebrow" style="font-size:10px">{t(lang, 'rank.owner')}</span>
          <div class="segmented" role="group" aria-label={t(lang, 'rank.owner')}>
            {['open', 'closed'].map((b) => (
              <button type="button" aria-current={bucket === b ? 'page' : undefined} onClick={() => setBucket(b)}>
                {bucketText(lang, b)}
              </button>
            ))}
          </div>
        </div>
        <div class="row" style="gap:6px">
          <span class="eyebrow" style="font-size:10px">{t(lang, 'rank.gran')}</span>
          <div class="segmented" role="group" aria-label={t(lang, 'rank.gran')}>
            {GRANS.map((gg) => (
              <button type="button" aria-current={gran === gg ? 'page' : undefined} onClick={() => changeGran(gg)}>
                {granLabel(lang, gg)}
              </button>
            ))}
          </div>
        </div>
        <span class="rank-toolbar-count">
          {t(lang, 'rank.count', { n: filtered.length, forms: groups.length, ranked: rankedCount })}
        </span>
      </div>

      <nav class="tabs" aria-label={t(lang, 'picker.form')}>
        {(['all', ...FORM_ORDER] as string[]).map((f) => (
          <a
            class="tab"
            href={H(rankUrl(bucket, f, gran))}
            aria-current={form === f ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              setForm(f);
            }}
          >
            {f === 'all' ? t(lang, 'app.all') : formLabel(lang, f)}
          </a>
        ))}
      </nav>

      {!hasDeltas && <p class="rank-hint">{t(lang, 'rank.hint')}</p>}

      {groups.length === 0 && (
        <div class="box rank-empty">
          <div class="box-body">
            <h3 style="margin-bottom:3px">{t(lang, 'rank.emptyTitle')}</h3>
            <p class="muted" style="font-size:12.5px">
              {form !== 'all'
                ? t(lang, 'rank.emptyForm', {
                    form: formLabel(lang, form),
                    bucket: bucket === 'open' ? bucketText(lang, 'open') : bucketText(lang, 'closed'),
                  })
                : t(lang, 'rank.emptyBucket')}
            </p>
            <button class="btn" style="margin-top:10px" onClick={() => { setForm('all'); setBucket('open'); }}>
              {t(lang, 'rank.emptyCta')}
            </button>
          </div>
        </div>
      )}

      <div class="stack">
        {groups.map((grp) => (
          <section class="box" key={grp.form}>
            <div class="box-header">
              <span class="row" style="gap:7px">
                {formLabel(lang, grp.form)}
                <span class="counter">{grp.rows.filter((r) => r._displayRank != null).length}</span>
              </span>
              <span style="font-weight:400;letter-spacing:0.04em">
                {t(lang, 'rank.sortBy', { label: sortLabel })} {sortDir === 'desc' ? '↓' : '↑'} · {t(lang, 'rank.sameForm')}
              </span>
            </div>

            <div class="table-wrap">
              <table class="rank-table">
                <thead>
                  <tr>
                    <th class="pos">#</th>
                    <th>Agent</th>
                    {cols.map((c) => (
                      <th
                        class="num sortable"
                        aria-sort={sortKey === c.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                      >
                        <button type="button" onClick={() => clickHeader(c.key)}>
                          {c.label}
                          <span class="sort-caret" aria-hidden="true">
                            {sortKey === c.key ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th style="width:2rem" aria-label="pin"></th>
                  </tr>
                </thead>
                <tbody>
                  {grp.rows.map((r) => (
                    <tr class="rank-row">
                      <td class="pos">{r._displayRank ?? '—'}</td>
                      <td>
                        <div class="agent-cell">
                          <AgentIcon
                            slug={r.slug}
                            name={r.name}
                            icon={props.meta[r.slug]?.icon}
                            iconFallback={props.meta[r.slug]?.iconFallback}
                            size={22}
                          />
                          <span class="tags">
                            <a class="name" href={H(`/agent/${r.slug}/`)}>{r.name}</a>
                            <span class={`badge ${r.oss_bucket === 'open' ? 'b-open' : r.oss_bucket === 'semi' ? 'b-semi' : 'b-closed'}`}>
                              {bucketText(lang, r.oss_bucket)}
                            </span>
                            {r.flags.map((f) => (
                              <span class="badge b-semi">{flagLabel(lang, f)}</span>
                            ))}
                          </span>
                        </div>
                      </td>
                      {cols.map((c) => {
                        const v = c.get(r);
                        const max = maxOf[c.key] ?? 0;
                        return (
                          <td class="num">
                            {c.bar && v != null && max > 0 ? (
                              <span class="micro">
                                <span class="micro-track">
                                  <span class="micro-fill heat" style={`width:${Math.max(3, (Math.abs(v) / max) * 100).toFixed(1)}%`} />
                                </span>
                                <span>{c.format(r)}</span>
                              </span>
                            ) : (
                              c.format(r)
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <button
                          type="button"
                          class={`pin-btn${pins.includes(r.slug) ? ' is-pinned' : ''}`}
                          aria-label={
                            pins.includes(r.slug)
                              ? t(lang, 'rank.unpin', { name: r.name })
                              : t(lang, 'rank.pin', { name: r.name })
                          }
                          aria-pressed={pins.includes(r.slug)}
                          title={t(lang, 'rank.pinTitle')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPins(togglePin(r.slug));
                          }}
                        >
                          {pins.includes(r.slug) ? '✓' : '+'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul class="rank-cards">
              {grp.rows.map((r) => (
                <li class="rank-card">
                  <a class="rank-card-main" href={H(`/agent/${r.slug}/`)}>
                    <span class="pos">{r._displayRank ?? '—'}</span>
                    <AgentIcon
                      slug={r.slug}
                      name={r.name}
                      icon={props.meta[r.slug]?.icon}
                      iconFallback={props.meta[r.slug]?.iconFallback}
                      size={28}
                    />
                    <span class="rank-card-name">
                      <span class="name">{r.name}</span>
                      <span class="tags">
                        <span class={`badge ${r.oss_bucket === 'open' ? 'b-open' : r.oss_bucket === 'semi' ? 'b-semi' : 'b-closed'}`}>
                          {bucketText(lang, r.oss_bucket)}
                        </span>
                        {r.flags.slice(0, 1).map((f) => (
                          <span class="badge b-semi">{flagLabel(lang, f)}</span>
                        ))}
                      </span>
                    </span>
                    <span class="rank-card-score">{r.score != null ? r.score : '—'}</span>
                    <button
                      type="button"
                      class={`pin-btn${pins.includes(r.slug) ? ' is-pinned' : ''}`}
                      aria-label={t(lang, 'rank.pin', { name: r.name })}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPins(togglePin(r.slug));
                      }}
                    >
                      {pins.includes(r.slug) ? '✓' : '+'}
                    </button>
                  </a>
                  <div class="rank-card-stats">
                    {cols
                      .filter((c) => c.key !== 'score')
                      .map((c) => (
                        <span>
                          <em>{c.label}</em>
                          {c.format(r)}
                        </span>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}