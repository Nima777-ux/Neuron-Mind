import { Router, type Request, type Response } from 'express';
import type { AgentOrchestrator } from '../core/agentOrchestrator.ts';
import type {
  AppLanguage,
  ChatAttachment,
  ChatMessage,
  ClientToolResult,
  ComputerFsContext,
  WorkspaceSnapshot,
} from '../core/types.ts';
import {
  GeminiConfigurationError,
  GeminiUpstreamError,
  summarizeImportantEmails,
  type EmailSummaryInputItem,
} from '../services/geminiClient.ts';

const DEFAULT_LOCAL_USER_ID = 'local-workspace-user';

export function createAgentRouter(orchestrator: AgentOrchestrator): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/agent/overview', (_req: Request, res: Response) => {
    res.json({
      readiness: orchestrator.getReadiness(),
      modules: orchestrator.listModules(),
    });
  });

  router.get('/agent/conversations', async (_req: Request, res: Response) => {
    const conversations = await orchestrator.listConversations(
      DEFAULT_LOCAL_USER_ID
    );
    res.json({ conversations });
  });

  router.post('/agent/conversations', async (req: Request, res: Response) => {
    const rawTitle =
      typeof req.body?.title === 'string' ? req.body.title.trim() : undefined;
    const conversation = await orchestrator.createConversation(
      DEFAULT_LOCAL_USER_ID,
      rawTitle || undefined
    );
    res.status(201).json({ conversation });
  });

  router.post('/agent/chat', async (req: Request, res: Response) => {
    const content =
      typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const conversationId =
      typeof req.body?.conversationId === 'string'
        ? req.body.conversationId.trim()
        : undefined;
    const uiLanguage: AppLanguage =
      req.body?.uiLanguage === 'fa' ? 'fa' : 'en';
    const clientHistory = Array.isArray(req.body?.history)
      ? (req.body.history as ChatMessage[])
      : undefined;
    const workspaceContext =
      req.body?.workspaceContext && typeof req.body.workspaceContext === 'object'
        ? (req.body.workspaceContext as Partial<WorkspaceSnapshot>)
        : undefined;
    const computerFsContext =
      req.body?.computerFsContext && typeof req.body.computerFsContext === 'object'
        ? (req.body.computerFsContext as ComputerFsContext)
        : undefined;
    const attachments = Array.isArray(req.body?.attachments)
      ? (req.body.attachments as ChatAttachment[])
      : undefined;

    if (!content) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Message content cannot be empty.',
        },
      });
      return;
    }

    try {
      const result = await orchestrator.handleUserMessage({
        userId: DEFAULT_LOCAL_USER_ID,
        conversationId,
        content,
        uiLanguage,
        clientHistory,
        workspaceContext,
        computerFsContext,
        attachments,
      });

      res.json(result);
    } catch (error) {
      if (
        error instanceof GeminiConfigurationError ||
        error instanceof GeminiUpstreamError
      ) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Unexpected server error.';
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      });
    }
  });

  router.post('/agent/chat/tool-results', async (req: Request, res: Response) => {
    const pendingSessionId =
      typeof req.body?.pendingSessionId === 'string'
        ? req.body.pendingSessionId.trim()
        : '';
    const toolResults = Array.isArray(req.body?.toolResults)
      ? (req.body.toolResults as ClientToolResult[])
      : [];

    if (!pendingSessionId) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'pendingSessionId is required.',
        },
      });
      return;
    }

    try {
      const result = await orchestrator.submitClientToolResults({
        userId: DEFAULT_LOCAL_USER_ID,
        pendingSessionId,
        toolResults,
      });

      res.json(result);
    } catch (error) {
      if (
        error instanceof GeminiConfigurationError ||
        error instanceof GeminiUpstreamError
      ) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Unexpected server error.';
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      });
    }
  });

  router.post('/agent/email-summary', async (req: Request, res: Response) => {
    const language: AppLanguage = req.body?.language === 'fa' ? 'fa' : 'en';
    const accountEmail =
      typeof req.body?.accountEmail === 'string'
        ? req.body.accountEmail.trim().slice(0, 320)
        : undefined;
    const rawEmails = Array.isArray(req.body?.emails)
      ? (req.body.emails as EmailSummaryInputItem[])
      : [];

    try {
      const result = await summarizeImportantEmails({
        emails: rawEmails,
        language,
        accountEmail,
      });
      res.json({
        ...result,
        totalScanned: rawEmails.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (
        error instanceof GeminiConfigurationError ||
        error instanceof GeminiUpstreamError
      ) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Unexpected server error.';
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      });
    }
  });

  return router;
}
