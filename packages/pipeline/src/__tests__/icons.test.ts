import { describe, expect, it } from 'vitest';
import { shouldReplace, type IconRecord } from '../icons.js';

const rec = (r: Partial<IconRecord> & { file: string; source: IconRecord['source'] }): IconRecord => ({
  w: 192,
  h: 192,
  ...r,
});

describe('shouldReplace —— 图标只升不降', () => {
  it('来源更可信就换：github 头像 → manifest 大图', () => {
    expect(shouldReplace(rec({ file: 'a.png', source: 'manifest', w: 512, h: 512 }), rec({ file: 'b.png', source: 'github' }))).toBe(true);
  });

  it('官网自述优于第三方 logo API', () => {
    expect(shouldReplace(rec({ file: 'a.png', source: 'html', w: 180, h: 180 }), rec({ file: 'b.png', source: 'logo', w: 256, h: 256 }))).toBe(true);
  });

  it('README 里的产品 logo 优于母公司 favicon 服务', () => {
    expect(shouldReplace(rec({ file: 'a.svg', source: 'readme', w: 0, h: 0 }), rec({ file: 'b.png', source: 'google', w: 128, h: 128 }))).toBe(true);
  });

  it('官网今天挂了只抓到第三方小图 —— 不换，保住昨天的高清图', () => {
    expect(shouldReplace(rec({ file: 'a.png', source: 'logo', w: 180, h: 180 }), rec({ file: 'b.png', source: 'html', w: 256, h: 256 }))).toBe(false);
  });

  it('降到组织头像一律不允许', () => {
    expect(shouldReplace(rec({ file: 'a.png', source: 'github' }), rec({ file: 'b.svg', source: 'manifest', w: 0, h: 0 }))).toBe(false);
  });

  it('同级来源：分辨率明显更大才换（避免每日抖动）', () => {
    expect(shouldReplace(rec({ file: 'a.png', source: 'html', w: 512, h: 512 }), rec({ file: 'b.png', source: 'html', w: 256, h: 256 }))).toBe(true);
    expect(shouldReplace(rec({ file: 'a.png', source: 'html', w: 280, h: 280 }), rec({ file: 'b.png', source: 'html', w: 256, h: 256 }))).toBe(false);
  });

  it('同级同尺寸：png 替掉 ico', () => {
    expect(shouldReplace(rec({ file: 'a.png', source: 'logo', w: 256, h: 256 }), rec({ file: 'b.ico', source: 'logo', w: 256, h: 256 }))).toBe(true);
  });

  it('升级来源但新图小得可怜、旧图够大时保留旧图', () => {
    expect(shouldReplace(rec({ file: 'a.png', source: 'html', w: 32, h: 32 }), rec({ file: 'b.png', source: 'logo', w: 256, h: 256 }))).toBe(false);
  });
});
