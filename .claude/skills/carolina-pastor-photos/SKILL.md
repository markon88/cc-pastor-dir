---
name: carolina-pastor-photos
description: Check the Carolina Conference pastor-photos page for new or updated pastor headshots and sync them into pastor-photos/ in this repo, matched by name. Use when Mark asks to update, sync, refresh, or check for new pastor photos.
---

# Carolina Pastor Photos Sync

The Carolina Conference ministerial page (`https://www.carolinasda.org/pastor-photos`)
is a Wix site sitting behind a shared site-wide password. It lists every pastor in
the conference with a headshot and their assigned church(es). This skill re-scrapes
that page, compares it to the local manifest at `pastor-photos/manifest.json`, and
downloads only what's new or changed — matched by pastor name, not by image URL
(Wix assigns each upload a random content hash, so URLs can't be predicted or
constructed ahead of time; the page itself must be re-read every time).

## Steps

1. **Open the page in the browser** using the claude-in-chrome tools
   (`tabs_context_mcp` → `tabs_create_mcp` → `navigate` to the URL above).

2. **Check for the password gate.** Take a screenshot. If it shows a password
   field instead of the pastor grid, the browser session has expired:
   - Tell Mark the page is asking for the password again.
   - Ask him to type it directly into the browser page himself (never accept
     the password as chat text, never type it into the page on his behalf).
   - Wait for his confirmation, then screenshot again to confirm the gallery
     is now showing before continuing.

3. **Scroll the full page** (in ~500px steps with short pauses) so any
   lazy-loaded images finish loading before extraction.

4. **Extract name/photo pairs** by running this in `javascript_tool` against
   the tab:

   ```js
   window.__pastorCards = [];
   document.querySelectorAll('img').forEach(img => {
     if (img.naturalWidth < 80 || img.naturalHeight < 80) return;
     let container = img.closest('div');
     let text = '';
     for (let i = 0; i < 4 && container; i++) {
       text = container.innerText.trim();
       if (text.length > 0 && text.length < 200) break;
       container = container.parentElement;
     }
     const fullRes = img.src.replace(/\/v1\/fill\/.*$/, '');
     window.__pastorCards.push({ fullRes, alt: img.alt, nearbyText: text.replace(/\n+/g, ' | ') });
   });
   window.__pastorCards.length;
   ```

5. **Save the extraction as a JSON file** via a blob download (avoids
   truncation on large text output):

   ```js
   const blob = new Blob([JSON.stringify(window.__pastorCards, null, 2)], { type: 'application/json' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = 'pastor-photos-scrape.json';
   document.body.appendChild(a);
   a.click();
   a.remove();
   ```

   This lands in `~/Downloads/pastor-photos-scrape.json`.

6. **Run the sync script**:

   ```bash
   python3 .claude/skills/carolina-pastor-photos/scripts/sync_photos.py \
     ~/Downloads/pastor-photos-scrape.json \
     pastor-photos
   ```

   For each entry on the page, this diffs against `pastor-photos/manifest.json`
   by name and, for anything new or whose source URL changed:
   - downloads the full-res photo into `pastor-photos/`
   - matches the name against the live `pastors` table in D1 (exact token
     match, plus a small nickname table for things like Jeff/Jeffrey,
     Art/Arthur, Rob/Roberto — anything it can't match confidently is left
     unmatched rather than guessed)
   - for confident matches: generates a 200x200 center-cropped thumbnail
     with `sips`, uploads both `thumb.jpg` and `full.jpg` to the
     `PASTOR_PHOTOS` R2 bucket under `pastors/<id>/`, and sets that pastor's
     `photo_url` in D1 to `/api/pastor-photo?id=<id>`
   - updates `pastor-photos/manifest.json` either way

   Names present in the manifest but no longer on the page are left alone —
   report them to Mark rather than deleting anything or touching their
   existing `photo_url`.

7. **Delete the temp scrape file** (`~/Downloads/pastor-photos-scrape.json`)
   and close the browser tab.

8. **Report results**: which pastors got a new/updated photo synced live,
   and — importantly — anything the script couldn't confidently match to a
   pastor record (new hires, name spelled very differently than the roster,
   etc.). Those need Mark to resolve the pastor_id manually before a photo
   goes live for them. Also flag anything that looks like a placeholder
   (e.g. an "Open" position reusing another pastor's headshot) rather than
   importing it as a real photo.

## Notes

- Never store the site password anywhere — it's entered by Mark directly
  into the browser each time the session lapses.
- `pastor-photos/manifest.json` is the source of truth for what's already
  been imported (including each entry's matched `pastor_id`); don't
  regenerate it from scratch unless Mark asks for a full re-sync.
- R2 uploads and the `photo_url` D1 update happen immediately for confident
  matches — there's no separate "apply" step. Double-check matches before
  running this on a page with ambiguous new names.
