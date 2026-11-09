// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  integrations: [preact(), sitemap()],
  output: 'static',
  site: 'https://agentrank.example.com',
  build: {
    // 内联小 CSS，减少请求
    inlineStylesheets: 'auto',
  },
});
