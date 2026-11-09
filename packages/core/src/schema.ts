import { z } from 'zod';

/** 形态分类 —— 分组是排名的前提，跨形态不可比（PRD §4.2） */
export const Form = z.enum([
  'cli',
  'ide-plugin',
  'ide-app',
  'desktop',
  'browser',
  'framework',
  'autonomous',
]);
export type Form = z.infer<typeof Form>;

/** 开源 / 半开源 / 闭源（PRD §4.3） */
export const OssBucket = z.enum(['open', 'semi', 'closed']);
export type OssBucket = z.infer<typeof OssBucket>;

/** 一个 agent 的多个分发渠道（PRD §4.5） */
export const SourceKind = z.enum([
  'github',
  'npm',
  'pypi',
  'crates',
  'brew',
  'vscode',
  'chrome',
  'appstore',
  'releases',
  /** OpenRouter 应用榜单上的条目（identifier = app slug，无 slug 时用数字 app_id） */
  'openrouter',
  'manual',
]);
export type SourceKind = z.infer<typeof SourceKind>;

export const SourceSchema = z.object({
  kind: SourceKind,
  identifier: z.string().min(1),
  is_primary: z.boolean().default(false),
});
export type Source = z.infer<typeof SourceSchema>;

export const AgentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug 只能是小写字母/数字/连字符'),
  name: z.string().min(1),
  vendor: z.string().optional(),
  form: Form,
  oss_bucket: OssBucket,
  license_id: z.string().default('unknown'),
  homepage: z.string().url().optional(),
  /** 人工校准的图标地址（优先级最高，用于自动发现拿错的场景） */
  icon: z.string().url().optional(),
  sources: z.array(SourceSchema).min(1, '至少需要一个分发渠道'),
  note: z.string().optional(),
});
export type Agent = z.infer<typeof AgentSchema>;

/** agents.yaml 顶层校验：slug 唯一 + 闭源项目不得以 github 为主渠道 */
export const AgentsFileSchema = z
  .array(AgentSchema)
  .superRefine((agents, ctx) => {
    const seen = new Set<string>();
    for (const a of agents) {
      if (seen.has(a.slug)) {
        ctx.addIssue({
          code: 'custom',
          path: [a.slug],
          message: `duplicate slug: ${a.slug}`,
        });
      }
      seen.add(a.slug);
      const primaryGitHub = a.sources.find(
        (s) => s.kind === 'github' && s.is_primary,
      );
      if (a.oss_bucket === 'closed' && primaryGitHub) {
        ctx.addIssue({
          code: 'custom',
          path: [a.slug, 'sources'],
          message: `${a.slug}: closed source 不得以 github 为主渠道（闭源判定按 License，不按分发渠道）`,
        });
      }
    }
  });

export type AgentsFile = z.infer<typeof AgentsFileSchema>;

/** 原始指标（metric_raw 的 TS 形态，PRD §8） */
export type MetricKey =
  | 'stars'
  | 'forks'
  | 'contributors'
  | 'open_issues'
  | 'last_commit'
  | 'last_release'
  | 'npm_weekly_dl'
  | 'npm_monthly_dl'
  | 'pypi_monthly_dl'
  | 'vscode_installs'
  | 'discord_members'
  | 'repo_created'
  /** 当前分发版本（npm / PyPI / 商店 / GitHub release tag） */
  | 'version'
  /** 该版本的发布时间（能拿到才记） */
  | 'version_at'
  /** 版本来源渠道：npm | pypi | vscode | github */
  | 'version_source'
  /** 最近一次 GitHub release 的 tag / 标题 / 说明 / 链接 */
  | 'release_tag'
  | 'release_name'
  | 'release_notes'
  | 'release_url'
  /** OpenRouter 应用榜单：月/周 token 用量、请求数、名次（来源 openrouter.ai/apps） */
  | 'openrouter_tokens_month'
  | 'openrouter_tokens_week'
  | 'openrouter_requests_month'
  | 'openrouter_rank_month';
  
export type Metrics = Partial<Record<MetricKey, number | string | null>>;

export const SCORE_VERSION = 'v1';

export type ScoreInput = {
  slug: string;
  form: Form;
  oss_bucket: OssBucket;
  /** 当日采集的指标值；缺失的字段为 null/undefined */
  metrics: Metrics;
  /** 参考历史值：t-1 / t-7 / t-30（由 pipeline 从历史快照解析） */
  ref?: {
    prev: Metrics;
    weekAgo: Metrics;
    monthAgo: Metrics;
  };
};

/** 打分输出（score_daily / score_periodic 的 TS 形态） */
export type ScoreRow = {
  slug: string;
  name: string;
  form: Form;
  oss_bucket: OssBucket;
  score: number | null;
  rank_in_form: number | null;
  delta_1d: number | null;
  delta_7d: number | null;
  delta_30d: number | null;
  growth_7d_pct: number | null;
  growth_30d_pct: number | null;
  /** 关键原始指标（前端展示与排序用） */
  metrics: {
    stars: number | null;
    forks: number | null;
    contributors: number | null;
    installs: number | null;
    activity: number | null;
    last_release: string | null;
    /** 当前版本号（如 0.42.1 / v1.2.0），拿不到为 null */
    version: string | null;
    /** 版本发布时间（ISO 字符串），拿不到为 null */
    version_at: string | null;
    /** 版本来源渠道 */
    version_source: string | null;
    /** 最近一次 release（用于详情页「更新说明」） */
    release_tag: string | null;
    release_notes: string | null;
    release_url: string | null;
    /** OpenRouter 应用榜单（月）token 用量 / 请求数 / 名次；未收录为 null。
     *  可选：历史快照（归档）里没有这三个字段 */
    openrouter_tokens_month?: number | null;
    openrouter_requests_month?: number | null;
    openrouter_rank_month?: number | null;
  };
  /** 出道天数（min(repo 创建至今, 首次收录至今)）；无信息则为 null */
  age_days: number | null;
  /** 首次被收录的日期（YYYY-MM-DD） */
  first_listed: string | null;
  data_level: 'L1' | 'L2' | 'L3';
  flags: string[];
  score_version: typeof SCORE_VERSION;
};

export const FORMS: Form[] = [
  'cli',
  'ide-plugin',
  'ide-app',
  'desktop',
  'browser',
  'framework',
  'autonomous',
];
