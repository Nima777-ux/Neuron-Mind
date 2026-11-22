# Security Specification — Neuron Mind

## 1. Data Invariants
1. Every top-level user resource (`tasks`, `events`, `documents`, `memories`, `automations`, `conversations`) MUST carry `ownerId == request.auth.uid`.
2. Users MUST be authenticated and email-verified (`request.auth != null && request.auth.token.email_verified == true`) for all reads and writes.
3. Every subcollection (`/conversations/{conversationId}/messages/{messageId}`) MUST verify ownership via `get()` on its parent `/conversations/{conversationId}` document.
4. User PII (`email`) is strictly isolated in `/users/{userId}/private/{docId}` and never readable or listable by any other user.
5. `ownerId`, `id`, and `createdAt` are immutable once created. `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
6. Every document ID must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Shadow field on task create**: `{ id: 't1', ownerId: uid, title: 'Test', sourceLanguage: 'en', status: 'todo', priority: 'high', isAdmin: true, createdAt: serverTimestamp, updatedAt: serverTimestamp }` -> DENIED (`hasOnly` rejects `isAdmin`).
2. **Identity spoofing on task create**: `ownerId: 'other-user-uid'` -> DENIED (`ownerId == request.auth.uid`).
3. **Unverified email write**: `request.auth.token.email_verified == false` -> DENIED.
4. **Oversized ID poisoning**: `taskId = 'a'.repeat(500)` -> DENIED (`isValidId`).
5. **Invalid characters in ID**: `taskId = '../admin'` -> DENIED (`isValidId`).
6. **Client-forged createdAt timestamp**: `createdAt: '2020-01-01T00:00:00Z'` -> DENIED (`createdAt == request.time`).
7. **Mutating ownerId on update**: `ownerId: 'attacker'` -> DENIED (`incoming().ownerId == existing().ownerId`).
8. **Mutating createdAt on update**: `createdAt: request.time` -> DENIED (`incoming().createdAt == existing().createdAt`).
9. **Blanket list query without owner filter**: `getDocs(collection(db, 'tasks'))` as non-owner -> DENIED (`resource.data.ownerId == request.auth.uid`).
10. **Writing message into another user's conversation**: parent `/conversations/{cid}` owned by `victim` -> DENIED (`get()` Master Gate).
11. **Oversized task title (>300 chars)**: `title: 'x'.repeat(301)` -> DENIED (`title.size() <= 300`).
12. **Reading another user's PII**: `get(/users/victim/private/profile)` -> DENIED (`request.auth.uid == userId`).
