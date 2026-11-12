/**
 * 定价与使用约束（data/plans.yml）。
 *
 * 原则（与产品口径一致）：
 * - 只有 confidence: verified（官方页面可核验 + checked_at）才展示价格数字
 * - candidate 只展示「未核验」，绝不显示数字，避免编造
 * - 开源条目由 license 推导：可自托管、无许可成本；不在 yml 里逐条维护
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const PLANS_FILE = join(ROOT, 'data', 'plans.yml');

export type FreeTier = 'yes' | 'limited' | 'no' | 'unknown';
export type SelfHost = 'yes' | 'partial' | 'no' | 'unknown';
export type Confidence = 'verified' | 'candidate';

export type PlanInfo = {
  slug: string;
  free: FreeTier;
  /** USD / seat / month，仅 confidence=verified 时有值 */
  price_monthly: number | null;
  price_note: string | null;
  self_host: SelfHost;
  source_url: string | null;
  checked_at: string | null;
  confidence: Confidence;
};

type RawPlan = Partial<PlanInfo> & { slug: string };

let cache: Map<string, PlanInfo> | null = null;

function normalize(raw: RawPlan): PlanInfo {
  return {
    slug: raw.slug,
    free: (raw.free as FreeTier) ?? 'unknown',
    price_monthly: typeof raw.price_monthly === 'number' ? raw.price_monthly : null,
    price_note: raw.price_note ?? null,
    self_host: (raw.self_host as SelfHost) ?? 'unknown',
    source_url: raw.source_url ?? null,
    checked_at: raw.checked_at ?? null,
    confidence: raw.confidence === 'verified' ? 'verified' : 'candidate',
  };
}

export function loadPlans(): Map<string, PlanInfo> {
  if (cache) return cache;
  cache = new Map();
  try {
    const list = (parse(readFileSync(PLANS_FILE, 'utf8')) ?? []) as RawPlan[];
    for (const raw of list) {
      if (raw?.slug) cache.set(raw.slug, normalize(raw));
    }
  } catch {
    // 文件缺失/损坏 → 全部按 candidate 处理，不影响构建
  }
  return cache;
}

/**
 * 开源条目推导：license 不是 proprietary/unknown 即视为可自托管。
 * 这里只陈述「自托管无需许可费」，不猜 SaaS 定价。
 */
export function derivedPlan(
  slug: string,
  license: string | null | undefined,
  homepage: string | null | undefined,
): PlanInfo {
  const open = !!license && !/proprietary|unknown/i.test(license);
  return {
    slug,
    free: open ? 'yes' : 'unknown',
    price_monthly: open ? 0 : null,
    price_note: open ? 'Open source — self-host at no license cost' : null,
    self_host: open ? 'yes' : 'unknown',
    source_url: homepage ?? null,
    checked_at: null,
    confidence: open ? 'verified' : 'candidate',
  };
}

export function planFor(
  slug: string,
  license: string | null | undefined,
  homepage: string | null | undefined,
): PlanInfo {
  return loadPlans().get(slug) ?? derivedPlan(slug, license, homepage);
}