/**
 * 动态生成 robots.txt —— sitemap 地址取 Astro 的 site 配置，
 * 避免静态文件里写死的域名与部署域名不一致。
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://agentnews.example.com');
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# 榜单页面可被索引；数据文件本身不参与索引',
    'Disallow: /*.json$',
    '',
    `Sitemap: ${new URL('sitemap-index.xml', base).href}`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};