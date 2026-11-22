import 'dotenv/config';
import express, { type Express } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServerConfig } from './server/config/env.ts';
import { AgentOrchestrator } from './server/core/agentOrchestrator.ts';
import { ToolRegistry } from './server/core/toolRegistry.ts';
import { defaultAgentModules } from './server/modules/defaultModules.ts';
import { InMemoryConversationStore } from './server/persistence/memoryStore.ts';
import { createAgentRouter } from './server/routes/agentRoutes.ts';
import { createDownloadRouter } from './server/routes/downloadRoutes.ts';
import { createToolsRouter } from './server/routes/toolsRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer(): Promise<{ app: Express; httpServer: http.Server }> {
  const config = getServerConfig();
  const app = express();
  const httpServer = http.createServer(app);

  app.use(express.json({ limit: '25mb' }));

  const allowedOriginSet = new Set(config.allowedOrigins);
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOriginSet.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const registry = new ToolRegistry();
  for (const mod of defaultAgentModules) {
    registry.register(mod);
  }

  const conversationStore = new InMemoryConversationStore();
  const orchestrator = new AgentOrchestrator(registry, conversationStore);

  app.use('/api', createAgentRouter(orchestrator));
  app.use('/api', createToolsRouter());
  app.use('/api/downloads', createDownloadRouter(__dirname));

  if (config.nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return { app, httpServer };
}

const config = getServerConfig();
createServer()
  .then(({ httpServer }) => {
    httpServer.listen(config.port, '0.0.0.0', () => {
      console.log(`Neuron Mind server listening on http://0.0.0.0:${config.port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start Neuron Mind server:', error);
    process.exit(1);
  });
