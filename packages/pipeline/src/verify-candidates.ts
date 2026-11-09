/**
 * 候选条目核验：批量验证 GitHub repo 存在性 + 取 star
 * 不消耗 GitHub API 额度（走 ungh.cc）
 *
 * 用法：tsx src/verify-candidates.ts
 */
const CANDIDATES: { slug: string; repo: string; npm?: string; pypi?: string; vscode?: string }[] = [
  // ── CLI ──
  { slug: 'crush', repo: 'charmbracelet/crush', npm: '@charmland/crush' },
  { slug: 'amp', repo: 'sourcegraph/amp' },
  { slug: 'droid', repo: 'factory-ai/factory' },
  { slug: 'iflow-cli', repo: 'iflow-ai/iflow-cli', npm: '@iflow-ai/iflow-cli' },
  { slug: 'mistral-vibe', repo: 'mistralai/mistral-vibe' },
  { slug: 'continue-cli', repo: 'continuedev/continue' },
  { slug: 'auggie', repo: 'augmentcode/auggie' },
  { slug: 'forge', repo: 'tailcallhq/forgecode' },
  { slug: 'ra-aid', repo: 'ra-aid/ra-aid' },
  { slug: 'plandex', repo: 'plandex-ai/plandex' },
  { slug: 'mentat', repo: 'AbanteAI/mentat' },
  { slug: 'sweep', repo: 'sweepai/sweep' },

  // ── IDE 插件 ──
  { slug: 'cody', repo: 'sourcegraph/cody', vscode: 'sourcegraph.cody-ai' },
  { slug: 'twinny', repo: 'twinlogix/twinny', vscode: 'rlivings39.twinny' },
  { slug: 'codegeex', repo: 'zai-org/CodeGeeX4', vscode: 'aminer.codegeex' },
  { slug: 'copilot', repo: '' },
  { slug: 'amazon-q', repo: '' },
  { slug: 'tabnine', repo: '' },

  // ── IDE 应用 ──
  { slug: 'zed', repo: 'zed-industries/zed' },
  { slug: 'void', repo: 'voideditor/void' },
  { slug: 'pearai', repo: 'trypear/pearai-app' },
  { slug: 'theia-ide', repo: 'eclipse-theia/theia' },
  { slug: 'kiro', repo: '' },

  // ── 浏览器 ──
  { slug: 'skyvern', repo: 'Skyvern-AI/skyvern', pypi: 'skyvern' },
  { slug: 'nanobrowser', repo: 'nanobrowser/nanobrowser' },
  { slug: 'comet', repo: '' },
  { slug: 'dia', repo: '' },
  { slug: 'browserbase', repo: 'browserbase/stagehand' },

  // ── 框架 ──
  { slug: 'mastra', repo: 'mastra-ai/mastra', npm: 'mastra' },
  { slug: 'vercel-ai-sdk', repo: 'vercel/ai', npm: 'ai' },
  { slug: 'semantic-kernel', repo: 'microsoft/semantic-kernel', pypi: 'semantic-kernel' },
  { slug: 'llamaindex', repo: 'run-llama/llama_index', pypi: 'llama-index' },
  { slug: 'haystack', repo: 'deepset-ai/haystack', pypi: 'haystack-ai' },
  { slug: 'dify', repo: 'langgenius/dify' },
  { slug: 'n8n', repo: 'n8n-io/n8n', npm: 'n8n' },
  { slug: 'flowise', repo: 'FlowiseAI/Flowise', npm: 'flowise' },
  { slug: 'langchain', repo: 'langchain-ai/langchain', pypi: 'langchain' },
  { slug: 'smolagents', repo: 'huggingface/smolagents', pypi: 'smolagents' },
  { slug: 'google-adk', repo: 'google/adk-python', pypi: 'google-adk' },
  { slug: 'strands', repo: 'strands-agents/sdk-python', pypi: 'strands-agents' },
  { slug: 'atomic-agents', repo: 'BrainBlend-AI/atomic-agents', pypi: 'atomic-agents' },
  { slug: 'agent-framework', repo: 'microsoft/agent-framework', pypi: 'agent-framework' },

  // ── 自主 ──
  { slug: 'autogpt', repo: 'Significant-Gravitas/AutoGPT' },
  { slug: 'babyagi', repo: 'yoheinakajima/babyagi' },
  { slug: 'gpt-engineer', repo: 'AntonOsika/gpt-engineer', pypi: 'gpt-engineer' },
  { slug: 'devika', repo: 'stitionai/devika' },
  { slug: 'agent-zero', repo: 'frdel/agent-zero' },
  { slug: 'manus', repo: '' },
  { slug: 'devin', repo: '' },
];

async function verifyRepo(repo: string): Promise<{ stars: number; forks: number; pushedAt: string; license: string } | null> {
  if (!repo) return null;
  try {
    const res = await fetch(`https://ungh.cc/repos/${repo}`, {
      headers: { 'User-Agent': 'agentrank-verify' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { repo?: { stars: number; forks: number; pushedAt: string; license?: string } };
    if (!data.repo) return null;
    return {
      stars: data.repo.stars,
      forks: data.repo.forks,
      pushedAt: data.repo.pushedAt,
      license: (data.repo as { license?: string }).license ?? '-',
    };
  } catch {
    return null;
  }
}

async function verifyNpm(pkg: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { downloads?: number };
    return d.downloads ?? null;
  } catch {
    return null;
  }
}

async function verifyPypi(pkg: string): Promise<number | null> {
  try {
    const res = await fetch(`https://pypistats.org/api/packages/${encodeURIComponent(pkg)}/recent`, {
      headers: { 'User-Agent': 'agentrank-verify' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { data?: { last_month?: number } };
    return d.data?.last_month ?? null;
  } catch {
    return null;
  }
}

const results: string[] = [];
for (const c of CANDIDATES) {
  const gh = await verifyRepo(c.repo);
  const npm = c.npm ? await verifyNpm(c.npm) : null;
  const pypi = c.pypi ? await verifyPypi(c.pypi) : null;

  const ok = gh != null || npm != null || pypi != null;
  const status = ok ? '✓' : '✗';
  const parts: string[] = [];
  if (gh) parts.push(`star=${gh.stars} fork=${gh.forks} lic=${gh.license} push=${gh.pushedAt.slice(0, 10)}`);
  if (npm != null) parts.push(`npm=${npm}/w`);
  if (pypi != null) parts.push(`pypi=${pypi}/mo`);
  if (!c.repo && !c.npm && !c.pypi) parts.push('(需人工核实)');

  results.push(`${status} ${c.slug.padEnd(16)} ${parts.join('  ') || 'NO DATA'}${gh == null && c.repo ? `  [repo ${c.repo} 不存在]` : ''}`);
  console.log(results[results.length - 1]);
}

console.log('\n--- 汇总 ---');
console.log('可收录（有数据）:', results.filter((r) => r.startsWith('✓')).length);
console.log('无数据:', results.filter((r) => r.startsWith('✗')).length);
