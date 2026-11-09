import { useEffect, useState } from 'preact/hooks';
import { PIN_EVENT, clearPins, readPins, removePin } from '../lib/pins';
import { type Lang, pathFor, t } from '../i18n/dict';
import AgentIcon from './AgentIcon';

export type PinMeta = Record<
  string,
  { name: string; form: string; score: number | null; icon: string | null; iconFallback: string | null }
>;

interface Props {
  meta: PinMeta;
  lang: Lang;
}

/** 全局对比托盘：钉选 1–3 个 agent 后出现，随时可跳到 /compare/ */
export default function PinTray({ meta, lang }: Props) {
  const [pins, setPins] = useState<string[]>([]);

  useEffect(() => {
    setPins(readPins());
    const onPins = (e: Event) => setPins((e as CustomEvent<string[]>).detail ?? readPins());
    window.addEventListener(PIN_EVENT, onPins);
    return () => window.removeEventListener(PIN_EVENT, onPins);
  }, []);

  if (pins.length === 0) return null;

  const items = pins.map((s) => ({
    slug: s,
    ...(meta[s] ?? { name: s, form: '', score: null, icon: null, iconFallback: null }),
  }));
  const href =
    pathFor(lang, '/compare/') +
    `?${pins.map((s, i) => `${['a', 'b', 'c'][i]}=${s}`).join('&')}`;

  return (
    <div class="pin-tray" role="region" aria-label={t(lang, 'tray.aria')}>
      <div class="pin-tray-inner">
        <span class="pin-tray-label">
          {t(lang, 'tray.label')} <b>{pins.length}</b>/3
        </span>
        <ul class="pin-tray-list">
          {items.map((i) => (
            <li>
              <AgentIcon slug={i.slug} name={i.name} icon={i.icon} iconFallback={i.iconFallback} size={20} />
              <span class="pin-name">{i.name}</span>
              <button
                type="button"
                class="pin-x"
                aria-label={t(lang, 'tray.remove', { name: i.name })}
                onClick={() => setPins(removePin(i.slug))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div class="pin-tray-actions">
          {pins.length >= 2 ? (
            <a class="btn btn-primary btn-sm" href={href}>{t(lang, 'tray.compare', { n: pins.length })}</a>
          ) : (
            <span class="pin-hint">{t(lang, 'tray.hint')}</span>
          )}
          <button type="button" class="pin-clear" onClick={() => setPins(clearPins())}>
            {t(lang, 'tray.clear')}
          </button>
        </div>
      </div>
    </div>
  );
}