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
  | 'discord_members';

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
  form: Form;
  oss_bucket: OssBucket;
  score: number | null;
  rank_in_form: number | null;
  delta_1d: number | null;
  delta_7d: number | null;
  delta_30d: number | null;
  growth_7d_pct: number | null;
  growth_30d_pct: number | null;
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
