import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'https';
import http from 'http';
import { BUILD_TAG } from './src/version';

function fetchExternalHtml(targetUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = targetUrl.startsWith('https') ? https : http;
    const req = client.get(
      targetUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 8000,
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchExternalHtml(new URL(res.headers.location, targetUrl).toString())
            .then(resolve)
            .catch(reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function summarizeHtmlContent(html: string, url: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const titleMatch = withoutScripts.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch
    ? titleMatch[1].replace(/\s+/g, ' ').trim()
    : '지자체 홍보 페이지';

  const plainLines = withoutScripts
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 4);

  // 핵심 문장 추출 (코스, 시간, 장소, 프로그램, 통제 안내 등)
  const keyHighlights = plainLines
    .filter(
      (line) =>
        /코스|출발|반환|프로그램|기간|장소|시간|무료|접수|통제|공연|체험|운영/.test(line) &&
        line.length <= 140 &&
        !/메뉴|로그인|저작권|개인정보|배너|쿠키|댓글/.test(line)
    )
    .slice(0, 8);

  const trafficNotice = plainLines.find((line) => /통제|우회|주차|유의/.test(line));

  return {
    sourceUrl: url,
    pageTitle,
    highlights: keyHighlights.length > 0 ? keyHighlights : plainLines.slice(0, 6),
    trafficNotice: trafficNotice || null,
    fetchedAt: new Date().toISOString(),
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/KoreaEvent/' : '/',
  plugins: [
    react(),
    {
      name: 'municipal-promo-enrich-middleware',
      configureServer(server) {
        server.middlewares.use('/api/municipal-enrich', async (req, res) => {
          try {
            const reqUrl = new URL(req.url || '', 'http://localhost');
            const targetUrl = reqUrl.searchParams.get('url');
            if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: '유효한 지자체 홍보 URL이 필요합니다.' }));
              return;
            }
            const html = await fetchExternalHtml(targetUrl);
            const summary = summarizeHtmlContent(html, targetUrl);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(summary));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error: err?.message || '지자체 홍보 페이지 수집 실패',
              })
            );
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api/korservice2': {
        target: 'https://apis.data.go.kr/B551011/KorService2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/korservice2/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${BUILD_TAG}-[hash].js`,
        chunkFileNames: `assets/[name]-${BUILD_TAG}-[hash].js`,
        assetFileNames: `assets/[name]-${BUILD_TAG}-[hash].[ext]`,
      },
    },
  },
}));
