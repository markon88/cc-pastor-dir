import { json, startSend } from '../../../../_lib/messages.js';

const DEFAULTS_KEY = 'messages_last_sender';

// POST → start sending. Only 'sender' role (or admins). The client then
// polls ./status until the broadcast goes out.
export async function onRequestPost({ env, params, data }) {
  if (data.messagesRole !== 'sender') return json({ error: 'You don’t have permission to send messages.' }, 403);

  const c = await env.DB.prepare('SELECT * FROM message_campaigns WHERE id = ?').bind(Number(params.id)).first();
  if (!c) return json({ error: 'Not found' }, 404);
  if (!c.subject.trim() || !c.body.trim()) return json({ error: 'Add a subject and a message before sending.' }, 400);

  try {
    await startSend(env, c, data.user.email);
  } catch (err) {
    return json({ error: err.message }, 400);
  }

  // Remember From / Reply-to to prefill the next draft.
  await env.DB.prepare(`
    INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(DEFAULTS_KEY, JSON.stringify({ from_name: c.from_name, header: c.header, reply_to: c.reply_to }), data.user.email).run();

  return json({ ok: true, status: 'importing' });
}
