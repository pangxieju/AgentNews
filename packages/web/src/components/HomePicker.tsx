import { useMemo, useState } from 'preact/hooks';
import AgentIcon from './AgentIcon';
import { type Lang, pathFor, t, formLabel, bucketText } from '../i18n/dict';
import { fmt } from '../lib/shared';
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
  lang: Lang;
}

/**
 * 首页选型入口：搜索 + 形态/归属筛选，全部在客户端完成。
 */
export default function HomePicker({ items, meta, lang }: Props) {
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<'open' | 'closed'>('open');
  const [form, setForm] = useState('all');

  const H = (p: string) => pathFor(lang, p);

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
    window.location.href = H(`/agent/${slug}/`);
  };

  const forms = ['all', ...new Set(items.map((i) => i.form))];

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
          placeholder={t(lang, 'picker.placeholder')}
          aria-label={t(lang, 'picker.searchAria')}
          autocomplete="off"
          onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && shown[0]) go(shown[0].slug);
          }}
        />
        {q && (
          <button class="picker-clear" type="button" aria-label={t(lang, 'picker.clear')} onClick={() => setQ('')}>
            ×
          </button>
        )}
      </div>

      <div class="picker-filters">
        <div class="segmented" role="group" aria-label={t(lang, 'picker.owner')}>
          {(['open', 'closed'] as const).map((b) => (
            <button
              type="button"
              aria-current={bucket === b ? 'page' : undefined}
              onClick={() => setBucket(b)}
            >
              {b === 'open' ? t(lang, 'picker.openOnly') : t(lang, 'picker.closedOnly')}
            </button>
          ))}
        </div>
        <div class="chips" role="group" aria-label={t(lang, 'picker.form')}>
          {forms.map((f) => (
            <button type="button" class="chip" aria-pressed={form === f} onClick={() => setForm(f)}>
              {f === 'all' ? t(lang, 'app.all') : formLabel(lang, f)}
            </button>
          ))}
        </div>
      </div>

      <div class="picker-summary">
        <span>
          {q ? t(lang, 'picker.matches', { n: list.length }) : t(lang, 'picker.count', { n: list.length, bucket: bucket === 'open' ? (lang === 'en' ? 'open' : '开源') : lang === 'en' ? 'closed' : '闭源' })}
          {list.length > shown.length ? t(lang, 'picker.showing', { n: shown.length }) : ''}
        </span>
        <a class="btn btn-sm" href={H(bucket === 'open' ? `/top/open/${form}/month/` : `/top/closed/${form}/month/`)}>
          {t(lang, 'picker.fullBoard')}
        </a>
      </div>

      {shown.length === 0 ? (
        <div class="picker-empty">
          {t(lang, 'picker.empty')}
          <button type="button" class="link-btn" onClick={() => { setQ(''); setForm('all'); }}>
            {t(lang, 'picker.reset')}
          </button>
        </div>
      ) : (
        <ul class="picker-list">
          {shown.map((r) => (
            <li>
              <a class="picker-item" href={H(`/agent/${r.slug}/`)}>
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
                    <span class={`badge ${r.oss_bucket === 'open' ? 'b-open' : r.oss_bucket === 'semi' ? 'b-semi' : 'b-closed'}`}>
                      {bucketText(lang, r.oss_bucket)}
                    </span>
                  </span>
                  <span class="picker-item-meta">
                    {formLabel(lang, r.form)}
                    {r.vendor ? ` · ${r.vendor}` : ''}
                    {r.stars != null ? ` · ${t(lang, 'picker.star', { n: fmt(r.stars) })}` : ''}
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