"""Post one Discord message per push or pull request: what changed, what stayed.

Runs inside GitHub Actions. Reads the event, asks the GitHub API for the
compare and the tree, optionally asks Claude for a short plain summary,
posts one embed to the channel webhook.
Env: GH_TOKEN, DISCORD_WEBHOOK, ANTHROPIC_API_KEY (optional), GITHUB_REPOSITORY,
GITHUB_EVENT_PATH, GITHUB_EVENT_NAME, GITHUB_REF_NAME, GITHUB_SHA, DRY_RUN.
Self-check: python notify.py --selftest
"""
import json
import os
import sys
import urllib.error
import urllib.request

API = "https://api.github.com"
ZERO_SHA = "0" * 40
ROWS_PER_FIELD = 15
FIELD_CHARS = 1024
DESCRIPTION_CHARS = 4096
FILES_PER_PAGE = 100
MAX_PAGES = 30
STATUS_FIELDS = (
    ("Added", ("added", "copied")),
    ("Modified", ("modified", "changed", "renamed")),
    ("Removed", ("removed",)),
)
CLAUDE_MODEL = "claude-sonnet-5-5"
PATCH_BUDGET = 40_000
SUMMARY_SYSTEM = (
    "You summarise one git push for a small hackathon team reading Discord. "
    "Write two to four short plain sentences: what changed and what stayed the same. "
    "Name files or features, not line counts. No bullet points, no preamble, no hype words, "
    "no em dashes. Say 'not sure' instead of guessing at intent."
)


def gh(path):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "scammersurvivor-discord-updates"}
    if os.environ.get("GH_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GH_TOKEN"]
    with urllib.request.urlopen(urllib.request.Request(API + path, headers=headers)) as resp:
        return json.load(resp)


def push_range(repo, event, event_name):
    """Return (before, after, label, who, link) for the event."""
    if event_name == "pull_request":
        pr = event["pull_request"]
        verb = "merged" if pr.get("merged") else event["action"]
        label = f"PR #{pr['number']} {verb}: {pr['title']}"
        return pr["base"]["sha"], pr["head"]["sha"], label, pr["user"]["login"], pr["html_url"]
    if event_name == "push":
        before, after = event["before"], event["after"]
        branch = event["ref"].split("/", 2)[-1]
        who = event["pusher"]["name"]
    else:
        # workflow_dispatch has no before/after: the ref head and its parent
        after = os.environ["GITHUB_SHA"]
        branch = os.environ["GITHUB_REF_NAME"]
        before = gh(f"/repos/{repo}/commits/{after}")["parents"][0]["sha"]
        who = event["sender"]["login"]
    if before == ZERO_SHA:
        # new branch: compare against the default branch instead
        before = gh(f"/repos/{repo}")["default_branch"]
    return before, after, branch, who, None


def compare(repo, before, after):
    """Commits and every changed file; the API caps one page at 300 files."""
    first = gh(f"/repos/{repo}/compare/{before}...{after}?per_page={FILES_PER_PAGE}&page=1")
    files = list(first.get("files", []))
    page = 2
    while len(first.get("files", [])) == FILES_PER_PAGE and page <= MAX_PAGES:
        more = gh(f"/repos/{repo}/compare/{before}...{after}?per_page={FILES_PER_PAGE}&page={page}").get("files", [])
        files.extend(more)
        if len(more) < FILES_PER_PAGE:
            break
        page += 1
    seen, unique = set(), []
    for f in files:
        if f["filename"] not in seen:
            seen.add(f["filename"])
            unique.append(f)
    return first["commits"], unique, first["html_url"]


def clip(rows, cap=ROWS_PER_FIELD, chars=FIELD_CHARS):
    if len(rows) > cap:
        rows = rows[:cap] + [f"+{len(rows) - cap} more"]
    return "\n".join(rows)[:chars]


def stayed(repo, after, changed_paths):
    blobs = [t["path"] for t in gh(f"/repos/{repo}/git/trees/{after}?recursive=1")["tree"] if t["type"] == "blob"]
    top = lambda paths: {p.split("/")[0] for p in paths if "/" in p}
    quiet_dirs = sorted(top(blobs) - top(changed_paths))
    untouched = len(blobs) - len([p for p in changed_paths if p in blobs])
    line = f"{untouched} of {len(blobs)} files untouched"
    if quiet_dirs:
        line += " (" + ", ".join(d + "/" for d in quiet_dirs) + ")"
    return line


def summarise(commits, files):
    """Short plain summary from Claude, or None when no key or the call fails."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    parts = ["Commit messages:"] + [c["commit"]["message"].strip() for c in commits] + ["", "Files:"]
    budget = PATCH_BUDGET
    for f in files:
        parts.append(f"{f['status']} {f['filename']} (+{f['additions']} -{f['deletions']})")
        patch = f.get("patch", "")
        if patch and budget > 0:
            parts.append(patch[:budget])
            budget -= len(patch)
    body = json.dumps({
        "model": CLAUDE_MODEL, "max_tokens": 300, "system": SUMMARY_SYSTEM,
        "messages": [{"role": "user", "content": "\n".join(parts)}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body, method="POST",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = "".join(b.get("text", "") for b in json.load(resp)["content"])
    except (urllib.error.URLError, KeyError, ValueError) as err:
        print("summary skipped:", err.__class__.__name__, getattr(err, "code", ""))
        return None
    return text.replace("—", ",").replace("–", ",").strip() or None


def build_embed(label, who, commits, files, stayed_line, link, summary=None):
    subjects = [f"{c['sha'][:7]} {c['commit']['message'].splitlines()[0]}" for c in commits]
    n = len(commits)
    title = label if label.startswith("PR #") else f"{label}: {n} commit{'s' if n != 1 else ''} by {who}"
    description = clip(subjects, cap=20, chars=DESCRIPTION_CHARS) or "(no commits in range)"
    if summary:
        description = (summary + "\n\n" + description)[:DESCRIPTION_CHARS]
    fields = []
    for name, statuses in STATUS_FIELDS:
        rows = [f"{f['filename']} (+{f['additions']} -{f['deletions']})" for f in files if f["status"] in statuses]
        if rows:
            fields.append({"name": f"{name} ({len(rows)})", "value": clip(rows)})
    fields.append({"name": "Stayed", "value": stayed_line})
    if label.startswith("PR #"):
        fields.insert(0, {"name": "By", "value": who})
    return {"title": title[:256], "description": description, "url": link, "fields": fields, "footer": {"text": link}}


def post(webhook, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        webhook + "?wait=true", data=body, method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "scammersurvivor-discord-updates"},
    )
    with urllib.request.urlopen(req) as resp:
        print("discord", resp.status)


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as fh:
        event = json.load(fh)
    before, after, label, who, link = push_range(repo, event, os.environ.get("GITHUB_EVENT_NAME", "push"))
    commits, files, compare_url = compare(repo, before, after)
    stayed_line = stayed(repo, after, [f["filename"] for f in files])
    embed = build_embed(label, who, commits, files, stayed_line, link or compare_url, summarise(commits, files))
    payload = {"embeds": [embed]}
    if os.environ.get("DRY_RUN"):
        print(json.dumps(payload, indent=1))
        return
    webhook = os.environ.get("DISCORD_WEBHOOK", "")
    if not webhook:
        print("DISCORD_WEBHOOK not set, nothing posted")
        return
    post(webhook, payload)


def selftest():
    text = clip([f"row{i}" for i in range(20)])
    assert text.endswith("+5 more") and text.count("\n") == 15, text
    assert len(clip(["x" * 2000])) == FIELD_CHARS
    global gh
    real = gh
    calls = []
    gh = lambda path: calls.append(path) or {"default_branch": "main"}
    try:
        got = push_range("o/r", {"before": ZERO_SHA, "after": "abc", "ref": "refs/heads/feat/x", "pusher": {"name": "j"}}, "push")
        assert got == ("main", "abc", "feat/x", "j", None), got
        assert calls == ["/repos/o/r"]
        pr = {"action": "closed", "pull_request": {"number": 7, "title": "lock screen", "merged": True, "user": {"login": "ana"},
                                                     "base": {"sha": "b"}, "head": {"sha": "h"}, "html_url": "u"}}
        assert push_range("o/r", pr, "pull_request") == ("b", "h", "PR #7 merged: lock screen", "ana", "u")
        # pagination: two full pages then a short one, duplicates dropped
        pages = {1: [{"filename": f"a{i}"} for i in range(FILES_PER_PAGE)],
                 2: [{"filename": f"b{i}"} for i in range(FILES_PER_PAGE)],
                 3: [{"filename": "a0"}, {"filename": "c0"}]}
        gh = lambda path: {"commits": [], "html_url": "u", "files": pages[int(path.rsplit("page=", 1)[1])]}
        _, files, _ = compare("o/r", "x", "y")
        assert len(files) == 2 * FILES_PER_PAGE + 1, len(files)
    finally:
        gh = real
    embed = build_embed("main", "j", [{"sha": "abcdef0123", "commit": {"message": "feat: x\n\nbody"}}],
                        [{"filename": "a.py", "status": "added", "additions": 3, "deletions": 0}], "1 of 2 files untouched", "u",
                        summary="Adds a.py. Nothing else moved.")
    assert embed["title"] == "main: 1 commit by j" and embed["description"] == "Adds a.py. Nothing else moved.\n\nabcdef0 feat: x"
    assert [f["name"] for f in embed["fields"]] == ["Added (1)", "Stayed"]
    pr_embed = build_embed("PR #7 merged: lock screen", "ana", [], [], "all untouched", "u")
    assert pr_embed["title"] == "PR #7 merged: lock screen" and pr_embed["fields"][0] == {"name": "By", "value": "ana"}
    assert summarise([], []) is None  # no key set in the self-test
    print("notify ok")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else main()
