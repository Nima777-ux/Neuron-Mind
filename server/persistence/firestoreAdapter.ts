import type { ChatMessage, Conversation } from '../core/types.ts';
import type { ConversationStore } from './types.ts';

/**
 * Architectural adapter boundary for Cloud Firestore persistence.
 * Implement against Firebase Admin / Firestore once Firebase is provisioned.
 */
export class FirestoreConversationStore implements ConversationStore {
  private readonly projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  getProjectId(): string {
    return this.projectId;
  }

  async listConversations(_userId: string): Promise<Conversation[]> {
    throw new Error('Firestore persistence is not provisioned yet.');
  }

  async getConversation(
    _userId: string,
    _conversationId: string
  ): Promise<Conversation | undefined> {
    throw new Error('Firestore persistence is not provisioned yet.');
  }

  async createConversation(_userId: string, _title?: string): Promise<Conversation> {
    throw new Error('Firestore persistence is not provisioned yet.');
  }

  async appendMessage(
    _userId: string,
    _conversationId: string,
    _message: Omit<ChatMessage, 'id' | 'conversationId' | 'createdAt'>
  ): Promise<ChatMessage> {
    throw new Error('Firestore persistence is not provisioned yet.');
  }
}
