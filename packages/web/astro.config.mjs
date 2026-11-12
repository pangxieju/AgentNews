// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

/**
 * 站点地址优先级：
 * 1. 环境变量 SITE_URL（CI / 部署时注入）
 * 2. 占位域名（本地开发）
 */
const site = process.env.SITE_URL || 'https://agentnews-c5h.pages.dev';

/** 冻结 / 误分类条目：详情页保留（noindex），但不进 sitemap */
function frozenSlugs() {
  try {
    const txt = readFileSync(new URL('../../agents.yaml', import.meta.url), 'utf8');
    const list = YAML.parse(txt) ?? [];
    const FROZEN = ['desktop', 'browser', 'framework', 'autonomous'];
    const EXCLUDED = new Set(['theia', 'vercel-ai-sdk', 'open-interpreter']);
    return new Set(list.filter((a) => FROZEN.includes(a.form) || EXCLUDED.has(a.slug)).map((a) => a.slug));
  } catch {
    return new Set();
  }
}

const noindex = (page) => {
  const path = new URL(page).pathname.replace(/\/+$/, '') || '/';
  if (path.endsWith('/404') || path === '/feed') return true;
  const m = path.match(/\/agent\/([^/]+)$/);
  return !!m && frozenSlugs().has(m[1]);
};

export default defineConfig({
  integrations: [preact(), sitemap({ filter: (page) => !noindex(page) })],
  output: 'static',
  site,
  trailingSlash: 'always',
  build: {
    inlineStylesheets: 'auto',
  },
});