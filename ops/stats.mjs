#!/usr/bin/env node
/**
 * 决策会话周报（Cloudflare D1 只读）。
 *
 * 北极星：每周决策会话 = 有 compare 或 out 事件的独立 session。
 * 用法：
 *   node ops/stats.mjs            # 最近 7 天
 *   node ops/stats.mjs --days=30  # 最近 30 天
 *   node ops/stats.mjs --purge    # 删除 90 天前的事件（保留最近 90 天）
 *
 * 凭据：CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID（读 .env.local 或系统环境变量）
 */
import { existsSync, readFileSync } from 'node:fs';

const D1_ID = '7993bc4f-bb1b-4791-8c47-1086ccc96006';
const DAY = 86_400_000;

// 与 pipeline 一致：系统环境变量 > .env.local > .env（先加载的优先，不覆盖已有值）
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) {
  console.error('缺少 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID');
  process.exit(1);
}

const args = process.argv.slice(2);
const days = Number((args.find((a) => a.startsWith('--days=')) ?? '--days=7').split('=')[1]) || 7;
const purge = args.includes('--purge');
const since = Date.now() - days * DAY;

async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${D1_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    },
  );
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json.errors ?? json));
  return json.result?.[0]?.results ?? [];
}

const fmt = (n) => Number(n ?? 0).toLocaleString('en-US');

const run = async () => {
  if (purge) {
    const cut = Date.now() - 90 * DAY;
    await d1('DELETE FROM events WHERE ts < ?', [cut]);
    console.log(`已清理 90 天前的事件（cutoff ${new Date(cut).toISOString().slice(0, 10)}）`);
  }

  const totals = await d1(
    'SELECT event, COUNT(*) AS n, COUNT(DISTINCT session) AS sessions FROM events WHERE ts >= ? GROUP BY event',
    [since],
  );
  const decisions = await d1(
    "SELECT COUNT(DISTINCT session) AS n FROM events WHERE ts >= ? AND event IN ('compare','out')",
    [since],
  );
  const outs = await d1(
    "SELECT agent, COUNT(*) AS n FROM events WHERE ts >= ? AND event = 'out' AND agent <> '' GROUP BY agent ORDER BY n DESC LIMIT 8",
    [since],
  );
  const pages = await d1(
    "SELECT path, COUNT(*) AS n FROM events WHERE ts >= ? AND event = 'view' GROUP BY path ORDER BY n DESC LIMIT 8",
    [since],
  );

  const byEvent = Object.fromEntries(totals.map((t) => [t.event, { n: t.n, sessions: t.sessions }]));
  const views = byEvent.view?.sessions ?? 0;
  const decisionSessions = decisions[0]?.n ?? 0;
  const rate = views > 0 ? ((decisionSessions / views) * 100).toFixed(1) : '—';

  console.log(`\nAgentNews · 最近 ${days} 天\n`);
  console.log(`  页面浏览 sessions   ${fmt(views)}`);
  console.log(`  决策会话 (compare/out) ${fmt(decisionSessions)}   决策率 ${rate}%`);
  console.log(`  compare sessions    ${fmt(byEvent.compare?.sessions ?? 0)}`);
  console.log(`  outbound sessions   ${fmt(byEvent.out?.sessions ?? 0)}`);
  console.log(`  外链点击次数        ${fmt(byEvent.out?.n ?? 0)}`);

  if (outs.length) {
    console.log('\n  外链点击 Top');
    for (const r of outs) console.log(`    ${String(r.n).padStart(4)}  ${r.agent}`);
  }
  if (pages.length) {
    console.log('\n  页面浏览 Top');
    for (const r of pages) console.log(`    ${String(r.n).padStart(4)}  ${r.path}`);
  }
  console.log('');
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});