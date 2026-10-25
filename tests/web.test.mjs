import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInput, parseHTML, handleApi } from '../server/core.mjs';
import { mergeQueue, summarize, safeFolder, verifyMP4 } from '../web/shared.mjs';

test('accepts TikTok profile and video links, rejects other hosts', () => {
  assert.equal(normalizeInput('@creator').type, 'profile');
  assert.equal(normalizeInput('https://www.tiktok.com/@creator/video/1234567890123456').id, '1234567890123456');
  assert.throws(() => normalizeInput('https://example.com/@creator'));
});

test('finds video cards and only allows trusted thumbnail hosts', () => {
  const html = '<div class="video-item"><p class="text-title">A &amp; B</p><img src="https://p16.tiktokcdn.com/a.jpg"><a class="pro-dl-link" data-name="SSSTikTok.dev_1234567890123456.mp4" href="https://tiktok.com/@creator/video/1234567890123456">Download</a></div>';
  const result = parseHTML(html, 'creator');
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].title, 'A & B');
  assert.match(result.videos[0].thumbnail, /^https:\/\//);
  assert.throws(() => normalizeInput('http://tiktok.com.evil.example/@creator'));
});

test('merges selections without duplicates and keeps failures separate', () => {
  const first = {username:'@creator',id:'1'};
  const next = {username:'@creator',id:'2'};
  const queue = mergeQueue([{video:first,status:'done'}], [first,next]);
  assert.equal(queue.length, 2);
  assert.deepEqual(summarize([...queue,{video:{id:'3'},status:'failed'}]), {total:3,done:1,failed:1});
});

test('builds valid MP4 box sequence and rejects truncated files', async () => {
  const box = (name, n=8) => { const b = new Uint8Array(n); new DataView(b.buffer).setUint32(0,n); for(let i=0;i<4;i++)b[4+i]=name.charCodeAt(i); return b; };
  const bytes = new Uint8Array([...box('ftyp',8),...box('moov',8),...box('mdat',8)]);
  assert.equal(await verifyMP4(new Blob([bytes])), true);
  await assert.rejects(() => verifyMP4(new Blob([bytes.slice(0,20)])));
});

test('rejects cross-site API requests before contacting upstream', async () => {
  let called = false;
  const request = new Request('https://example.netlify.app/api/search', { method:'POST', headers:{origin:'https://attacker.example','content-type':'application/json'}, body:JSON.stringify({url:'@creator'}) });
  const response = await handleApi(request, { fetcher: async () => { called=true; return new Response('{}'); } });
  assert.equal(response.status,403);
  assert.equal(called,false);
});

test('accepts Windows-safe account folders', () => {
  assert.equal(safeFolder('@creator'), '@creator');
  assert.equal(safeFolder('CON'), '@CON');
});
