import { useMemo, useState } from 'preact/hooks';
import AgentIcon from './AgentIcon';
import { FORM_ORDER, bucketBadgeClass, bucketText, formLabel, fmt, rankUrl } from '../lib/shared';
import type { IconMeta } from './RankBoard';

export type PickRow = {
  slug: string;
  name: string;
  vendor: string | null;
  form: string;
  oss_bucket: string;
  score: number | null;
  stars: number | null;
};

interface Props {
  items: PickRow[];
  meta: Record<string, IconMeta>;
}

/**
 * 首页选型入口：搜索 + 形态/归属筛选，全部在客户端完成。
 * 目标：不用先进榜单再筛，30 秒内找到候选 agent（PRD G1）。
 */
export default function HomePicker({ items, meta }: Props) {
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<'open' | 'closed'>('open');
  const [form, setForm] = useState('all');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((r) => (bucket === 'open' ? r.oss_bucket !== 'closed' : r.oss_bucket === 'closed'))
      .filter((r) => form === 'all' || r.form === form)
      .filter((r) => {
        if (!needle) return true;
        return `${r.name} ${r.slug} ${r.vendor ?? ''}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [items, q, bucket, form]);

  const shown = list.slice(0, 8);
  const go = (slug: string) => {
    window.location.href = `/agent/${slug}/`;
  };

  return (
    <div class="picker">
      <div class="picker-search">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z" />
        </svg>
        <input
          class="picker-input"
          type="search"
          value={q}
          placeholder="搜索 agent：名称、厂商或 slug"
          aria-label="搜索 agent"
          autocomplete="off"
          onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && shown[0]) go(shown[0].slug);
          }}
        />
        {q && (
          <button class="picker-clear" type="button" aria-label="清空搜索" onClick={() => setQ('')}>
            ×
          </button>
        )}
      </div>

      <div class="picker-filters">
        <div class="segmented" role="group" aria-label="归属">
          {(['open', 'closed'] as const).map((b) => (
            <a
              href={rankUrl(b, form, 'month')}
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
        <div class="chips" role="group" aria-label="形态">
          {(['all', ...FORM_ORDER] as string[]).map((f) => (
            <button type="button" class="chip" aria-pressed={form === f} onClick={() => setForm(f)}>
              {formLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <div class="picker-summary">
        <span class="muted">
          {q ? `${list.length} 个匹配` : `共 ${list.length} 个${bucket === 'open' ? '开源' : '闭源'} agent`}
          {list.length > shown.length ? ` · 显示前 ${shown.length} 个` : ''}
        </span>
        <a class="btn btn-sm" href={rankUrl(bucket, form, 'month')}>
          查看完整榜单 →
        </a>
      </div>

      {shown.length === 0 ? (
        <div class="picker-empty muted">
          没有匹配的 agent。换个关键词，或
          <button type="button" class="link-btn" onClick={() => { setQ(''); setForm('all'); }}>
            清除筛选
          </button>
        </div>
      ) : (
        <ul class="picker-list">
          {shown.map((r) => (
            <li>
              <a class="picker-item" href={`/agent/${r.slug}/`}>
                <AgentIcon
                  slug={r.slug}
                  name={r.name}
                  icon={meta[r.slug]?.icon}
                  iconFallback={meta[r.slug]?.iconFallback}
                  size={28}
                />
                <span class="picker-item-main">
                  <span class="row" style="gap:6px">
                    <span class="name">{r.name}</span>
                    <span class={`badge ${bucketBadgeClass(r.oss_bucket)}`}>{bucketText(r.oss_bucket)}</span>
                  </span>
                  <span class="picker-item-meta">
                    {formLabel(r.form)}
                    {r.vendor ? ` · ${r.vendor}` : ''}
                    {r.stars != null ? ` · ${fmt(r.stars)} star` : ''}
                  </span>
                </span>
                <span class="picker-item-score">{r.score != null ? r.score : '—'}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}