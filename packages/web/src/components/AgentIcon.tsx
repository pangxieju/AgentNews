/**
 * Agent 图标（Preact）—— .astro 页面与客户端 island 共用。
 * 远程 logo + 首字母色块兜底：加载失败自动降级，不会出现碎图。
 */
export interface AgentIconProps {
  slug: string;
  name?: string;
  icon?: string | null;
  iconFallback?: string | null;
  size?: number;
}

export default function AgentIcon({ slug, name, icon, iconFallback, size = 32 }: AgentIconProps) {
  const label = (name ?? slug).trim();
  const letter = [...label][0]?.toUpperCase() ?? '?';
  let hue = 7;
  for (const c of slug) hue = (hue * 31 + c.charCodeAt(0)) % 360;

  return (
    <span
      class="agent-icon"
      style={{ '--icon-size': `${size}px`, '--icon-hue': hue } as never}
      title={label}
      aria-hidden="true"
    >
      <span class="agent-icon-letter">{letter}</span>
      {icon && (
        <img
          src={icon}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          data-fallback={iconFallback ?? ''}
        />
      )}
    </span>
  );
}