// Kiểm tra định dạng head.json do training/common.py xuất ra khớp với phép tính trong trình duyệt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
const { _headForward } = await import('../assets/js/classifier.js');

test('head.json: JS cho cùng kết quả với numpy', () => {
  const j = JSON.parse(fs.readFileSync(new URL('./fixtures/head.json', import.meta.url)));
  const f = JSON.parse(fs.readFileSync(new URL('./fixtures/fixture.json', import.meta.url)));
  const dec = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
  const head = { layers: j.layers.map((L) => ({ w: dec(L.w), b: dec(L.b), inDim: L.shape[0], outDim: L.shape[1], act: L.activation })) };
  f.x.forEach((x, k) => {
    const p = _headForward(head, Float32Array.from(x));
    p.forEach((v, i) => assert.ok(Math.abs(v - f.p[k][i]) < 1e-4));
  });
});
