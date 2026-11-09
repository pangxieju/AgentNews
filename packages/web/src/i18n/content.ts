import type { Lang } from './dict';

/** 变更记录表格数据（含少量行内 HTML，由页面用 set:html 渲染） */
export type ChangeRow = { date: string; change: string; reason: string };

export const CHANGELOG: Record<Lang, { spec: ChangeRow[]; product: ChangeRow[]; entries: ChangeRow[] }> = {
  zh: {
    spec: [
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
        reason: '中文在根路径、英文在 /en/，保留既有 URL；默认按浏览器语言判断，可手动切换',
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
          'Chinese at the root, English under /en/ so existing URLs keep working. Default follows browser language, with a manual switch.',
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
