import { useEffect, useMemo, useState } from 'preact/hooks';
import AgentIcon from './AgentIcon';
import { PIN_EVENT, readPins, togglePin } from '../lib/pins';
import {
  FORM_ORDER,
  GRANS,
  bucketBadgeClass,
  bucketText,
  defaultSortFor,
  fmt,
  fmtPct,
  fmtSigned,
  formLabel,
  granLabel,
  rankUrl,
} from '../lib/shared';

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
}

const FLAG_LABEL: Record<string, string> = {
  partial_data: '数据不全',
  no_data: '数据未公开',
  installs_may_include_ci: '含 CI 安装',
  small_group: '样本少',
};

type SortKey = 'score' | 'stars' | 'delta_1d' | 'delta_7d' | 'growth_30d_pct' | 'installs' | 'activity';

type Col = {
  key: SortKey;
  label: string;
  get: (r: RankRow) => number | null;
  show: (rows: RankRow[]) => boolean;
  format: (r: RankRow) => string;
  /** 行内微条：把数值长度化，方便竖着扫 */
  bar?: boolean;
};

const COLS: Col[] = [
  { key: 'score', label: '综合分', get: (r) => r.score, show: () => true, format: (r) => (r.score != null ? String(r.score) : '—'), bar: true },
  { key: 'stars', label: 'Star', get: (r) => r.metrics.stars, show: (rs) => rs.some((r) => r.metrics.stars != null), format: (r) => fmt(r.metrics.stars), bar: true },
  { key: 'installs', label: '安装量', get: (r) => r.metrics.installs, show: (rs) => rs.some((r) => r.metrics.installs != null), format: (r) => fmt(r.metrics.installs), bar: true },
  { key: 'activity', label: '活跃', get: (r) => r.metrics.activity, show: (rs) => rs.some((r) => r.metrics.activity != null), format: (r) => (r.metrics.activity != null ? r.metrics.activity.toFixed(2) : '—') },
  { key: 'delta_1d', label: '日增', get: (r) => r.delta_1d, show: (rs) => rs.some((r) => r.delta_1d != null), format: (r) => fmtSigned(r.delta_1d) },
  { key: 'delta_7d', label: '7d 增', get: (r) => r.delta_7d, show: (rs) => rs.some((r) => r.delta_7d != null), format: (r) => fmtSigned(r.delta_7d) },
  { key: 'growth_30d_pct', label: '30d 增速', get: (r) => r.growth_30d_pct, show: (rs) => rs.some((r) => r.growth_30d_pct != null), format: (r) => fmtPct(r.growth_30d_pct) },
];

export default function RankBoard(props: Props) {
  const allRows = props.rows;
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

  const cols = useMemo(() => COLS.filter((c) => c.show(allRows)), [allRows]);

  /** 每个数值列的最大值，用来算微条长度（按全量算，切筛选时长度不跳） */
  const maxOf = useMemo(() => {
    const m: Partial<Record<SortKey, number>> = {};
    for (const c of COLS) {
      const vals = allRows.map((r) => c.get(r)).filter((v): v is number => v != null);
      if (vals.length) m[c.key] = Math.max(...vals.map(Math.abs));
    }
    return m;
  }, [allRows]);

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
  }, [filtered, sortKey, sortDir]);

  useEffect(() => {
    const url = rankUrl(bucket, form, gran);
    if (window.location.pathname !== url) window.history.replaceState(null, '', url);
    const title = bucket === 'open' ? '开源榜' : '闭源榜';
    document.title = `${title} · AgentNews`;
    const h1 = document.getElementById('rank-title');
    if (h1) h1.textContent = title;
  }, [bucket, form, gran]);

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

  return (
    <div>
      <div class="rank-toolbar">
        <div class="row" style="gap:6px">
          <span class="eyebrow" style="font-size:9px">归属</span>
          <div class="segmented" role="group" aria-label="开源闭源">
            {['open', 'closed'].map((b) => (
              <button
                type="button"
                aria-current={bucket === b ? 'page' : undefined}
                onClick={() => setBucket(b)}
              >
                {b === 'open' ? '开源' : '闭源'}
              </button>
            ))}
          </div>
        </div>
        <div class="row" style="gap:6px">
          <span class="eyebrow" style="font-size:9px">粒度</span>
          <div class="segmented" role="group" aria-label="时间粒度">
            {GRANS.map((gg) => (
              <button type="button" aria-current={gran === gg ? 'page' : undefined} onClick={() => changeGran(gg)}>
                {granLabel(gg)}
              </button>
            ))}
          </div>
        </div>
        <span class="rank-toolbar-count">
          {filtered.length} agent · {groups.length} 形态 · {rankedCount} 在榜
        </span>
      </div>

      <nav class="tabs" aria-label="形态筛选">
        {(['all', ...FORM_ORDER] as string[]).map((f) => (
          <a
            class="tab"
            href={rankUrl(bucket, f, gran)}
            aria-current={form === f ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              setForm(f);
            }}
          >
            {formLabel(f)}
          </a>
        ))}
      </nav>

      {!hasDeltas && (
        <p class="rank-hint">增量数据积累中：日 / 周榜需 ≥1 天历史快照，当前按综合分排序。</p>
      )}

      {groups.length === 0 && (
        <div class="box rank-empty">
          <div class="box-body">
            <h3 style="margin-bottom:3px">当前筛选下没有 agent</h3>
            <p class="muted" style="font-size:12.5px">
              {form !== 'all' ? `${formLabel(form)} 在${bucket === 'open' ? '开源' : '闭源'}榜暂无收录。` : '该归属下暂无收录条目。'}
            </p>
            <button class="btn" style="margin-top:10px" onClick={() => { setForm('all'); setBucket('open'); }}>
              查看全部开源
            </button>
          </div>
        </div>
      )}

      <div class="stack">
        {groups.map((grp) => (
          <section class="box" key={grp.form}>
            <div class="box-header">
              <span class="row" style="gap:7px">
                {formLabel(grp.form)}
                <span class="counter">{grp.rows.filter((r) => r._displayRank != null).length}</span>
              </span>
              <span style="font-weight:400;letter-spacing:0.04em">
                {COLS.find((c) => c.key === sortKey)?.label} {sortDir === 'desc' ? '↓' : '↑'} · 同形态内
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
                    <th style="width:2rem" aria-label="钉选"></th>
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
                            <a class="name" href={`/agent/${r.slug}/`}>{r.name}</a>
                            <span class={`badge ${bucketBadgeClass(r.oss_bucket)}`}>{bucketText(r.oss_bucket)}</span>
                            {r.flags.map((f) => (
                              <span class="badge b-semi">{FLAG_LABEL[f] ?? f}</span>
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
                          aria-label={pins.includes(r.slug) ? `取消钉选 ${r.name}` : `钉选 ${r.name} 以便对比`}
                          aria-pressed={pins.includes(r.slug)}
                          title="钉选，稍后对比"
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
                  <a class="rank-card-main" href={`/agent/${r.slug}/`}>
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
                        <span class={`badge ${bucketBadgeClass(r.oss_bucket)}`}>{bucketText(r.oss_bucket)}</span>
                        {r.flags.slice(0, 1).map((f) => (
                          <span class="badge b-semi">{FLAG_LABEL[f] ?? f}</span>
                        ))}
                      </span>
                    </span>
                    <span class="rank-card-score">{r.score != null ? r.score : '—'}</span>
                    <button
                      type="button"
                      class={`pin-btn${pins.includes(r.slug) ? ' is-pinned' : ''}`}
                      aria-label="钉选对比"
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
