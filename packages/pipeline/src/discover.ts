/**
 * 候选发现（不写 agents.yaml，只出候选清单，人工审核后手动收录 —— PRD §4 原则 5）
 *
 * 做法：GitHub 搜索 API 多角度扫一遍 → 过了 §4.4 门槛 → 与 agents.yaml 现有条目差集
 *      → 输出 data/candidates/YYYY-MM-DD.{md,json}，按 star 排序
 *
 * 用法：
 *   pnpm discover              # 默认 star ≥ 1000，近 180 天有推送
 *   pnpm discover --min-stars 500
 *   pnpm discover --limit 100  # 每个查询取多少条
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { AgentsFileSchema } from '@agentnews/core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(join(ROOT, file));
  } catch {
    // 不存在 → 跳过
  }
}

/** 人肉维护的权威清单：搜索 API 有覆盖盲区（很多项目不打 topic、描述也不含关键词）
 *  从这些 README 里捞出 GitHub repo，再逐个核对 star / 活跃度 */
const LISTS = [
  { name: 'e2b/awesome-ai-agents', url: 'https://raw.githubusercontent.com/e2b-dev/awesome-ai-agents/main/README.md' },
  { name: 'kaushikb11/awesome-llm-agents', url: 'https://raw.githubusercontent.com/kaushikb11/awesome-llm-agents/main/README.md' },
  { name: 'jamesmurdza/awesome-ai-devtools', url: 'https://raw.githubusercontent.com/jamesmurdza/awesome-ai-devtools/main/README.md' },
  { name: 'sourcegraph/awesome-code-ai', url: 'https://raw.githubusercontent.com/sourcegraph/awesome-code-ai/main/README.md' },
];

/** 多角度查询：topic 覆盖项目自我分类，关键词覆盖不做 topic 的项目 */
const QUERIES = [
  'topic:ai-agent',
  'topic:ai-agents',
  'topic:coding-agent',
  'topic:ai-coding-agent',
  'topic:autonomous-agents',
  'topic:agent-framework',
  'topic:llm-agent',
  '"coding agent" in:name,description',
  '"terminal agent" in:description',
  '"ai agent" in:name,description',
  '"claude code" in:description',
  '"agent framework" in:description',
  '"browser agent" in:description',
  '"computer use" in:description',
];

interface Repo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  pushed_at: string;
  language: string | null;
  topics?: string[];
  archived: boolean;
  fork: boolean;
  license: { spdx_id?: string | null } | null;
}

interface Candidate {
  from_list?: boolean;
  repo: string;
  url: string;
  stars: number;
  pushed: string;
  language: string | null;
  license: string;
  description: string;
  matched: string[];
  guess_form: string;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? (process.argv[i + 1] ?? fallback) : fallback;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'agentnews-discover',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function search(q: string, minStars: number, perPage: number): Promise<Repo[]> {
  const cutoff = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
  const query = `${q} stars:>=${minStars} pushed:>=${cutoff} archived:false fork:false`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.ok) {
      const body = (await res.json()) as { items?: Repo[] };
      return body.items ?? [];
    }
    if (res.status === 403 || res.status === 429) {
      // 搜索 API 限流（认证 30 次/分，未认证 10 次/分）
      const retry = Number(res.headers.get('retry-after') ?? 60);
      console.warn(`  限流，${retry}s 后重试：${q}`);
      await sleep(Math.min(retry, 60) * 1000);
      continue;
    }
    throw new Error(`GitHub 搜索失败 ${res.status}：${q}`);
  }
  return [];
}

/** agents.yaml 里已有的标识（repo 全名 / slug / name 小写） */
function existingKeys(yamlText: string): Set<string> {
  const keys = new Set<string>();
  const parsed = AgentsFileSchema.safeParse(parse(yamlText));
  const agents = parsed.success ? parsed.data : [];
  for (const a of agents) {
    keys.add(a.slug.toLowerCase());
    keys.add(a.name.toLowerCase().replace(/\s+/g, ''));
    for (const s of a.sources) {
      if (s.kind === 'github') keys.add(s.identifier.toLowerCase());
      if (s.kind === 'npm' || s.kind === 'pypi') {
        // 包名兜底：仓库名与包名常一致
        const base = s.identifier.replace(/^@[^/]+\//, '').toLowerCase();
        keys.add(base);
      }
    }
  }
  return keys;
}

function guessForm(r: Repo): string {
  const text = `${r.full_name} ${r.description ?? ''} ${(r.topics ?? []).join(' ')}`.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => text.includes(w));
  if (has('framework', 'sdk', 'orchestrat', 'multi-agent')) return 'framework';
  if (has('browser', 'computer use', 'playwright', 'web agent')) return 'browser';
  if (has('vscode', 'vs code', 'jetbrains', 'extension', 'plugin')) return 'ide-plugin';
  if (has('ide', 'editor')) return 'ide-app';
  if (has('cli', 'terminal', 'command line', 'tui')) return 'cli';
  if (has('autonomous', 'autogpt', 'task agent')) return 'autonomous';
  return '?';
}

async function fetchList(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { 'User-Agent': 'agentnews-discover' } });
  return res.ok ? res.text() : null;
}

/** 从 README 里抽 GitHub repo 全名（排除非仓库路径、awesome 清单自身） */
function extractRepoRefs(markdown: string): string[] {
  const refs = new Set<string>();
  const re = /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g;
  const skipPaths = new Set(['topics', 'sponsors', 'features', 'marketplace', 'orgs', 'settings', 'about']);
  for (const m of markdown.matchAll(re)) {
    const [, owner, rawName] = m;
    if (!owner || !rawName) continue;
    const name = rawName.replace(/\.git$/, '');
    if (skipPaths.has(owner.toLowerCase())) continue;
    if (/^(blob|tree|issues|pulls|releases|wiki|raw|actions)$/.test(name.toLowerCase())) continue;
    refs.add(`${owner}/${name}`);
  }
  return [...refs];
}

const CONCURRENCY = 8;

/** 粗筛：把 PRD §4.1 明摆着的排除项剔掉，剩下的交给人看 */
const DROP_RE =
  /\bskills?\b|\bskill pack|prompt (library|collection)|\bclaude\.md|dotfiles|\bawesome\b|\bcurated\b|cheatsheet|\bcourse\b|\btutorial\b|\bbook\b|\binterview|roadmap|\bdataset\b|benchmark|\beval(uation)? (platform|suite)|tutorial|\bnotes\b|newsletter/i;
const INFRA_RE =
  /memory layer|vector (db|database|store)|\brag (as a service|database|platform)|crawler|scrap(e|ing) (api|service)|\bgateway\b|\bproxy\b|\brouter\b|observability|sandbox (api|service|infra)|telemetry|\bbilling\b|\bocr\b|text-to-speech/i;
const AGENT_RE =
  /agent|copilot|assistant|autonomous|harness|coding|\bcode\b|editor|\bide\b|terminal|\bcli\b|browser|workflow|framework|\bsdk\b/i;

function scopeVerdict(c: Candidate): { keep: boolean; reason?: string } {
  const text = `${c.repo} ${c.description}`;
  if (DROP_RE.test(text)) return { keep: false, reason: '非产品形态（skill/prompt/教程/清单）' };
  if (INFRA_RE.test(text)) return { keep: false, reason: '基础设施 / 非 agent 产品' };
  if (!AGENT_RE.test(text)) return { keep: false, reason: '不像 agent 产品' };
  return { keep: true };
}

/** 逐个核对：star / 活跃度 / 归档 / fork，只留过得了 §4.4 门槛的 */
async function verifyRepos(
  repos: string[],
  minStars: number,
): Promise<{ ok: Repo[]; denied: number }> {
  const cutoff = new Date(Date.now() - 180 * 86400_000).toISOString();
  const ok: Repo[] = [];
  let denied = 0;
  const queue = [...repos];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const repo = queue.pop();
      if (!repo) return;
      const res = await fetch(`https://api.github.com/repos/${repo}`, { headers: authHeaders() });
      if (!res.ok) {
        denied++;
        if (res.status === 403 || res.status === 429) {
          // 用完配额就停手，不浪费后续请求
          queue.length = 0;
        }
        continue;
      }
      const r = (await res.json()) as Repo;
      if (r.archived || r.fork || r.stargazers_count < minStars || r.pushed_at < cutoff) {
        denied++;
        continue;
      }
      ok.push(r);
    }
  });
  await Promise.all(workers);
  return { ok, denied };
}

interface WatchEntry {
  name: string;
  form?: string;
  homepage?: string;
  github?: string;
  note?: string;
}

type WatchStatus = 'listed' | 'pending' | 'unreachable' | 'archived';

interface WatchRow extends WatchEntry {
  status: WatchStatus;
  stars: number | null;
  pushed: string | null;
}

/** watchlist.yaml：人手维护的种子（闭源 / 无公开 repo / 待核） */
async function loadWatchlist(): Promise<WatchEntry[]> {
  let text: string;
  try {
    text = await readFile(join(ROOT, 'watchlist.yaml'), 'utf8');
  } catch {
    return [];
  }
  const parsed: unknown = parse(text);
  if (!Array.isArray(parsed)) return [];
  const entries: WatchEntry[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.name !== 'string' || !e.name.trim()) {
      console.warn('  ⚠ watchlist 有条目缺 name，已跳过');
      continue;
    }
    entries.push({
      name: e.name,
      form: typeof e.form === 'string' ? e.form : undefined,
      homepage: typeof e.homepage === 'string' ? e.homepage : undefined,
      github: typeof e.github === 'string' ? e.github : undefined,
      note: typeof e.note === 'string' ? e.note : undefined,
    });
  }
  return entries;
}

/** 主页探测：403/401 算可达（反爬），4xx/5xx 算已下线，超时/DNS 算不确定（不算死链） */
async function probeHomepage(url: string): Promise<'reachable' | 'dead' | 'unknown'> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (agentnews-discover)' },
    });
    if (res.status === 404 || res.status === 410 || res.status >= 500) return 'dead';
    return 'reachable';
  } catch {
    // 超时 / DNS 失败：可能是网络环境问题，不能当死链处理
    return 'unknown';
  }
}

async function checkWatchlist(entries: WatchEntry[], known: Set<string>): Promise<WatchRow[]> {
  const rows: WatchRow[] = [];
  for (const e of entries) {
    const repoKey = e.github?.toLowerCase();
    const nameKey = e.name.toLowerCase().replace(/\s+/g, '');
    const listed = (repoKey !== undefined && known.has(repoKey)) || known.has(nameKey);

    let stars: number | null = null;
    let pushed: string | null = null;
    let archived = false;
    let repoFound = false;

    if (e.github) {
      const res = await fetch(`https://api.github.com/repos/${e.github}`, { headers: authHeaders() });
      if (res.ok) {
        const r = (await res.json()) as Repo;
        repoFound = true;
        stars = r.stargazers_count;
        pushed = r.pushed_at.slice(0, 10);
        archived = r.archived;
      }
    }

    let status: WatchStatus = 'pending';
    if (listed) status = 'listed';
    else if (archived) status = 'archived';
    else if (e.github && !repoFound) status = 'unreachable';
    else if (!e.github && e.homepage && (await probeHomepage(e.homepage)) === 'dead') status = 'unreachable';

    rows.push({ ...e, status, stars, pushed });
  }
  return rows;
}

async function main() {
  const minStars = Number(arg('min-stars', '1000'));
  const perPage = Number(arg('limit', '60'));
  const onlyWatchlist = process.argv.includes('--only-watchlist');
  const top = Number(arg('top', '150'));
  const today = new Date().toISOString().slice(0, 10);

  const yamlText = await readFile(join(ROOT, 'agents.yaml'), 'utf8');
  const known = existingKeys(yamlText);
  const byRepo = new Map<string, Candidate>();

  // ── 第一路：GitHub 搜索
  if (!onlyWatchlist) {
    for (const q of QUERIES) {
      process.stdout.write(`  搜索 ${q} ... `);
      const repos = await search(q, minStars, perPage);
      let fresh = 0;
      for (const r of repos) {
        const key = r.full_name.toLowerCase();
        const nameKey = r.full_name.split('/')[1]!.toLowerCase();
        if (known.has(key) || known.has(nameKey)) continue;
        const prev = byRepo.get(key);
        if (prev) {
          prev.matched.push(q);
          continue;
        }
        fresh++;
        byRepo.set(key, {
          repo: r.full_name,
          url: r.html_url,
          stars: r.stargazers_count,
          pushed: r.pushed_at.slice(0, 10),
          language: r.language,
          license: r.license?.spdx_id ?? 'unknown',
          description: (r.description ?? '').slice(0, 160),
          matched: [q],
          guess_form: guessForm(r),
        });
      }
      console.log(`${repos.length} 条，其中新候选 ${fresh}`);
      await sleep(2000); // 认证 30 次/分，留余量
    }

    // ── 第二路：权威清单（覆盖搜索 API 抓不到的盲区）
    console.log('\n  解析权威清单 ...');
    const fromLists = new Set<string>();
    for (const list of LISTS) {
      const md = await fetchList(list.url);
      if (!md) {
        console.log(`  ✗ ${list.name} 拉取失败，跳过`);
        continue;
      }
      const refs = extractRepoRefs(md);
      let fresh = 0;
      for (const repo of refs) {
        const key = repo.toLowerCase();
        const nameKey = key.split('/')[1] ?? '';
        if (known.has(key) || known.has(nameKey) || byRepo.has(key)) continue;
        fromLists.add(repo);
        fresh++;
      }
      console.log(`  ${list.name}: ${refs.length} 个仓库，新增待核 ${fresh}`);
    }

    console.log(`  核对 ${fromLists.size} 个仓库（star ≥ ${minStars}）...`);
    const verified = await verifyRepos([...fromLists], minStars);
    console.log(`  ✓ 过门槛 ${verified.ok.length}，落选 ${verified.denied}`);
    for (const r of verified.ok) {
      byRepo.set(r.full_name.toLowerCase(), {
        repo: r.full_name,
        url: r.html_url,
        stars: r.stargazers_count,
        pushed: r.pushed_at.slice(0, 10),
        language: r.language,
        license: r.license?.spdx_id ?? 'unknown',
        description: (r.description ?? '').slice(0, 160),
        matched: ['list'],
        guess_form: guessForm(r),
        from_list: true,
      });
    }
  }

  // ── 第三路：watchlist（闭源 / 无公开 repo / 待核 —— 前两路看不见的）
  const watchEntries = await loadWatchlist();
  let watch: WatchRow[] = [];
  if (watchEntries.length) {
    console.log(`\n  核对 watchlist ${watchEntries.length} 条 ...`);
    watch = await checkWatchlist(watchEntries, known);
    const count = (s: WatchStatus) => watch.filter((w) => w.status === s).length;
    console.log(
      `  listed ${count('listed')} / pending ${count('pending')} / unreachable ${count('unreachable')} / archived ${count('archived')}`,
    );
  }

  const candidates = [...byRepo.values()].sort((a, b) => b.stars - a.stars);
  const triaged = candidates.map((c) => ({ c, verdict: scopeVerdict(c) }));
  const review = triaged.filter((t) => t.verdict.keep).map((t) => t.c);
  const dropped = triaged.filter((t) => !t.verdict.keep);
  const shown = review.slice(0, top);

  const dir = join(ROOT, 'data', 'candidates');
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${today}.json`),
    JSON.stringify(
      {
        review,
        dropped: dropped.map((d) => ({ ...d.c, reason: d.verdict.reason })),
        watch,
      },
      null,
      2,
    ) + '\n',
  );

  const watchSection = watch.length
    ? [
        '## Watchlist 状态',
        '',
        '| 状态 | 名称 | 形态 | star | 最近推送 | 备注 |',
        '|---|---|---|---|---|---|',
        ...watch.map(
          (w) =>
            `| ${w.status} | ${w.name} | ${w.form ?? '-'} | ${w.stars ?? '-'} | ${w.pushed ?? '-'} | ${(w.note ?? '').replace(/\|/g, '\\|')} |`,
        ),
      ]
    : [];

  const lines = [
    `# Agent 候选清单 ${today}`,
    '',
    '> 自动发现，未收录。人工审核后按 PRD §4 手动写进 agents.yaml（$ pnpm validate）。',
    `> 门槛：star ≥ ${minStars}，近 180 天有推送，未归档，非 fork。`,
    '',
    `共 ${candidates.length} 个候选，粗筛后 **${review.length}** 个建议人工过目（下表取 star 前 ${Math.min(top, review.length)}，其余在 json 里），${dropped.length} 个已自动排除。`,
    '',
    `来源：GitHub 搜索 ${QUERIES.length} 组（每组取前 ${perPage}）+ ${LISTS.length} 份权威清单 + watchlist ${watch.length} 条。`,
    '',
    '## 建议人工过目',
    '',
    '| star | repo | 语言 | License | 推测形态 | 来源 | 描述 |',
    '|---|---|---|---|---|---|---|',
    ...shown.map(
      (c) =>
        `| ${c.stars} | [${c.repo}](${c.url}) | ${c.language ?? '-'} | ${c.license} | ${c.guess_form} | ${c.from_list ? '清单' : '搜索'} | ${c.description.replace(/\|/g, '\\|')} |`,
    ),
    '',
    ...watchSection,
    '',
    '## 已自动排除',
    '',
    ...dropped.map((d) => `- ${d.c.stars} [${d.c.repo}](${d.c.url}) — ${d.verdict.reason}`),
  ];
  await writeFile(join(dir, `${today}.md`), lines.join('\n') + '\n');

  console.log(
    `\n✓ ${candidates.length} 个候选 → 建议过目 ${review.length} / 自动排除 ${dropped.length}`,
  );
  console.log(`  data/candidates/${today}.md`);
  console.log('  下一步：人工过一遍上表 + watchlist 状态，把确认属于 §4.1 的写进 agents.yaml');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
