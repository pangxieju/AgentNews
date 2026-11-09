/**
 * agents.yaml 校验（不联网，CI 与本地都跑）
 * 失败即非零退出 —— 绝不让错误数据进入流水线（PRD §14.5）
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { AgentsFileSchema } from '@agentrank/core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const raw = readFileSync(join(ROOT, 'agents.yaml'), 'utf8');
const result = AgentsFileSchema.safeParse(parse(raw));

if (!result.success) {
  console.error('✗ agents.yaml 校验失败：');
  for (const issue of result.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

const agents = result.data;
const byForm = new Map<string, number>();
const byBucket = new Map<string, number>();
for (const a of agents) {
  byForm.set(a.form, (byForm.get(a.form) ?? 0) + 1);
  byBucket.set(a.oss_bucket, (byBucket.get(a.oss_bucket) ?? 0) + 1);
}

console.log(`✓ agents.yaml 校验通过：${agents.length} 个 agent`);
console.log('  形态分布:', Object.fromEntries(byForm));
console.log('  开源分布:', Object.fromEntries(byBucket));

// 质量检查（警告，不阻断）
const warnings: string[] = [];
for (const a of agents) {
  if (!a.homepage) warnings.push(`${a.slug}: 缺少 homepage`);
  const kinds = new Set(a.sources.map((s) => s.kind));
  if (kinds.has('manual')) warnings.push(`${a.slug}: 仅 manual 渠道，无可用指标（L3 收录区）`);
  if (a.oss_bucket === 'open' && !kinds.has('github')) warnings.push(`${a.slug}: 开源但无 GitHub 渠道`);
  if (a.oss_bucket === 'open' && a.license_id === 'unknown') warnings.push(`${a.slug}: License 未确认`);
}
if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} 条警告：`);
  for (const w of warnings) console.log('  - ' + w);
}
