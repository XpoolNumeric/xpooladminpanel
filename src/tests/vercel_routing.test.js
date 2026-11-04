import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Vercel SPA Routing & Configuration Verification', () => {
    const vercelConfigPath = path.join(projectRoot, 'vercel.json');
    const distPath = path.join(projectRoot, 'dist');
    const appJsxPath = path.join(projectRoot, 'src/App.jsx');

    it('1. vercel.json exists and contains correct SPA rewrite rule', () => {
        assert.ok(fs.existsSync(vercelConfigPath), 'vercel.json must exist at project root');

        const raw = fs.readFileSync(vercelConfigPath, 'utf-8');
        const config = JSON.parse(raw);

        assert.ok(Array.isArray(config.rewrites), 'vercel.json must have a "rewrites" array');
        assert.strictEqual(config.rewrites.length, 1, 'vercel.json must contain exactly 1 rewrite rule');

        const rule = config.rewrites[0];
        assert.strictEqual(rule.source, '/(.*)', 'Rewrite source pattern must match all routes /(.*)');
        assert.strictEqual(rule.destination, '/index.html', 'Rewrite destination must point to /index.html');
    });

    it('2. App.jsx registers /dashboard and all administrative routes', () => {
        assert.ok(fs.existsSync(appJsxPath), 'App.jsx must exist');
        const appContent = fs.readFileSync(appJsxPath, 'utf-8');

        // Check required route paths
        const expectedRoutes = [
            '/',
            '/login',
            '/dashboard',
            '/users',
            '/trips',
            '/approvals',
            '/driver/:id',
            '/withdrawals',
            '/live-tracking',
            '/push-notifications',
            '/settings',
            '/reports',
            '/logs',
            '*',
        ];

        for (const route of expectedRoutes) {
            const hasRoute = appContent.includes(`path="${route}"`);
            assert.ok(hasRoute, `Route path="${route}" must be registered in App.jsx`);
        }

        // Verify catch-all 404 element
        assert.ok(appContent.includes('path="*" element={<NotFound />}'), 'Catch-all 404 route must be configured');
    });

    it('3. Production build output (dist) exists and has index.html and assets', () => {
        const indexPath = path.join(distPath, 'index.html');
        assert.ok(fs.existsSync(indexPath), 'dist/index.html must exist from production build');

        const html = fs.readFileSync(indexPath, 'utf-8');
        assert.ok(html.includes('<div id="root"></div>'), 'index.html must contain root mount div');
        assert.ok(html.includes('/assets/'), 'index.html must reference built assets in /assets/');

        const assetsDir = path.join(distPath, 'assets');
        assert.ok(fs.existsSync(assetsDir), 'dist/assets directory must exist');
        const assetFiles = fs.readdirSync(assetsDir);
        assert.ok(assetFiles.some(f => f.endsWith('.js')), 'dist/assets must contain JavaScript bundle');
        assert.ok(assetFiles.some(f => f.endsWith('.css')), 'dist/assets must contain CSS bundle');
    });

    describe('4. Simulated Vercel CDN Routing Server', () => {
        let server;
        let baseUrl;

        before(async () => {
            // Read vercel.json rewrites
            const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
            const rewriteRule = vercelConfig.rewrites[0];

            server = http.createServer((req, res) => {
                const parsedUrl = new URL(req.url, 'http://localhost');
                const pathname = parsedUrl.pathname;

                // 1. Resolve requested path against dist
                const filePath = path.join(distPath, pathname);

                // If path points to an actual file on disk (like /assets/index.js or /XPOOL_LOGO.png)
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    const ext = path.extname(filePath);
                    const mimeTypes = {
                        '.html': 'text/html; charset=utf-8',
                        '.js': 'application/javascript; charset=utf-8',
                        '.css': 'text/css; charset=utf-8',
                        '.png': 'image/png',
                        '.svg': 'image/svg+xml',
                        '.json': 'application/json',
                    };
                    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                    fs.createReadStream(filePath).pipe(res);
                    return;
                }

                // 2. Apply Vercel SPA rewrite fallback for unmatched paths
                const regex = new RegExp(`^${rewriteRule.source}$`);
                if (regex.test(pathname)) {
                    const destPath = path.join(distPath, rewriteRule.destination);
                    if (fs.existsSync(destPath)) {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        fs.createReadStream(destPath).pipe(res);
                        return;
                    }
                }

                // 3. Fallback 404
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            });

            await new Promise((resolve) => {
                server.listen(0, '127.0.0.1', () => {
                    const port = server.address().port;
                    baseUrl = `http://127.0.0.1:${port}`;
                    resolve();
                });
            });
        });

        after(async () => {
            if (server) {
                await new Promise((resolve) => server.close(resolve));
            }
        });

        it('Direct route to /dashboard returns index.html with 200 OK (resolving Vercel 404 bug)', async () => {
            const res = await fetch(`${baseUrl}/dashboard`);
            assert.strictEqual(res.status, 200);
            assert.ok(res.headers.get('content-type').includes('text/html'));
            const text = await res.text();
            assert.ok(text.includes('<div id="root"></div>'));
        });

        it('Direct route to /login returns index.html with 200 OK', async () => {
            const res = await fetch(`${baseUrl}/login`);
            assert.strictEqual(res.status, 200);
            assert.ok(res.headers.get('content-type').includes('text/html'));
            const text = await res.text();
            assert.ok(text.includes('<div id="root"></div>'));
        });

        it('Direct route to nested /driver/test-id-123 returns index.html with 200 OK', async () => {
            const res = await fetch(`${baseUrl}/driver/test-id-123`);
            assert.strictEqual(res.status, 200);
            assert.ok(res.headers.get('content-type').includes('text/html'));
            const text = await res.text();
            assert.ok(text.includes('<div id="root"></div>'));
        });

        it('Direct route to all admin sections (/users, /trips, /settings, /approvals, /reports) returns 200 OK', async () => {
            const routes = ['/users', '/trips', '/settings', '/approvals', '/reports', '/withdrawals', '/logs', '/live-tracking', '/push-notifications'];
            for (const r of routes) {
                const res = await fetch(`${baseUrl}${r}`);
                assert.strictEqual(res.status, 200, `Route ${r} should return 200`);
                assert.ok(res.headers.get('content-type').includes('text/html'));
            }
        });

        it('Static JS and CSS assets continue to be served with correct MIME types and NOT rewritten to index.html', async () => {
            const assetsDir = path.join(distPath, 'assets');
            const files = fs.readdirSync(assetsDir);
            const jsFile = files.find(f => f.endsWith('.js'));
            const cssFile = files.find(f => f.endsWith('.css'));

            assert.ok(jsFile, 'Must have a JS file in assets');
            assert.ok(cssFile, 'Must have a CSS file in assets');

            // Fetch JS asset
            const jsRes = await fetch(`${baseUrl}/assets/${jsFile}`);
            assert.strictEqual(jsRes.status, 200);
            assert.ok(jsRes.headers.get('content-type').includes('application/javascript'));
            const jsText = await jsRes.text();
            assert.ok(!jsText.includes('<!doctype html>'), 'JS asset must NOT be HTML');

            // Fetch CSS asset
            const cssRes = await fetch(`${baseUrl}/assets/${cssFile}`);
            assert.strictEqual(cssRes.status, 200);
            assert.ok(cssRes.headers.get('content-type').includes('text/css'));
            const cssText = await cssRes.text();
            assert.ok(!cssText.includes('<!doctype html>'), 'CSS asset must NOT be HTML');
        });

        it('Static public files (/XPOOL_LOGO.png) are served directly', async () => {
            const res = await fetch(`${baseUrl}/XPOOL_LOGO.png`);
            assert.strictEqual(res.status, 200);
            assert.ok(res.headers.get('content-type').includes('image/png'));
        });
    });
});

