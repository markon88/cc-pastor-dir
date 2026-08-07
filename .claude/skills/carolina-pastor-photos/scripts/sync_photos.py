import json, os, re, subprocess, sys, tempfile, urllib.request

"""
Diffs a freshly-scraped pastor-photos listing (JSON produced by the browser
extraction step in SKILL.md) against pastor-photos/manifest.json, downloads
new/changed full-res photos, matches each name against the live pastors
table in D1, generates a 200x200 center-cropped thumbnail, uploads both
variants to the PASTOR_PHOTOS R2 bucket, and sets pastors.photo_url.

Matches that aren't confident (score < 2, or a name that isn't in the
pastors table at all) are downloaded but left unmatched in the manifest —
R2/D1 are never touched for those. Report them to Mark for manual
resolution rather than guessing.

Usage: sync_photos.py <path-to-fresh-scrape.json> <photos-dir>
"""

D1_DB = "cc-pastor-dir-auth"
R2_BUCKET = "cc-pastor-dir-pastor-photos"

# Common nickname -> formal-name equivalents seen in the Carolina Conference
# roster. Not exhaustive — anything not covered here just falls through to
# manual review, which is the safe default for a face-matching task.
NICKNAMES = {
    "jeff": "jeffrey", "art": "arthur", "rob": "roberto", "rich": "richard",
    "eddie": "eduardo", "phil": "phillip", "rod": "rodrick", "ben": "benjamin",
    "tim": "timothy", "vic": "victor", "henri": "henrique", "chuck": "charles",
}

def sanitize(name):
    return re.sub(r'[\/:*?"<>|]', '', name.strip())

def norm(s):
    s = s.lower()
    s = re.sub(r'[,.]', '', s)
    s = re.sub(r'\b(jr|sr|dmin|phd|dr|ii|iii)\b', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def tokens(s):
    toks = norm(s).split()
    expanded = set(toks)
    for t in toks:
        if t in NICKNAMES:
            expanded.add(NICKNAMES[t])
    return expanded

def load_manifest(photos_dir):
    path = os.path.join(photos_dir, "manifest.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return []

def fetch_pastors():
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", D1_DB, "--remote",
         "--command", "SELECT id, display_name FROM pastors WHERE active = 1", "--json"],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)[0]["results"]

def match_pastor(name, pastors):
    ftoks = tokens(name)
    best, best_score = None, 0
    for p in pastors:
        score = len(ftoks & tokens(p["display_name"]))
        if score > best_score:
            best, best_score = p, score
    return (best, best_score) if best_score >= 2 else (None, best_score)

def make_thumbnail(src_path, dest_path):
    result = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", src_path],
                             capture_output=True, text=True, check=True)
    w = h = None
    for line in result.stdout.splitlines():
        line = line.strip()
        if line.startswith("pixelWidth:"): w = int(line.split(":")[1])
        if line.startswith("pixelHeight:"): h = int(line.split(":")[1])
    side = min(w, h)
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        cropped = tmp.name
    subprocess.run(["sips", "-s", "format", "jpeg", "-c", str(side), str(side), src_path, "--out", cropped],
                    capture_output=True, text=True, check=True)
    subprocess.run(["sips", "-Z", "200", cropped, "--out", dest_path],
                    capture_output=True, text=True, check=True)
    os.remove(cropped)

def upload_and_link(pastor_id, full_path, thumb_path, ext):
    ctype = "image/png" if ext.lower() == "png" else "image/jpeg"
    subprocess.run(
        ["npx", "wrangler", "r2", "object", "put", f"{R2_BUCKET}/pastors/{pastor_id}/thumb.jpg",
         "--file", thumb_path, "--content-type", "image/jpeg", "--remote"],
        capture_output=True, text=True, check=True,
    )
    subprocess.run(
        ["npx", "wrangler", "r2", "object", "put", f"{R2_BUCKET}/pastors/{pastor_id}/full.jpg",
         "--file", full_path, "--content-type", ctype, "--remote"],
        capture_output=True, text=True, check=True,
    )
    url = f"/api/pastor-photo?id={pastor_id}"
    subprocess.run(
        ["npx", "wrangler", "d1", "execute", D1_DB, "--remote",
         "--command", f"UPDATE pastors SET photo_url = '{url}' WHERE id = '{pastor_id}'"],
        capture_output=True, text=True, check=True,
    )

def main():
    fresh_path, photos_dir = sys.argv[1], sys.argv[2]
    with open(fresh_path) as f:
        fresh_cards = json.load(f)

    manifest = load_manifest(photos_dir)
    by_name = {m["name"]: m for m in manifest}
    pastors = fetch_pastors()

    newly_matched, updated, newly_unmatched, still_unmatched, unchanged = [], [], [], [], []

    for c in fresh_cards:
        name = sanitize(c["nearbyText"].split(" | ")[0])
        role = c["nearbyText"]
        url = c["fullRes"]
        ext = os.path.splitext(url)[1].lstrip(".") or "jpg"
        filename = f"{name}.{ext}"
        full_path = os.path.join(photos_dir, filename)
        existing = by_name.get(name)

        source_changed = existing is None or existing.get("sourceUrl") != url
        if not source_changed:
            if existing.get("pastor_id"):
                unchanged.append(name)
            else:
                still_unmatched.append(name)
            continue

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as resp, open(full_path, "wb") as out:
                out.write(resp.read())
        except Exception as e:
            print(f"DOWNLOAD FAILED  {name}: {e}")
            continue

        pastor_id = existing.get("pastor_id") if existing else None
        if pastor_id is None:
            pastor, score = match_pastor(name, pastors)
            pastor_id = pastor["id"] if pastor else None

        record = {"name": name, "file": filename, "sourceUrl": url, "role": role, "pastor_id": pastor_id}
        by_name[name] = record

        if pastor_id is None:
            newly_unmatched.append(name)
            print(f"DOWNLOADED, UNMATCHED  {filename}")
            continue

        thumb_path = os.path.join(photos_dir, "thumbs", f"{pastor_id}.jpg")
        os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
        make_thumbnail(full_path, thumb_path)
        upload_and_link(pastor_id, full_path, thumb_path, ext)

        (updated if existing else newly_matched).append((name, pastor_id))
        print(f"SYNCED  {name} -> {pastor_id}")

    with open(os.path.join(photos_dir, "manifest.json"), "w") as f:
        json.dump(list(by_name.values()), f, indent=2)

    print(f"\nNew matches: {len(newly_matched)}  Updated photos: {len(updated)}  "
          f"Unchanged: {len(unchanged)}  Unmatched (needs review): {len(newly_unmatched) + len(still_unmatched)}")
    if newly_matched:
        print("New:", ", ".join(f"{n} ({pid})" for n, pid in newly_matched))
    if updated:
        print("Updated:", ", ".join(f"{n} ({pid})" for n, pid in updated))
    if newly_unmatched or still_unmatched:
        print("Needs manual matching:", ", ".join(newly_unmatched + still_unmatched))

if __name__ == "__main__":
    main()
