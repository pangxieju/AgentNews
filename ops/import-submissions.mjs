#!/usr/bin/env node
/**
 * 拉取「收录申请」issue → data/candidates/<date>.submissions.{json,md}
 *
 * 收录闭环：用户在站点点「提交收录申请」→ 填 GitHub issue（模板 add-agent.yml，
 * label=candidate）→ 本脚本（daily CI 里 `pnpm submissions`）把新 issue 拉进候选
 * 清单 → 人工按 PRD §4 审核后写进 watchlist.yaml / agents.yaml，并关闭 issue。
 *
 * 用法：
 *   node ops/import-submissions.mjs            # 写盘
 *   node ops/import-submissions.mjs --dry-run  # 只打印，不写文件
 *
 * 凭据：GITHUB_TOKEN（可选；无 token 走公开 API，限流 60 次/时足够）
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'pangxieju/AgentNews';
const LABEL = 'candidate';
const CAND_DIR = join(ROOT, 'data', 'candidates');

const DRY = process.argv.includes('--dry-run');
for (const f of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(join(ROOT, f));
  } catch {
    /* 不存在则跳过 */
  }
}
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const HEADERS = TOKEN
  ? { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'agentnews-submissions' }
  : { 'User-Agent': 'agentnews-submissions' };

/** 北京时间 YYYY-MM-DD（与 pipeline 日期口径一致） */
function todayZh() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

/* ── agents.yaml 现有条目（用于去重：slug / name / homepage / github repo） ── */
function loadListed() {
  const raw = existsSync(join(ROOT, 'agents.yaml')) ? readFileSync(join(ROOT, 'agents.yaml'), 'utf8') : '';
  const out = [];
  const blocks = raw.split(/(?=^- slug:)/m).slice(1);
  for (const b of blocks) {
    const slug = /^ {4}slug: (.+)$/m.exec(b)?.[1] ?? '';
    const name = /^ {4}name: (.+)$/m.exec(b)?.[1] ?? '';
    const homepage = /^ {4}homepage: (.+)$/m.exec(b)?.[1] ?? '';
    const repos = Array.from(b.matchAll(/identifier: ([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g), (m) => m[1].toLowerCase());
    out.push({ slug: slug.toLowerCase(), name: name.toLowerCase(), repo: repos.join(' '), homepage: homepage.toLowerCase() });
  }
  return out;
}

/** 历史 submissions 的 name / repo / homepage（跨天去重） */
function loadPastSubmissions() {
  if (!existsSync(CAND_DIR)) return [];
  const out = [];
  for (const f of readdirSync(CAND_DIR)) {
    if (!f.endsWith('.submissions.json')) continue;
    try {
      const d = JSON.parse(readFileSync(join(CAND_DIR, f), 'utf8'));
      for (const it of d.items ?? []) {
        out.push({
          name: (it.name ?? '').toLowerCase(),
          repo: (it.repo ?? '').toLowerCase(),
          homepage: (it.homepage ?? '').toLowerCase(),
        });
      }
    } catch {
      /* 单个文件损坏不阻断 */
    }
  }
  return out;
}

/** issue body 里按 markdown 小节名取值（多行取到下一个 ### 为止） */
function section(body, heading) {
  const re = new RegExp(`###\\s*${heading}[^\\n]*\\n+([\\s\\S]*?)(?=\\n###\\s|$)`, 'i');
  const m = re.exec(body);
  if (!m) return '';
  return m[1]
    .trim()
    .split('\n')
    .map((l) => l.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .join(' ');
}

function parseIssue(it) {
  const body = it.body ?? '';
  const name = section(body, '产品/工具名称') || it.title.replace(/^\[?收录\]?[：:\s]*/i, '').trim();
  return {
    issue: it.number,
    url: it.html_url,
    created_at: it.created_at,
    name,
    homepage: section(body, '官网 / 落地页 URL') || (/https?:\/\/[^\s)]+/.exec(body)?.[0] ?? ''),
    repo: section(body, 'GitHub 仓库') || '',
    form: section(body, '形态'),
    oss: section(body, '开源 / 闭源'),
    why: section(body, '为什么值得收录'),
  };
}

async function main() {
  const listed = loadListed();
  const past = loadPastSubmissions();

  const url = `https://api.github.com/repos/${REPO}/issues?state=open&labels=${LABEL}&per_page=100`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    console.error(`GitHub API ${res.status}（${res.statusText}）：`);
    console.error(await res.text());
    process.exit(1);
  }
  const issues = await res.json();
  if (!Array.isArray(issues)) {
    console.error('意外响应：', JSON.stringify(issues).slice(0, 300));
    process.exit(1);
  }

  const lower = (s) => s.toLowerCase().trim();
  const key = (r) => [lower(r.name), lower(r.repo), lower(r.homepage)].filter(Boolean).join('|');

  const known = new Set([
    ...listed.map((r) => key(r)),
    ...listed.map((r) => lower(r.slug)),
    ...past.map((r) => key(r)),
  ]);

  const fresh = [];
  for (const it of issues) {
    const parsed = parseIssue(it);
    if (!parsed.name && !parsed.homepage && !parsed.repo) continue; // 防空 issue
    if (known.has(key(parsed))) continue;
    // slug 撞名：openai/codex 已收录而申请写 "Codex" 时也能拦住
    if (known.has(lower(parsed.name))) continue;
    fresh.push(parsed);
  }

  const date = todayZh();
  const items = fresh.map((f) => ({ ...f, status: 'pending' }));

  if (items.length === 0) {
    console.log(`没有新的收录申请（共 ${issues.length} 个 open issue，全部已在清单/名单里）`);
    return;
  }

  if (DRY) {
    console.log(`[dry-run] 将写入 ${date}.submissions.json：${items.length} 条`);
    for (const it of items) console.log(`  #${it.issue} ${it.name}${it.repo ? ` (${it.repo})` : ''}`);
    return;
  }

  mkdirSync(CAND_DIR, { recursive: true });
  const file = join(CAND_DIR, `${date}.submissions.json`);
  const md = join(CAND_DIR, `${date}.submissions.md`);

  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { date, items: [] };
  const merged = [...(prev.items ?? []), ...items];

  writeFileSync(file, `${JSON.stringify({ date, source: `issues?labels=${LABEL}`, count: merged.length, items: merged }, null, 2)}\n`);

  const mdBody = [
    `# 收录申请 ${date}`,
    '',
    `> 来源：GitHub issue（label=\`${LABEL}\`）。人工按 PRD §4 审核后写进 watchlist.yaml，并关闭对应 issue。本轮新增 ${items.length} 条。`,
    '',
    '| issue | 名称 | 形态 | 开源/闭源 | repo / homepage | 为什么值得收录 |',
    '|---|---|---|---|---|---|',
  ];
  for (const it of items) {
    const link = it.repo ? `[\`${it.repo}\`](https://github.com/${it.repo.replace(/^https?:\/\/github\.com\//, '')})` : '';
    const site = it.homepage ? `[官网](${it.homepage})` : '';
    mdBody.push(`| [#${it.issue}](${it.url}) | ${it.name} | ${it.form || '—'} | ${it.oss || '—'} | ${[link, site].filter(Boolean).join(' · ') || '—'} | ${(it.why || '').slice(0, 80) || '—'} |`);
  }
  writeFileSync(md, `${mdBody.join('\n')}\n`);

  console.log(`写入 ${date}.submissions.json/.md：新增 ${items.length} 条`);
  for (const it of items) console.log(`  #${it.issue} ${it.name}${it.repo ? ` (${it.repo})` : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});