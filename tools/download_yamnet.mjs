// Tải mô hình YAMNet (TF.js) và bảng lớp về models/yamnet/ để web tự host, không phụ thuộc TF Hub.
// Chạy:  node tools/download_yamnet.mjs      (Node 18+)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'models', 'yamnet');
const BASES = [
  'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1',
  'https://www.kaggle.com/models/google/yamnet/TfJs/tfjs/1',
];
const CLASS_MAP = 'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv';

async function get(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}

await fs.mkdir(OUT, { recursive: true });
let done = false;
for (const base of BASES) {
  try {
    console.log('Đang tải model.json từ', base);
    const r = await get(`${base}/model.json?tfjs-format=file`);
    const model = await r.json();
    await fs.writeFile(path.join(OUT, 'model.json'), JSON.stringify(model));
    for (const group of model.weightsManifest) {
      for (const p of group.paths) {
        process.stdout.write(`  ${p} … `);
        const w = await get(`${base}/${p}?tfjs-format=file`);
        await fs.writeFile(path.join(OUT, p), Buffer.from(await w.arrayBuffer()));
        console.log('ok');
      }
    }
    done = true;
    break;
  } catch (e) {
    console.warn('  thất bại:', e.message);
  }
}
if (!done) {
  console.error('Không tải được mô hình. Web vẫn chạy bằng cách tải trực tiếp từ TF Hub.');
  process.exit(1);
}
const csv = await (await get(CLASS_MAP)).text();
await fs.writeFile(path.join(OUT, 'yamnet_class_map.csv'), csv);
console.log(`Xong! Đã lưu vào ${OUT}. Commit thư mục này để Vercel phục vụ mô hình từ chính tên miền của bạn.`);
