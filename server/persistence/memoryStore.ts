import crypto from 'node:crypto';
import type { ChatMessage, Conversation } from '../core/types.ts';
import type { ConversationStore } from './types.ts';

export class InMemoryConversationStore implements ConversationStore {
  private readonly userConversations: Map<string, Map<string, Conversation>>;

  constructor() {
    this.userConversations = new Map<string, Map<string, Conversation>>();
  }

  private getBucket(userId: string): Map<string, Conversation> {
    let bucket = this.userConversations.get(userId);
    if (!bucket) {
      bucket = new Map<string, Conversation>();
      this.userConversations.set(userId, bucket);
    }
    return bucket;
  }

  async listConversations(userId: string): Promise<Conversation[]> {
    const bucket = this.getBucket(userId);
    return Array.from(bucket.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  async getConversation(
    userId: string,
    conversationId: string
  ): Promise<Conversation | undefined> {
    return this.getBucket(userId).get(conversationId);
  }

  async createConversation(userId: string, title = 'New conversation'): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    this.getBucket(userId).set(conversation.id, conversation);
    return conversation;
  }

  async appendMessage(
    userId: string,
    conversationId: string,
    input: Omit<ChatMessage, 'id' | 'conversationId' | 'createdAt'>
  ): Promise<ChatMessage> {
    const bucket = this.getBucket(userId);
    let conversation = bucket.get(conversationId);
    if (!conversation) {
      conversation = await this.createConversation(userId);
    }

    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      role: input.role,
      content: input.content,
      createdAt: now,
      ...(input.language ? { language: input.language } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.toolActions && input.toolActions.length > 0
        ? { toolActions: input.toolActions }
        : {}),
      ...(input.attachmentNames && input.attachmentNames.length > 0
        ? { attachmentNames: input.attachmentNames }
        : {}),
    };

    conversation.messages.push(message);
    conversation.updatedAt = now;

    if (
      conversation.messages.length === 1 &&
      input.role === 'user' &&
      conversation.title === 'New conversation'
    ) {
      const trimmed = input.content.trim().replace(/\s+/g, ' ');
      conversation.title =
        trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed || 'New conversation';
    }

    return message;
  }
}
