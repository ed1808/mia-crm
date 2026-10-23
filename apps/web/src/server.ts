import { serve } from 'bun';
import indexHtml from './index.html';
import { createServer } from '@mia-crm/api';

const api = createServer();
const port = Number(process.env.PORT ?? 3000);

serve({
  port,
  routes: {
    '/': indexHtml,
  },
  async fetch(req) {
    const url = new URL(req.url);
    if (
      url.pathname.startsWith('/api') ||
      url.pathname.startsWith('/health') ||
      url.pathname.startsWith('/metrics')
    ) {
      return api.fetch(req);
    }
    return new Response(Bun.file('apps/web/src/index.html'));
  },
});

console.log(`MIA CRM Fullstack (Web + API) iniciado en http://localhost:${port}`);
