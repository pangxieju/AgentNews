// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import excludedSlugs from './src/lib/excluded-slugs.json';

/**
 * 站点地址优先级：
 * 1. 环境变量 SITE_URL（CI / 部署时注入）
 * 2. 占位域名（本地开发）
 */
const site = process.env.SITE_URL || 'https://agentnews-c5h.pages.dev';

/** 误分类条目：详情页保留（noindex），不进 sitemap。与 src/lib/shared.ts 共用同一份清单 */
const EXCLUDED_SLUGS = new Set(excludedSlugs);

const noindex = (page) => {
  const path = new URL(page).pathname.replace(/\/+$/, '') || '/';
  // 404 / 别名页（/top/ 的 canonical 是 /top/open/all/month/）不进 sitemap
  if (path === '/404' || path === '/feed.xml') return true;
  if (path === '/top' || path === '/zh/top') return true;
  const m = path.match(/\/agent\/([^/]+)$/);
  return !!m && EXCLUDED_SLUGS.has(m[1]);
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