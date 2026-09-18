-- AMA group assignment was pastor-based (pastor_ama_groups), so it went stale
-- whenever a pastor moved, retired, or was replaced — the new pastor at that
-- church started with no AMA group, and the departed pastor's row stuck
-- around pointing nowhere useful. Moving the assignment onto the church
-- means it survives a pastor change automatically.
CREATE TABLE IF NOT EXISTS church_ama_groups (
  church_org_code TEXT PRIMARY KEY,
  group_id        TEXT NOT NULL
);

-- Backfill from today's pastor_ama_groups: for every church whose current
-- pastor(s) agree on a single AMA group, carry that group over to the
-- church. Churches with no currently-linked pastor are left unassigned.
INSERT OR IGNORE INTO church_ama_groups (church_org_code, group_id)
SELECT pc.church_org_code, pag.group_id
FROM pastor_churches pc
JOIN pastor_ama_groups pag ON pag.pastor_id = pc.pastor_id
GROUP BY pc.church_org_code;
