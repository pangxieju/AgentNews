import { useEffect, useMemo, useState } from 'preact/hooks';
import AgentIcon from './AgentIcon';
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

type SortKey =
  | 'score'
  | 'stars'
  | 'delta_1d'
  | 'delta_7d'
  | 'growth_30d_pct'
  | 'installs'
  | 'activity';

const COLUMNS: Array<{
  key: SortKey;
  label: string;
  get: (r: RankRow) => number | null;
  /** 该列是否值得显示（数据全空就隐藏，避免首屏一片「—」） */
  show: (rows: RankRow[]) => boolean;
  format: (r: RankRow) => string;
}> = [
  { key: 'score', label: '综合分', get: (r) => r.score, show: () => true, format: (r) => (r.score != null ? String(r.score) : '—') },
  { key: 'stars', label: 'Star', get: (r) => r.metrics.stars, show: (rows) => rows.some((r) => r.metrics.stars != null), format: (r) => fmt(r.metrics.stars) },
  { key: 'delta_1d', label: '日增', get: (r) => r.delta_1d, show: (rows) => rows.some((r) => r.delta_1d != null), format: (r) => fmtSigned(r.delta_1d) },
  { key: 'delta_7d', label: '7d 增', get: (r) => r.delta_7d, show: (rows) => rows.some((r) => r.delta_7d != null), format: (r) => fmtSigned(r.delta_7d) },
  { key: 'growth_30d_pct', label: '30d 增速', get: (r) => r.growth_30d_pct, show: (rows) => rows.some((r) => r.growth_30d_pct != null), format: (r) => fmtPct(r.growth_30d_pct) },
  { key: 'installs', label: '安装量', get: (r) => r.metrics.installs, show: (rows) => rows.some((r) => r.metrics.installs != null), format: (r) => fmt(r.metrics.installs) },
  { key: 'activity', label: '活跃', get: (r) => r.metrics.activity, show: (rows) => rows.some((r) => r.metrics.activity != null), format: (r) => (r.metrics.activity != null ? r.metrics.activity.toFixed(2) : '—') },
];

export default function RankBoard(props: Props) {
  const allRows = props.rows;
  const [bucket, setBucket] = useState(props.bucket);
  const [form, setForm] = useState(props.form);
  const [gran, setGran] = useState(props.g);
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortFor(props.g) as SortKey);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  /** 列可用性按全量行判定 —— 切换筛选时列不会跳来跳去 */
  const visibleColumns = useMemo(() => COLUMNS.filter((c) => c.show(allRows)), [allRows]);

  /** 客户端筛选 + 排序，全量在内存里做，无请求无刷新 */
  const filtered = useMemo(() => {
    let list = allRows;
    if (bucket === 'open') list = list.filter((r) => r.oss_bucket !== 'closed');
    if (bucket === 'closed') list = list.filter((r) => r.oss_bucket === 'closed');
    if (form !== 'all') list = list.filter((r) => r.form === form);
    return list;
  }, [allRows, bucket, form]);

  const groups = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey)!;
    return FORM_ORDER.map((f) => {
      const rows = filtered
        .filter((r) => r.form === f)
        .sort((a, b) => {
          const av = col.get(a);
          const bv = col.get(b);
          // null 永远沉底，不参与方向翻转
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return sortDir === 'desc' ? bv - av : av - bv;
        });
      let n = 0;
      return {
        form: f,
        rows: rows.map((r) => ({ ...r, _displayRank: r.score != null ? ++n : null })),
      };
    }).filter((g) => g.rows.length > 0);
  }, [filtered, sortKey, sortDir]);

  /** URL 同步但不刷新：筛选状态可分享、可前进后退 */
  useEffect(() => {
    const url = rankUrl(bucket, form, gran);
    if (window.location.pathname !== url) window.history.replaceState(null, '', url);
    // 服务端渲染的标题是初始归属，切换后同步更新（避免 H1 与筛选状态不一致）
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

  const go = (slug: string) => {
    window.location.href = `/agent/${slug}/`;
  };

  const hasDeltas = allRows.some((r) => r.delta_1d != null || r.delta_7d != null);
  const rankedCount = groups.reduce((n, g) => n + g.rows.filter((r) => r._displayRank != null).length, 0);

  return (
    <div>
      <div class="rank-toolbar">
        <div class="row" style="gap:6px">
          <span class="muted" style="font-size:12px">归属</span>
          <div class="segmented" role="group" aria-label="开源闭源">
            {['open', 'closed'].map((b) => (
              <a
                href={rankUrl(b, form, gran)}
                aria-current={bucket === b ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setBucket(b);
                }}
              >
                {b === 'open' ? '开源' : '闭源'}
              </a>
            ))}
          </div>
        </div>
        <div class="row" style="gap:6px">
          <span class="muted" style="font-size:12px">时间粒度</span>
          <div class="segmented" role="group" aria-label="时间粒度">
            {GRANS.map((gg) => (
              <a
                href={rankUrl(bucket, form, gg)}
                aria-current={gran === gg ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  changeGran(gg);
                }}
              >
                {granLabel(gg)}
              </a>
            ))}
          </div>
        </div>
        <span class="muted rank-toolbar-count">
          {filtered.length} 个 agent · {groups.length} 个形态 · {rankedCount} 个在榜
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
        <p class="rank-hint">
          增量数据积累中：日榜 / 周榜需要至少 1 天历史快照，当前按综合分排序。
        </p>
      )}

      {groups.length === 0 && (
        <div class="box rank-empty">
          <div class="box-body">
            <h3 style="margin-bottom:4px">当前筛选下没有 agent</h3>
            <p class="muted" style="font-size:13px">
              {form !== 'all' ? `${formLabel(form)} 形态在${bucket === 'open' ? '开源' : '闭源'}榜暂无收录。` : '该归属下暂无收录条目。'}
            </p>
            <button
              class="btn"
              style="margin-top:12px"
              onClick={() => {
                setForm('all');
                setBucket('open');
              }}
            >
              查看全部开源 agent
            </button>
          </div>
        </div>
      )}

      <div class="stack">
        {groups.map((grp) => (
          <section class="box" key={grp.form}>
            <div class="box-header">
              <span class="row" style="gap:8px">
                {formLabel(grp.form)}
                <span class="counter">{grp.rows.filter((r) => r._displayRank != null).length}</span>
              </span>
              <span class="muted" style="font-size:12px;font-weight:400">
                {sortKey === 'score' ? '按综合分排序' : '按当前列排序'} · 同形态内排名
              </span>
            </div>

            <div class="table-wrap">
              <table class="rank-table">
                <thead>
                  <tr>
                    <th class="pos">#</th>
                    <th>Agent</th>
                    {visibleColumns.map((c) => (
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
                  </tr>
                </thead>
                <tbody>
                  {grp.rows.map((r) => (
                    <tr
                      class="rank-row"
                      onClick={(e) => {
                        const t = e.target as HTMLElement;
                        if (t.closest('a, button')) return;
                        go(r.slug);
                      }}
                    >
                      <td class="pos">{r._displayRank ?? '—'}</td>
                      <td>
                        <div class="agent-cell">
                          <AgentIcon slug={r.slug} name={r.name} icon={props.meta[r.slug]?.icon} iconFallback={props.meta[r.slug]?.iconFallback} size={24} />
                          <span class="tags">
                            <a class="name" href={`/agent/${r.slug}/`}>
                              {r.name}
                            </a>
                            <span class={`badge ${bucketBadgeClass(r.oss_bucket)}`}>{bucketText(r.oss_bucket)}</span>
                            {r.flags.map((f) => (
                              <span class="badge b-semi">{FLAG_LABEL[f] ?? f}</span>
                            ))}
                          </span>
                        </div>
                      </td>
                      {visibleColumns.map((c) => (
                        <td class="num" key={c.key}>
                          {c.key === 'score' ? <strong>{c.format(r)}</strong> : c.format(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端：卡片列表（表格在窄屏隐藏） */}
            <ul class="rank-cards">
              {grp.rows.map((r) => (
                <li class="rank-card">
                  <a class="rank-card-main" href={`/agent/${r.slug}/`}>
                    <span class="pos">{r._displayRank ?? '—'}</span>
                    <AgentIcon slug={r.slug} name={r.name} icon={props.meta[r.slug]?.icon} iconFallback={props.meta[r.slug]?.iconFallback} size={32} />
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
                  </a>
                  <div class="rank-card-stats">
                    {visibleColumns
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
