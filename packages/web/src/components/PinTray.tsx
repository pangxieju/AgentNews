import { useEffect, useState } from 'preact/hooks';
import { PIN_EVENT, TRAY_EVENT, clearPins, readPins, removePin } from '../lib/pins';
import AgentIcon from './AgentIcon';

export type PinMeta = Record<
  string,
  { name: string; form: string; score: number | null; icon: string | null; iconFallback: string | null }
>;

interface Props {
  meta: PinMeta;
}

/**
 * 全局对比托盘：钉选 1–3 个 agent 后出现，随时可跳到 /compare/。
 * 这是整个站点的「候选篮」——选型过程本身就是收集候选。
 */
export default function PinTray({ meta }: Props) {
  const [pins, setPins] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPins(readPins());
    const onPins = (e: Event) => setPins((e as CustomEvent<string[]>).detail ?? readPins());
    const onTray = () => setOpen(true);
    window.addEventListener(PIN_EVENT, onPins);
    window.addEventListener(TRAY_EVENT, onTray);
    return () => {
      window.removeEventListener(PIN_EVENT, onPins);
      window.removeEventListener(TRAY_EVENT, onTray);
    };
  }, []);

  if (pins.length === 0) return null;

  const items = pins.map((s) => ({
    slug: s,
    ...(meta[s] ?? { name: s, form: '', score: null, icon: null, iconFallback: null }),
  }));
  const href = `/compare/?${pins.map((s, i) => `${['a', 'b', 'c'][i]}=${s}`).join('&')}`;

  return (
    <div class={`pin-tray${open ? ' is-open' : ''}`} role="region" aria-label="对比候选">
      <div class="pin-tray-inner">
        <span class="pin-tray-label">
          候选 <b>{pins.length}</b>/3
        </span>
        <ul class="pin-tray-list">
          {items.map((i) => (
            <li>
              <AgentIcon slug={i.slug} name={i.name} icon={i.icon} iconFallback={i.iconFallback} size={20} />
              <span class="pin-name">{i.name}</span>
              <button type="button" class="pin-x" aria-label={`移除 ${i.name}`} onClick={() => setPins(removePin(i.slug))}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <div class="pin-tray-actions">
          {pins.length >= 2 ? (
            <a class="btn btn-primary btn-sm" href={href}>对比 {pins.length} 个 →</a>
          ) : (
            <span class="pin-hint">再钉 1 个即可对比</span>
          )}
          <button type="button" class="pin-clear" onClick={() => setPins(clearPins())}>
            清空
          </button>
        </div>
      </div>
    </div>
  );
}
