// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

/**
 * 站点地址优先级：
 * 1. 环境变量 SITE_URL（CI / 部署时注入）
 * 2. 占位域名（本地开发）
 */
const site = process.env.SITE_URL || 'https://agentnews-c5h.pages.dev';

/** 误分类条目：详情页保留（noindex），不进 sitemap */
const EXCLUDED_SLUGS = new Set(['theia', 'vercel-ai-sdk', 'open-interpreter']);

const noindex = (page) => {
  const path = new URL(page).pathname.replace(/\/+$/, '') || '/';
  if (path.endsWith('/404') || path === '/feed') return true;
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