"""Post one Discord message per push: commits, files touched, what stayed.

Runs inside GitHub Actions. Reads the push event, asks the GitHub API for
the compare and the tree, posts one embed to the channel webhook.
Env: GH_TOKEN, DISCORD_WEBHOOK, GITHUB_REPOSITORY, GITHUB_EVENT_PATH,
GITHUB_EVENT_NAME, GITHUB_REF_NAME, GITHUB_SHA, DRY_RUN (print, no post).
Self-check: python notify.py --selftest
"""
import json
import os
import sys
import urllib.request

API = "https://api.github.com"
ZERO_SHA = "0" * 40
ROWS_PER_FIELD = 15
FIELD_CHARS = 1024
DESCRIPTION_CHARS = 4096
STATUS_FIELDS = (
    ("Added", ("added", "copied")),
    ("Modified", ("modified", "changed", "renamed")),
    ("Removed", ("removed",)),
)


def gh(path):
    headers = {
        "Authorization": "Bearer " + os.environ["GH_TOKEN"],
        "Accept": "application/vnd.github+json",
        "User-Agent": "scammersurvivor-discord-updates",
    }
    with urllib.request.urlopen(urllib.request.Request(API + path, headers=headers)) as resp:
        return json.load(resp)


def push_range(repo, event, event_name):
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
    return before, after, branch, who


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


def build_embed(branch, who, commits, files, stayed_line, compare_url):
    subjects = [f"{c['sha'][:7]} {c['commit']['message'].splitlines()[0]}" for c in commits]
    n = len(commits)
    fields = []
    for label, statuses in STATUS_FIELDS:
        rows = [f"{f['filename']} (+{f['additions']} -{f['deletions']})" for f in files if f["status"] in statuses]
        if rows:
            fields.append({"name": f"{label} ({len(rows)})", "value": clip(rows)})
    fields.append({"name": "Stayed", "value": stayed_line})
    return {
        "title": f"{branch}: {n} commit{'s' if n != 1 else ''} by {who}"[:256],
        "description": clip(subjects, cap=20, chars=DESCRIPTION_CHARS) or "(no commits in range)",
        "url": compare_url,
        "fields": fields,
        "footer": {"text": compare_url},
    }


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
    before, after, branch, who = push_range(repo, event, os.environ.get("GITHUB_EVENT_NAME", "push"))
    cmp = gh(f"/repos/{repo}/compare/{before}...{after}")
    files = cmp.get("files", [])
    embed = build_embed(branch, who, cmp["commits"], files, stayed(repo, after, [f["filename"] for f in files]), cmp["html_url"])
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
    calls = []
    global gh
    real = gh
    gh = lambda path: calls.append(path) or {"default_branch": "main"}
    try:
        assert push_range("o/r", {"before": ZERO_SHA, "after": "abc", "ref": "refs/heads/feat/x", "pusher": {"name": "j"}}, "push") == ("main", "abc", "feat/x", "j")
        assert calls == ["/repos/o/r"]
    finally:
        gh = real
    embed = build_embed("main", "j", [{"sha": "abcdef0123", "commit": {"message": "feat: x\n\nbody"}}],
                        [{"filename": "a.py", "status": "added", "additions": 3, "deletions": 0}], "1 of 2 files untouched", "u")
    assert embed["title"] == "main: 1 commit by j" and embed["description"] == "abcdef0 feat: x"
    assert [f["name"] for f in embed["fields"]] == ["Added (1)", "Stayed"]
    print("notify ok")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else main()
