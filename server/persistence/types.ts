import type { ChatMessage, Conversation } from '../core/types.ts';

export interface ConversationStore {
  listConversations(userId: string): Promise<Conversation[]>;
  getConversation(userId: string, conversationId: string): Promise<Conversation | undefined>;
  createConversation(userId: string, title?: string): Promise<Conversation>;
  appendMessage(
    userId: string,
    conversationId: string,
    message: Omit<ChatMessage, 'id' | 'conversationId' | 'createdAt'>
  ): Promise<ChatMessage>;
}

export const PLANNED_FIRESTORE_COLLECTIONS = [
  'users',
  'conversations',
  'messages',
  'tasks',
  'memories',
  'automations',
] as const;
