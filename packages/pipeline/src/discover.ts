/**
 * 候选发现（不写 agents.yaml，只出候选清单，人工审核后手动收录 —— PRD §4 原则 5）
 *
 * 做法：GitHub 搜索 API 多角度扫一遍 → 过了 §4.4 门槛 → 与 agents.yaml 现有条目差集
 *      → 输出 data/candidates/YYYY-MM-DD.{md,json}，按 star / 周下载 / 安装量排序
 *
 * 四条发现路（互补，盲区不同）：
 *   1. GitHub 搜索（star ≥ min-stars，近 180 天有推送）
 *   2. 权威清单 README（搜索 API 的 topic / 关键词盲区）
 *   3. npm 周下载（PRD §4.4：周下载 ≥ 3000 也算过门槛，star 低也收）
 *   4. VS Code 商店安装量（闭源 ide-plugin 的公开指标，PRD §4.4 闭源口径）
 *   watchlist 是人工种子，不属发现，只做状态核对
 *
 * 用法：
 *   pnpm discover                     # 默认 star ≥ 1000 / 周下载 ≥ 3000 / 安装 ≥ 10000
 *   pnpm discover --min-stars 500
 *   pnpm discover --limit 100         # 每个查询取多少条
 *   pnpm discover --min-weekly 1000 --min-installs 5000
 *   pnpm discover --only-watchlist     # 只核对人工种子，不跑外网发现有
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentsFileSchema } from '@agentnews/core';
import { parse, stringify } from 'yaml';

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

/** npm 搜索：包名 / 描述 / keywords 都命中，覆盖「有 CLI 包但不打 agent topic」的项目 */
const NPM_QUERIES = ['ai agent', 'ai coding agent', 'coding agent', 'agent cli', 'copilot cli', 'llm agent'];

/** VS Code 商店：闭源 IDE 插件的唯一公开指标是安装量（PRD §4.4 闭源口径）
 *  搜索是全模糊匹配（Pylance / CMake 也会回来），靠品牌词 + 下方的严格文本过滤双保险 */
const VSCE_QUERIES = [
  'copilot',
  'cursor',
  'cline',
  'codeium',
  'tabnine',
  'supermaven',
  'windsurf',
  'gemini code assist',
  'amazon q developer',
  'ai coding assistant',
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

/** npm 发现的候选（PRD §4.4：周下载 ≥ 3000 与 star ≥ 500 二选一） */
interface NpmCandidate {
  name: string;
  version: string;
  weekly: number;
  /** npm links.repository 归一成 owner/repo；包没有公开 repo 时为空 */
  repo: string;
  url: string;
  homepage: string;
  stars: number | null;
  pushed: string | null;
  description: string;
  guess_form: string;
  matched: string[];
}

/** VS Code 商店候选（闭源 / 半开源插件，进收录区，不排名） */
interface VscodeCandidate {
  name: string;
  /** publisher.extension */
  id: string;
  installs: number;
  publisher: string;
  last_updated: string;
  url: string;
  description: string;
  guess_form: 'ide-plugin';
  matched: string[];
}

interface NpmPkg {
  name: string;
  version?: string;
  description?: string;
  keywords?: string[];
  links?: { npm?: string; homepage?: string; repository?: string };
}

interface VscodeExt {
  extensionName?: string;
  displayName?: string;
  publisher?: { publisherName?: string; displayName?: string };
  shortDescription?: string;
  lastUpdated?: string;
  statistics?: { statisticName?: string; value?: number }[];
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
      // vscode 标识（publisher.extension）：商店发现时用它去重，避免 Copilot 类重复收录
      if (s.kind === 'vscode') keys.add(s.identifier.toLowerCase());
      if (s.kind === 'npm' || s.kind === 'pypi') {
        // 包名兜底：仓库名与包名常一致
        const base = s.identifier.replace(/^@[^/]+\//, '').toLowerCase();
        keys.add(base);
      }
    }
  }
  return keys;
}

export function guessFormText(raw: string): string {
  const text = raw.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => text.includes(w));
  if (has('framework', 'sdk', 'orchestrat', 'multi-agent')) return 'framework';
  if (has('browser', 'computer use', 'playwright', 'web agent')) return 'browser';
  if (has('vscode', 'vs code', 'jetbrains', 'extension', 'plugin')) return 'ide-plugin';
  if (has('ide', 'editor')) return 'ide-app';
  if (has('cli', 'terminal', 'command line', 'tui')) return 'cli';
  if (has('autonomous', 'autogpt', 'task agent')) return 'autonomous';
  return '?';
}

function guessForm(r: Repo): string {
  return guessFormText(`${r.full_name} ${r.description ?? ''} ${(r.topics ?? []).join(' ')}`);
}

/* ── npm / VS Code 商店发现（PRD §4.4 里 star 之外的另外两个公开指标） ── */

/** npm links.repository 归一成 owner/repo（git+https、.git 后缀、gitlab 之类非 github 直接丢弃） */
export function normRepoUrl(v: string | undefined | null): string {
  if (!v) return '';
  const m = /(?:github\.com[/:]|github:)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/#?]|$)/.exec(v);
  return m?.[1] && m[2] ? `${m[1]}/${m[2]}` : '';
}



async function npmSearch(text: string, size: number): Promise<NpmPkg[]> {
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(text)}&size=${size}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'agentnews-discover' } });
  if (!res.ok) throw new Error(`npm 搜索 ${res.status}`);
  const body = (await res.json()) as { objects?: { package?: NpmPkg }[] };
  return (body.objects ?? []).map((o) => o.package).filter((p): p is NpmPkg => !!p?.name);
}

/** 取 npm 周下载量。注意：point API 的批量查询不支持 scoped 包（整批 400），只能逐个查 */
async function npmWeekly(names: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const queue = [...new Set(names)];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, async () => {
    for (;;) {
      const name = queue.pop();
      if (!name) return;
      try {
        const res = await fetch(
          `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,
          { headers: { 'User-Agent': 'agentnews-discover' } },
        );
        if (!res.ok) continue;
        const body = (await res.json()) as { downloads?: number };
        out[name] = body.downloads ?? 0;
      } catch {
        // 单个失败按缺省处理，不阻断整条发现路
      }
    }
  });
  await Promise.all(workers);
  return out;
}

export function marketplaceUrl(id: string): string {
  return `https://marketplace.visualstudio.com/items?itemName=${id}`;
}

/** VS Code 商店查询响应 → 扩展列表（容忍 results 缺失 / 结构变动） */
export function parseMarketplace(body: unknown): VscodeExt[] {
  const results = (body as { results?: { extensions?: VscodeExt[] }[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((r) => (Array.isArray(r?.extensions) ? r.extensions : []));
}

async function vscodeSearch(text: string, size: number): Promise<VscodeExt[]> {
  const url = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
  const payload = {
    filters: [{ criteria: [{ filterType: 10, value: text }], pageNumber: 1, pageSize: size, sortBy: 4, sortOrder: 0 }],
    assetTypes: [],
    flags: 914,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json;api-version=7.2-preview.1',
      'Content-Type': 'application/json',
      'User-Agent': 'agentnews-discover',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`VS Code 商店 ${res.status}`);
  return parseMarketplace(await res.json());
}

/** 只补元数据、不做门槛过滤：npm / 商店候选靠下载量 / 安装量过门槛 */
async function peekRepos(repos: string[]): Promise<Map<string, Repo>> {
  const out = new Map<string, Repo>();
  const queue = [...repos];
  const workers = Array.from({ length: Math.min(CONCURRENCY, repos.length || 1) }, async () => {
    for (;;) {
      const repo = queue.pop();
      if (!repo) return;
      const res = await fetch(`https://api.github.com/repos/${repo}`, { headers: authHeaders() });
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) queue.length = 0;
        continue;
      }
      const r = (await res.json()) as Repo;
      out.set(r.full_name.toLowerCase(), r);
    }
  });
  await Promise.all(workers);
  return out;
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
  /memory layer|vector (db|database|store)|\brag (as a service|database|platform)|crawler|scrap(e|ing) (api|service)|\bgateway\b|\bproxy\b|\brouter\b|observability|sandbox (api|service|infra)|telemetry|\bbilling\b|\bocr\b|text-to-speech|loading (indicator|spinner)|\blibrary\b|\bwrapper\b|\bdetector?\b|\bclient for\b|\bbindings\b|\bui (kit|components?)\b|detect (if |whether )?code is running|is running in an ai agent/i;

/** 商店扩展：名字/描述里必须真的提到 agent 能力，否则就是普通开发工具 */
const VSCE_AGENT_RE =
  /(copilot|\bagents?\b|agentic|coding assistant|code assistant|ai assistant|ai pair|code complet|chat with (your )?(code|repo)|autocomplet)/i;
/** 商店里安装量极高的通用工具（语言服务器 / 格式化 / 主题 …）不要把榜单淹掉 */
const VSCE_DENY_RE =
  /language (server|pack)|formatter|linter|debugger|intellisense|snippets?|\btheme\b|\bicons?\b|jupyter|notebook|\bcmake\b|\bdocker\b|gitlens|prettier|eslint|markdown|\bsql\b|rust-analyzer|test runner|spell ?check|translat|language support|\bazure\b|keploy|\bmocks?\b/i;
const AGENT_RE =
  /agent|copilot|assistant|autonomous|harness|coding|\bcode\b|editor|\bide\b|terminal|\bcli\b|browser|workflow|framework|\bsdk\b/i;

function scopeVerdict(c: Pick<Candidate, 'repo' | 'description'>): { keep: boolean; reason?: string } {
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
  /** PRD §4.4：开源徽章也可用周下载 ≥ 3000 过门槛；闭源看商店安装量 */
  const minWeekly = Number(arg('min-weekly', '3000'));
  const minInstalls = Number(arg('min-installs', '10000'));
  const onlyWatchlist = process.argv.includes('--only-watchlist');
  /** --write：把 watchlist 里已收录的条目剪掉（状态是每次现算的派生值，不写回文件） */
  const write = process.argv.includes('--write');
  const top = Number(arg('top', '150'));
  const today = new Date().toISOString().slice(0, 10);

  const yamlText = await readFile(join(ROOT, 'agents.yaml'), 'utf8');
  const known = existingKeys(yamlText);
  const byRepo = new Map<string, Candidate>();
  const npmCandidates: NpmCandidate[] = [];
  const vscodeCandidates: VscodeCandidate[] = [];
  const npmSeen = new Set<string>();
  const vscodeSeen = new Set<string>();

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

    // ── 第三路：npm 周下载（PRD §4.4：周下载 ≥ min-weekly 可与 star 二选一）
    const npmRaw: NpmCandidate[] = [];
    for (const q of NPM_QUERIES) {
      process.stdout.write(`  npm 搜索 ${q} ... `);
      let pkgs: NpmPkg[] = [];
      try {
        pkgs = await npmSearch(q, perPage);
      } catch (e) {
        console.log(`失败（${(e as Error).message}）`);
        continue;
      }
      const weekly = await npmWeekly(pkgs.map((p) => p.name));
      let fresh = 0;
      for (const p of pkgs) {
        const w = weekly[p.name] ?? 0;
        if (w < minWeekly) continue;
        const repo = normRepoUrl(p.links?.repository);
        // 平台后缀子包（@github/copilot-linux-x64）要与母包合并去重，否则已收录产品会重复出现
        const bare = p.name
          .toLowerCase()
          .replace(/^@[^/]+\//, '')
          .replace(/-(linux|linuxmusl|darwin|win32|windows|freebsd|alpine)[-_](x64|arm64|ia32|arm)$/, '');
        const keys = [p.name.toLowerCase(), bare, repo.toLowerCase()];
        if (npmSeen.has(p.name) || keys.some((k) => k && known.has(k))) continue;
        const desc = (p.description ?? '').slice(0, 160);
        if (!scopeVerdict({ repo: repo || p.name, description: `${desc} ${(p.keywords ?? []).join(' ')}` }).keep) continue;
        npmSeen.add(p.name);
        npmRaw.push({
          name: p.name,
          version: p.version ?? '',
          weekly: w,
          repo,
          url: p.links?.npm ?? `https://www.npmjs.com/package/${p.name}`,
          homepage: p.links?.homepage ?? (repo ? `https://github.com/${repo}` : ''),
          stars: null,
          pushed: null,
          description: desc,
          guess_form: guessFormText(desc),
          matched: [q],
        });
        fresh++;
      }
      console.log(`${pkgs.length} 条 → 周下载过线 ${fresh}`);
      await sleep(300);
    }
    // 有 repo 的补 star / 活跃度；已归档 / fork 的剔除（PRD §4.1）
    const npmRepos = [...new Set(npmRaw.map((c) => c.repo).filter(Boolean))];
    const npmMeta = npmRepos.length ? await peekRepos(npmRepos) : new Map<string, Repo>();
    for (const c of npmRaw) {
      const r = c.repo ? npmMeta.get(c.repo.toLowerCase()) : undefined;
      if (r?.archived || r?.fork) continue;
      if (r) {
        c.stars = r.stargazers_count;
        c.pushed = r.pushed_at.slice(0, 10);
        c.guess_form = guessForm(r);
      }
      npmCandidates.push(c);
    }
    npmCandidates.sort((a, b) => b.weekly - a.weekly);

    // ── 第四路：VS Code 商店安装量（闭源 ide-plugin 的公开指标）
    const vscodeKnown = [...known].filter((k) => k.includes('.'));
    const knownNames = [...known].filter((k) => !k.includes('/') && !k.includes('.') && k.length >= 5);
    for (const q of VSCE_QUERIES) {
      process.stdout.write(`  VS Code 商店 ${q} ... `);
      let exts: VscodeExt[] = [];
      try {
        exts = await vscodeSearch(q, perPage);
      } catch (e) {
        console.log(`失败（${(e as Error).message}）`);
        continue;
      }
      let fresh = 0;
      for (const e of exts) {
        const id = `${e.publisher?.publisherName ?? ''}.${e.extensionName ?? ''}`;
        const idLower = id.toLowerCase();
        const installs = e.statistics?.find((s) => s.statisticName === 'install')?.value ?? 0;
        const name = (e.displayName ?? e.extensionName ?? '').trim();
        if (!id || !name || installs < minInstalls) continue;
        const nameKey = name.toLowerCase().replace(/\s+/g, '');
        if (
          vscodeSeen.has(id) ||
          known.has(nameKey) ||
          known.has(idLower) ||
          vscodeKnown.some((k) => idLower.startsWith(k)) ||
          knownNames.some((k) => nameKey.includes(k))
        )
          continue;
        const text = `${name} ${e.shortDescription ?? ''}`;
        if (!VSCE_AGENT_RE.test(text) || VSCE_DENY_RE.test(text) || DROP_RE.test(text) || INFRA_RE.test(text)) continue;
        vscodeSeen.add(id);
        vscodeCandidates.push({
          name,
          id,
          installs,
          publisher: e.publisher?.publisherName ?? '',
          last_updated: (e.lastUpdated ?? '').slice(0, 10),
          url: marketplaceUrl(id),
          description: (e.shortDescription ?? '').slice(0, 160),
          guess_form: 'ide-plugin',
          matched: [q],
        });
        fresh++;
      }
      console.log(`${exts.length} 条 → 安装量 + 相关性过线 ${fresh}`);
      await sleep(500);
    }
    vscodeCandidates.sort((a, b) => b.installs - a.installs);
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

    if (write) {
      const kept = watch.filter((w) => w.status !== 'listed');
      const removed = watch.length - kept.length;
      if (removed > 0) {
        const original = await readFile(join(ROOT, 'watchlist.yaml'), 'utf8');
        const header = original.slice(0, original.search(/^- name:/m));
        const entries = kept.map(({ status: _status, stars: _stars, pushed: _pushed, ...e }) => e);
        await writeFile(join(ROOT, 'watchlist.yaml'), header + stringify(entries));
        console.log(`  watchlist 已精简：移除 ${removed} 个已收录条目`);
      } else {
        console.log('  watchlist 无需精简');
      }
    }
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
    `${JSON.stringify(
      {
        review,
        dropped: dropped.map((d) => ({ ...d.c, reason: d.verdict.reason })),
        npm: npmCandidates,
        vscode: vscodeCandidates,
        watch,
      },
      null,
      2,
    )}\n`,
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

  const npmSection = npmCandidates.length
    ? [
        `## npm 高下载量（周下载 ≥ ${minWeekly}）`,
        '',
        '| 周下载 | 包 | 形态 | star | repo | 描述 |',
        '|---|---|---|---|---|---|',
        ...npmCandidates.slice(0, top).map(
          (c) =>
            `| ${c.weekly} | [${c.name}](${c.url}) | ${c.guess_form} | ${c.stars ?? '-'} | ${c.repo ? `[${c.repo}](https://github.com/${c.repo})` : '-'} | ${c.description.replace(/\|/g, '\\|')} |`,
        ),
      ]
    : [];

  const vscodeSection = vscodeCandidates.length
    ? [
        `## VS Code 商店高安装量（install ≥ ${minInstalls}）`,
        '',
        '| install | 扩展 | 发布者 | 最近更新 | 描述 |',
        '|---|---|---|---|---|',
        ...vscodeCandidates.slice(0, top).map(
          (c) =>
            `| ${c.installs} | [${c.name}](${c.url}) | ${c.publisher} | ${c.last_updated || '-'} | ${c.description.replace(/\|/g, '\\|')} |`,
        ),
      ]
    : [];

  const lines = [
    `# Agent 候选清单 ${today}`,
    '',
    '> 自动发现，未收录。人工审核后按 PRD §4 手动写进 agents.yaml（$ pnpm validate）。',
    `> 门槛：star ≥ ${minStars}，近 180 天有推送，未归档，非 fork。`,
    `> 另外两条路：npm 周下载 ≥ ${minWeekly}（PRD §4.4 可与 star 二选一）；VS Code 商店安装量 ≥ ${minInstalls}（闭源 ide-plugin）。`,
    '',
    `共 ${candidates.length} + ${npmCandidates.length} + ${vscodeCandidates.length} 个候选，粗筛后 **${review.length}** 个建议人工过目（下表取 star 前 ${Math.min(top, review.length)}，其余在 json 里），${dropped.length} 个已自动排除。`,
    '',
    `来源：GitHub 搜索 ${QUERIES.length} 组（每组取前 ${perPage}）+ ${LISTS.length} 份权威清单 + npm ${NPM_QUERIES.length} 组 + VS Code 商店 ${VSCE_QUERIES.length} 组 + watchlist ${watch.length} 条。`,
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
    ...npmSection,
    '',
    ...vscodeSection,
    '',
    '## 已自动排除',
    '',
    ...dropped.map((d) => `- ${d.c.stars} [${d.c.repo}](${d.c.url}) — ${d.verdict.reason}`),
  ];
  await writeFile(join(dir, `${today}.md`), `${lines.join('\n')}\n`);

  console.log(
    `\n✓ ${candidates.length} + ${npmCandidates.length} + ${vscodeCandidates.length} 个候选 → 建议过目 ${review.length} / 自动排除 ${dropped.length}`,
  );
  console.log(`  data/candidates/${today}.md`);
  console.log('  下一步：人工过一遍上表 + watchlist 状态，把确认属于 §4.1 的写进 agents.yaml');
}

// 只在直接执行（`tsx src/discover.ts`）时跑主流程；被测试 import 时不触发网络发现
if (process.argv[1] != null && /discover\.(ts|js)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
