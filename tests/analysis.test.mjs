import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGroupIndex } from '../assets/js/categories.js';
import { analyzeClip, LiveStabilizer, displayConfidence } from '../assets/js/analysis.js';
import { denoise, rms, dbfs } from '../assets/js/dsp.js';

// Bảng lớp giả lập (một phần tên thật của YAMNet, đúng thứ tự tương đối Music ... Wind)
const NAMES = ['Speech', 'Children playing', 'Dog', 'Bark', 'Cat', 'Meow', 'Music', 'Guitar', 'Piano', 'Wind',
  'Vehicle horn, car horn, honking', 'Siren', 'Air conditioning', 'Mechanical fan', 'Silence', 'Hum', 'Gunshot, gunfire',
  'Traffic noise, roadway noise', 'Motorcycle', 'Animal'];
const C = NAMES.length;
const gi = buildGroupIndex(NAMES);
const at = (n) => NAMES.indexOf(n);

function clip(nF, fill) {
  const s = new Float32Array(nF * C);
  for (let f = 0; f < nF; f++) for (const [n, v] of Object.entries(fill(f))) s[f * C + at(n)] = v;
  return s;
}
const run = (scores, levels, extra = {}) => analyzeClip({ scores, scoresDen: null, nFrames: levels.length, nClasses: C, levels: Float32Array.from(levels), groupIndex: gi, classNames: NAMES, threshold: 0.28, ...extra });

test('nhạc nằm trong khoảng Music..Wind', () => {
  assert.deepEqual(gi.members.music.sort(), [at('Music'), at('Guitar'), at('Piano')].sort());
});

test('chó sủa trên nền máy lạnh -> ra chó sủa, không ra máy lạnh', () => {
  const s = clip(12, (f) => ({ 'Air conditioning': 0.55, Hum: 0.4, ...(f === 5 || f === 6 ? { Bark: 0.38, Dog: 0.33, Animal: 0.5 } : {}) }));
  const lv = Array.from({ length: 12 }, (_, f) => (f === 5 || f === 6 ? -28 : -48));
  const r = run(s, lv);
  assert.equal(r.status, 'detected');
  assert.equal(r.top.id, 'dog');
  assert.ok(r.timeline.some((t) => t.id === 'dog'));
  assert.ok(r.alternatives.some((a) => a.id === 'ac' && a.background));
});

test('chỉ có máy lạnh -> mô tả tiếng nền', () => {
  const s = clip(10, () => ({ 'Air conditioning': 0.5, 'Mechanical fan': 0.3, Speech: 0.05 }));
  const r = run(s, Array(10).fill(-45));
  assert.equal(r.status, 'background');
  assert.equal(r.top.id, 'ac');
});

test('phòng im lặng -> yên tĩnh', () => {
  const s = clip(8, () => ({ Silence: 0.8 }));
  const r = run(s, Array(8).fill(-80));
  assert.equal(r.status, 'quiet');
});

test('tạp âm nhỏ dưới cổng năng lượng không thành sự kiện', () => {
  // khung 2 có "Gunshot" nhưng mức âm chỉ bằng nền => bị cổng loại
  const s = clip(10, (f) => ({ 'Traffic noise, roadway noise': 0.4, ...(f === 2 ? { 'Gunshot, gunfire': 0.3 } : {}) }));
  const lv = Array.from({ length: 10 }, (_, f) => (f === 2 ? -70 : -40));
  const r = run(s, lv);
  assert.notEqual(r.top?.id, 'gunshot');
});

test('âm nhỏ hơn ngưỡng -> chưa chắc chắn', () => {
  const s = clip(6, (f) => ({ ...(f >= 2 && f <= 3 ? { Meow: 0.2 } : {}) }));
  const lv = Array.from({ length: 6 }, (_, f) => (f >= 2 && f <= 3 ? -30 : -50));
  const r = run(s, lv);
  assert.equal(r.status, 'uncertain');
  assert.equal(r.top.id, 'cat');
});

test('mô hình tự train bổ sung được nhóm mới', () => {
  const s = clip(6, () => ({ Speech: 0.3 }));
  const head = Array.from({ length: 6 }, () => ({ tieng_rao: 0.9 }));
  const r = run(s, Array(6).fill(-30), { headFrames: head, customGroups: { tieng_rao: { id: 'tieng_rao', vi: 'Tiếng rao', icon: 'speech', kind: 'people', weight: 1 } } });
  assert.equal(r.top.id, 'tieng_rao');
});

test('ổn định trực tiếp cần đủ số lần liên tiếp', () => {
  const st = new LiveStabilizer({ threshold: 0.28, streak: 2 });
  let o = st.push({ dog: 0.5 }, true, 0); assert.equal(o.confirmed, null);
  o = st.push({ dog: 0.5 }, true, 0.5); assert.equal(o.confirmed.id, 'dog'); assert.equal(o.fired.id, 'dog');
  o = st.push({ dog: 0.5 }, true, 1); assert.equal(o.fired, null); // đang cooldown
});

test('displayConfidence đơn điệu và <= 99', () => {
  assert.ok(displayConfidence(0.1) < displayConfidence(0.5));
  assert.ok(displayConfidence(1) <= 99);
});

test('lọc tạp âm giảm nhiễu đều nhưng giữ tiếng sủa ngắn', () => {
  const sr = 16000, n = sr * 3;
  const x = new Float32Array(n);
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) x[i] = 0.05 * rnd() + 0.03 * Math.sin(2 * Math.PI * 120 * i / sr); // "máy lạnh"
  const a = Math.floor(1.5 * sr), b = a + Math.floor(0.25 * sr);
  for (let i = a; i < b; i++) x[i] += 0.5 * Math.sin(2 * Math.PI * 700 * i / sr) * Math.sin(Math.PI * (i - a) / (b - a)); // "gâu"
  const { y, reductionDb } = denoise(x);
  const noiseBefore = dbfs(rms(x, 0, sr)), noiseAfter = dbfs(rms(y, 0, sr));
  const barkBefore = dbfs(rms(x, a, b)), barkAfter = dbfs(rms(y, a, b));
  assert.ok(noiseBefore - noiseAfter > 6, `nhiễu giảm ${noiseBefore - noiseAfter} dB`);
  assert.ok(barkBefore - barkAfter < 2, `tiếng sủa giảm ${barkBefore - barkAfter} dB`);
  assert.ok(reductionDb > 0);
});
