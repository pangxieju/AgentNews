// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

/**
 * 站点地址优先级：
 * 1. 环境变量 SITE_URL（CI / 部署时注入）
 * 2. 占位域名（本地开发）
 *
 * 为什么用环境变量：canonical / sitemap / robots 都依赖绝对地址，
 * 部署到 *.pages.dev 或自定义域名后必须保持一致，否则 SEO 会指向错误域名。
 */
const site = process.env.SITE_URL || 'https://agentrank.example.com';

export default defineConfig({
  integrations: [preact(), sitemap()],
  output: 'static',
  site,
  build: {
    inlineStylesheets: 'auto',
  },
});