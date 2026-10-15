import { mkdir, writeFile } from 'node:fs/promises';
const directory = new URL('../src/assets/', import.meta.url);
await mkdir(directory, { recursive: true });
const assets = [
  ['lake.jpg', 'https://images.unsplash.com/photo-1561175024-ef321892a9a9?auto=format&fit=crop&w=1200&q=85'],
  ['forest.jpg', 'https://images.unsplash.com/photo-1685330187195-1bae2038f3c4?auto=format&fit=crop&w=900&q=80'],
  ['coffee.jpg', 'https://images.unsplash.com/photo-1659622067140-a0f4a2a7da09?auto=format&fit=crop&w=900&q=80'],
  ['desk.jpg', 'https://images.unsplash.com/photo-1755882296284-ab41bfe0e377?auto=format&fit=crop&w=900&q=80'],
  ['mountains.jpg', 'https://images.unsplash.com/photo-1731512820214-901f23bb6615?auto=format&fit=crop&w=900&q=80']
];
await Promise.all(assets.map(async ([name, url]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Image download failed: ' + name);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1000) throw new Error('Incomplete image: ' + name);
  await writeFile(new URL(name, directory), bytes);
  console.log(name + ': ' + bytes.length + ' bytes');
}));
