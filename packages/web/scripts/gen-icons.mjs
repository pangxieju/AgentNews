/**
 * 生成站点自身的图标资产（无第三方依赖，纯 Node + zlib）。
 *
 *   pnpm --filter @agentnews/web brand:gen
 *
 * 产出（写入 public/）：
 *   favicon.ico          16 / 32 / 48 三尺寸，老浏览器与爬虫的兜底
 *   apple-touch-icon.png 180x180，iOS 添加到主屏用
 *   icon-192.png         192x192，manifest
 *   icon-512.png         512x512，manifest
 *
 * favicon.svg 是手写的矢量版（与这里同一套几何），浏览器优先用它。
 *
 * 几何与顶栏 .brand-mark 一致：ink 方块 + paper 色的等宽 "A"。
 * 渲染方式：4x 超采样后盒式降采样，避免小尺寸下锯齿。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const INK = [0x0e, 0x0f, 0x10];
const PAPER = [0xfc, 0xfc, 0xfb];

/* ───────────────────────── 几何 ───────────────────────── */

// 设计尺寸 32x32 坐标系
const VIEW = 32;
const APEX = [16, 7.2];
const LEFT_FOOT = [10.0, 24.8];
const RIGHT_FOOT = [22.0, 24.8];
const W_APEX = 1.2;
const W_FOOT = 2.1;
const BAR = { x0: 11.5, x1: 20.5, y0: 18.4, y1: 21.0 };

/** 一条从 P0 到 P1 的变宽笔画，返回四边形（顺时针或逆时针无关紧要） */
function strokeQuad(p0, p1, w0, w1) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return [
    [p0[0] + nx * w0, p0[1] + ny * w0],
    [p1[0] + nx * w1, p1[1] + ny * w1],
    [p1[0] - nx * w1, p1[1] - ny * w1],
    [p0[0] - nx * w0, p0[1] - ny * w0],
  ];
}

const SHAPES = [
  strokeQuad(APEX, LEFT_FOOT, W_APEX, W_FOOT),
  strokeQuad(APEX, RIGHT_FOOT, W_APEX, W_FOOT),
  [
    [BAR.x0, BAR.y0],
    [BAR.x1, BAR.y0],
    [BAR.x1, BAR.y1],
    [BAR.x0, BAR.y1],
  ],
];

/** 射线法命中测试；同时用圆形补上 apex 处的接缝 */
function inPolygon(px, py, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const APEX_CAP = W_APEX * 1.02;

function isInA(x, y) {
  if ((x - APEX[0]) ** 2 + (y - APEX[1]) ** 2 <= APEX_CAP ** 2) return true;
  return SHAPES.some((poly) => inPolygon(x, y, poly));
}

/* ───────────────────────── 光栅化 ───────────────────────── */

const SS = 4;

/** 渲染 size x size 的 RGBA 像素数组 */
function render(size) {
  const out = Buffer.alloc(size * size * 4);
  const scale = VIEW / size;
  const step = 1 / SS;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) * step) * scale;
          const y = (py + (sy + 0.5) * step) * scale;
          if (isInA(x, y)) cover++;
        }
      }
      const a = cover / (SS * SS);
      const o = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = Math.round(INK[c] + (PAPER[c] - INK[c]) * a);
      out[o + 3] = 255;
    }
  }
  return out;
}

/* ───────────────────────── PNG 编码 ───────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ───────────────────────── ICO 打包（内嵌 PNG） ───────────────────────── */

function toIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir[o] = size >= 256 ? 0 : size;
    dir[o + 1] = size >= 256 ? 0 : size;
    dir[o + 2] = 0; // palette
    dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4); // planes
    dir.writeUInt16LE(32, o + 6); // bpp
    dir.writeUInt32BE(0, o + 8);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });

  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

/* ───────────────────────── 输出 ───────────────────────── */

const icoSizes = [16, 32, 48];
const pngs = new Map();
for (const size of [...icoSizes, 180, 192, 512]) pngs.set(size, toPng(size, render(size)));

const OUT = [
  ['favicon.ico', toIco(icoSizes.map((size) => ({ size, data: pngs.get(size) })))],
  ['apple-touch-icon.png', pngs.get(180)],
  ['icon-192.png', pngs.get(192)],
  ['icon-512.png', pngs.get(512)],
];

for (const [name, data] of OUT) {
  writeFileSync(join(PUBLIC, name), data);
  console.log(`${name.padEnd(22)} ${(data.length / 1024).toFixed(1)} KB`);
}
