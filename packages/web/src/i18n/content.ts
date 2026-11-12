import type { Lang } from './dict';

/** 变更记录表格数据（含少量行内 HTML，由页面用 set:html 渲染） */
export type ChangeRow = { date: string; change: string; reason: string };

export const CHANGELOG: Record<Lang, { spec: ChangeRow[]; product: ChangeRow[]; entries: ChangeRow[] }> = {
  zh: {
    spec: [
      {
        date: '2026-11-12',
        change:
          '聚焦范围：榜单仅展示 <code>cli</code> / <code>ide-plugin</code> / <code>ide-app</code> 三个形态，其余形态冻结保留详情页',
        reason: '核心形态数据完整度优先，范围由用户价值而非数据可得性定义',
      },
      {
        date: '2026-11-12',
        change:
          '接入 VS Code / JetBrains 商店口径，闭源 IDE 插件从 L3 进入排名（闭源在榜 7 → 17），行内标注 <code>store_installs</code>',
        reason: '闭源产品没有 GitHub star，商店安装是唯一公开且可核验的采用度信号；累计安装与周下载必须分开标注，不能混算',
      },
      {
        date: '2026-11-12',
        change: '新增停更闸门：近 180 天无提交/发版 → <code>dormant</code>，移出排名',
        reason: 'gpt-engineer 停更 888 天仍在自主榜第 2、Plandex 停更 483 天仍在 CLI 榜，违反 PRD §4.4 的活跃必要条件',
      },
      {
        date: '2026-11-12',
        change: '周榜口径：按「近 7 天安装量增量」排名（npm / PyPI range 回填）',
        reason:
          'GitHub star 没有公开历史接口，无法合法回填（拉 stargazers 在上万 star 时不可行）；安装量可以，且更能反映采用变化。回填条目带 <code>backfilled_installs</code> 标记',
      },
      {
        date: '2026-11-12',
        change: '分数命名空间分离（score_version → v2）：同一形态内开源（open+semi）与闭源分开做组内分位与排名',
        reason:
          '开源有 star/contributors，闭源只有安装/用量；混在一个分位里会让闭源系统性吃亏，也让「同形态内可比」不成立。榜单的开/闭源 tab 现在各自对应一套分位',
      },
      {
        date: '2026-11-12',
        change: '新增「定价与约束」：免费版 / 起步价 / 自托管；只有已核验条目才显示价格数字',
        reason:
          '选型最后一公里是「能不能用、多少钱」。价格有地区/年付/席位差异且高频变动，未核验就写死等于编造；因此候选条目只展示「未核验 + 官方来源」，由人工复核后才显示数字',
      },
      {
        date: '2026-11-09',
        change: '分位数改为秩中点平滑',
        reason:
          '原实现 <code>rank/(n-1)</code> 在小组（n=3）退化为 {0, 0.5, 1}，star 最少者直接得 0 分',
      },
      {
        date: '2026-11-09',
        change: 'L3（无数据）不参与排名',
        reason:
          'Cursor / Windsurf / Trae 无任何指标却拿到 50 分并占前三，违反「不可比的就不排名」原则',
      },
      {
        date: '2026-11-09',
        change: '安装量 ≥ 100 万/周 打 <code>installs_may_include_ci</code> 标',
        reason: 'npm 下载量含 CI 与依赖安装，非真实用户数（codex 26M/周 明显失真）',
      },
      {
        date: '2026-11-09',
        change: '周期口径：计算用滚动窗口，归档用自然周期',
        reason: '自然周期累计在月中排名会让先发生的项目占便宜，且每月 1 号出现断崖',
      },
      {
        date: '2026-11-09',
        change: '新增版本采集（npm / PyPI / VS Code / GitHub release）',
        reason: '版本号比 release 时间更精确，且能直接回答「现在装的是哪一版」',
      },
    ],
    product: [
      {
        date: '2026-11-09',
        change: '新增并排对比 <code>/compare/</code>',
        reason: '选型的最后一步是「A 还是 B」，榜单给不了逐项差异；对比只允许同形态，跨形态标注不可比',
      },
      {
        date: '2026-11-09',
        change: '新增形态指南 <code>/forms/[form]/</code>',
        reason: '用户第一个问题是「我在哪儿用它」，不是「谁排第一」；先讲形态取舍，再给榜单',
      },
      {
        date: '2026-11-09',
        change: '首页改为「选形态 → 找候选 → 对比」',
        reason: '原首页以双榜为主角，把选型动作藏在了二级页；主线应该是决策路径',
      },
      {
        date: '2026-11-09',
        change: '详情页新增「上手」与「同形态其他选择」',
        reason: '安装命令与渠道从 agents.yaml 推导（不猜价格、不猜功能），替代项只取同形态',
      },
      {
        date: '2026-11-09',
        change: '新增中 / 英文双语',
        reason: '英文在根路径（默认）、中文在 /zh/；旧的 /en/ 链接 301 到根路径，默认按浏览器语言判断，可手动切换',
      },
      {
        date: '2026-11-09',
        change: '接入 OpenRouter 应用榜用量',
        reason:
          '补上「真的在用多少」的维度（月/周 token、请求数、站内名次）；不参与综合分，且只覆盖经 OpenRouter 转发的流量',
      },
    ],
    entries: [
      { date: '2026-11-09', change: '新增 32 个', reason: '名单从 28 扩至 60，全部经 ungh.cc + raw.githubusercontent.com 核验' },
      {
        date: '2026-11-09',
        change: '修正 Pi',
        reason: '<code>TheLaoGao/pi</code>（404）→ <code>badlogic/pi-mono</code> + npm <code>@earendil-works/pi-coding-agent</code>',
      },
      {
        date: '2026-11-09',
        change: '修正 Kilo Code',
        reason: '<code>KiloCodeInc/Kilo-Code</code>（404）→ <code>Kilo-Org/kilocode</code>',
      },
      {
        date: '2026-11-09',
        change: '修正 Qwen Code',
        reason: '<code>QwenLM/Qwen2.5-Coder</code>（模型库）→ <code>QwenLM/qwen-code</code>',
      },
      {
        date: '2026-11-09',
        change: '降级 Cursor CLI',
        reason: 'npm <code>cursor-cli</code> 为抢注包（49 次/周），非官方渠道 → L3 收录区',
      },
      {
        date: '2026-11-09',
        change: '修正 Cody',
        reason: '<code>sourcegraph/cody</code> 已下线 → <code>sourcegraph/cody-public-snapshot</code>（2025-08 停止活跃）',
      },
      { date: '2026-11-09', change: '删除 Amos', reason: '仓库与 npm 包均不存在，系凭空推测条目' },
      {
        date: '2026-11-09',
        change: '标注 semi',
        reason: 'Crush（FSL-1.1-MIT）、AutoGPT（含 Polyform Shield）源码可见但非 OSI',
      },
    ],
  },
  en: {
    spec: [
      {
        date: '2026-11-12',
        change:
          'Focus scope: boards only list <code>cli</code> / <code>ide-plugin</code> / <code>ide-app</code>; other forms are frozen with detail pages kept',
        reason: 'Data completeness in the core forms comes first — scope follows user value, not data availability',
      },
      {
        date: '2026-11-12',
        change:
          'Added VS Code / JetBrains store data; closed IDE plugins move from L3 into the ranking (closed ranked 7 → 17), flagged as <code>store_installs</code>',
        reason: 'Closed products have no GitHub stars; store installs are the only public, verifiable adoption signal — and cumulative installs must be labelled apart from weekly downloads',
      },
      {
        date: '2026-11-12',
        change: 'Dormant gate: no commit or release in 180 days → <code>dormant</code>, removed from ranking',
        reason: 'gpt-engineer sat at #2 in autonomous 888 days after its last release, Plandex at CLI #16 after 483 days — both violate the PRD §4.4 activity requirement',
      },
      {
        date: '2026-11-12',
        change: 'Weekly board ranks by 7-day install delta (npm / PyPI range backfill)',
        reason:
          'GitHub stars have no public historical API — backfilling stargazers is infeasible at 10k+ scale. Installs can be backfilled and reflect adoption change more directly. Backfilled rows carry <code>backfilled_installs</code>',
      },
      {
        date: '2026-11-12',
        change: 'Score namespaces split (score_version → v2): open (open+semi) and closed now get separate in-form percentiles and ranks',
        reason:
          'Open-source entries have stars and contributors; closed ones only have installs and usage. Mixing them in one percentile systematically penalised closed products and broke “comparable within a form”. The open/closed board tabs now map to their own distribution',
      },
      {
        date: '2026-11-12',
        change: 'Added pricing & constraints: free tier / starting price / self-host; prices are only shown for verified rows',
        reason:
          'The last mile of selection is “can I use it, and what does it cost?”. Pricing varies by region, annual terms and seats, and changes often — writing it down unverified is fabrication. Candidate rows show “unverified + official source” until a human review confirms the number.',
      },
      {
        date: '2026-11-09',
        change: 'Percentiles switched to mid-rank smoothing',
        reason:
          'The previous <code>rank/(n-1)</code> degenerated to {0, 0.5, 1} in small groups (n=3), giving the lowest-star project a flat 0',
      },
      {
        date: '2026-11-09',
        change: 'L3 (no data) is no longer ranked',
        reason:
          'Cursor / Windsurf / Trae had no metrics yet scored 50 and took the top three, violating “only comparable things get ranked”',
      },
      {
        date: '2026-11-09',
        change: 'Installs ≥ 1M/week are flagged <code>installs_may_include_ci</code>',
        reason: 'npm downloads include CI and dependency installs, not real users (codex at 26M/week is clearly inflated)',
      },
      {
        date: '2026-11-09',
        change: 'Periods: rolling windows for scoring, calendar periods for archives',
        reason:
          'Calendar-period accumulation favours whoever shipped early in the month, and creates a cliff on the 1st',
      },
      {
        date: '2026-11-09',
        change: 'Added version capture (npm / PyPI / VS Code / GitHub release)',
        reason: 'A version number is more precise than a release timestamp and answers “which build am I installing?”',
      },
    ],
    product: [
      {
        date: '2026-11-09',
        change: 'Added side-by-side compare <code>/compare/</code>',
        reason:
          'The last step of selection is “A or B”, which a leaderboard cannot answer. Compare is same-form only; cross-form is labelled non-comparable.',
      },
      {
        date: '2026-11-09',
        change: 'Added form guides <code>/forms/[form]/</code>',
        reason:
          'The first question is “where do I use it”, not “who is #1”. Explain the trade-offs first, then show the board.',
      },
      {
        date: '2026-11-09',
        change: 'Homepage reworked into “pick a form → shortlist → compare”',
        reason: 'The old homepage led with leaderboards and hid the selection flow one level down. Decision path should be the spine.',
      },
      {
        date: '2026-11-09',
        change: 'Agent pages gained “Get started” and “Other options in this form”',
        reason:
          'Install commands are derived from agents.yaml (no guessing prices or features); alternatives are same-form only.',
      },
      {
        date: '2026-11-09',
        change: 'Added Chinese / English',
        reason:
          'English at the root (default), Chinese under /zh/; old /en/ links 301 to the root. Default follows browser language, with a manual switch.',
      },
      {
        date: '2026-11-09',
        change: 'Added OpenRouter app usage',
        reason:
          'Adds a “how much is it actually used” signal (tokens per month/week, requests, in-site rank). Not part of the composite score, and covers OpenRouter-routed traffic only.',
      },
    ],
    entries: [
      { date: '2026-11-09', change: 'Added 32 entries', reason: 'List grew from 28 to 60, all verified via ungh.cc + raw.githubusercontent.com' },
      {
        date: '2026-11-09',
        change: 'Fixed Pi',
        reason: '<code>TheLaoGao/pi</code> (404) → <code>badlogic/pi-mono</code> + npm <code>@earendil-works/pi-coding-agent</code>',
      },
      {
        date: '2026-11-09',
        change: 'Fixed Kilo Code',
        reason: '<code>KiloCodeInc/Kilo-Code</code> (404) → <code>Kilo-Org/kilocode</code>',
      },
      {
        date: '2026-11-09',
        change: 'Fixed Qwen Code',
        reason: '<code>QwenLM/Qwen2.5-Coder</code> (a model repo) → <code>QwenLM/qwen-code</code>',
      },
      {
        date: '2026-11-09',
        change: 'Demoted Cursor CLI',
        reason: 'npm <code>cursor-cli</code> is a squatted package (49/week), not an official channel → L3 listing',
      },
      {
        date: '2026-11-09',
        change: 'Fixed Cody',
        reason: '<code>sourcegraph/cody</code> is retired → <code>sourcegraph/cody-public-snapshot</code> (inactive since 2025-08)',
      },
      { date: '2026-11-09', change: 'Removed Amos', reason: 'Neither the repo nor the npm package exists; the entry was speculative' },
      {
        date: '2026-11-09',
        change: 'Marked semi',
        reason: 'Crush (FSL-1.1-MIT) and AutoGPT (Polyform Shield) are source-available but not OSI',
      },
    ],
  },
};
