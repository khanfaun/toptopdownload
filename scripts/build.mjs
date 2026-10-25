import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await cp('web', 'dist', { recursive: true, force: true });
console.log('Web build ready: dist/. Netlify Edge Functions provide /api/*.');
