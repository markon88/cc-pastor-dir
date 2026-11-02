import { getMessagesRole, json } from '../../_lib/messages.js';

// Every /api/messages/* route requires the Messages role (or ADMIN_EMAILS).
// Handlers read context.data.messagesRole ('sender' | 'editor').
export async function onRequest(context) {
  const role = await getMessagesRole(context.data.user?.email, context.env);
  if (!role) return json({ error: 'Forbidden' }, 403);
  context.data.messagesRole = role;
  return context.next();
}
