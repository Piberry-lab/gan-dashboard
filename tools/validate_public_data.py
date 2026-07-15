#!/usr/bin/env python3
"""Allowlist validator for public-data.json.

The public dashboard may only publish the fields validated here. Anything
else — unknown keys, free text, values outside the enums/ranges below —
fails validation, and the publisher refuses to ship the file.

This is an ALLOWLIST: fields not listed are rejected, not filtered.
"""
import json, re, sys

SCHEMA = "public-dashboard/v1"
GENERATED_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$")
ALIAS_RE = re.compile(r"^JOB-\d{2,3}$")
CAND_RE = re.compile(r"^CAND-[A-Z]$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

NOTE_ENUM = {"opt_in_progress", "scf_in_progress", "needs_review",
             "internal_review", "queued_capacity"}
TYPE_ENUM = {"molecule", "surface", "adsorption", "post"}
ACTIVE_STATUS = {"queued", "running"}
HIST_STATUS = {"completed", "failed"}
STAGE_ENUM = {"early", "mid", "late"}
RUNTIME_BUCKET_ENUM = {"lt1h", "1to4h", "4to12h", "gt12h"}
RELATION_ENUM = {"gt", "gte", "muchgt", "approx"}
SUMMARY_STATUS = {"internal_review", "published"}

# Defense in depth on top of the allowlist: raw fragments that must never
# appear anywhere in the serialized output.
FORBIDDEN_RE = re.compile(
    r"gs://|gsutil|pw\.out|qe-outputs|C:\\|/home/|AppData|scratchpad|"
    r"total energy|Bader|\beV\b|\bRy\b", re.IGNORECASE)

def fail(msg):
    print(f"INVALID: {msg}", file=sys.stderr)
    sys.exit(1)

def require_keys(obj, keys, where):
    if set(obj.keys()) != set(keys):
        fail(f"{where}: keys must be exactly {sorted(keys)}, "
             f"got {sorted(obj.keys())}")

def main(path):
    raw = open(path, encoding="utf-8").read()
    m = FORBIDDEN_RE.search(raw)
    if m:
        fail(f"forbidden fragment {m.group(0)!r} present in output")
    data = json.loads(raw)

    require_keys(data, ["schema", "generated", "active", "history", "summary"],
                 "top-level")
    if data["schema"] != SCHEMA:
        fail("schema mismatch")
    if not GENERATED_RE.match(data["generated"]):
        fail("generated must be ISO-8601 +09:00")

    seen = set()
    for i, a in enumerate(data["active"]):
        w = f"active[{i}]"
        # No exact progress/time: only a coarse stage category is allowed.
        require_keys(a, ["alias", "status", "stage", "note"], w)
        if not ALIAS_RE.match(a["alias"]):
            fail(f"{w}: bad alias")
        if a["alias"] in seen:
            fail(f"{w}: duplicate alias")
        seen.add(a["alias"])
        if a["status"] not in ACTIVE_STATUS:
            fail(f"{w}: bad status")
        if a["stage"] not in STAGE_ENUM:
            fail(f"{w}: bad stage")
        if a["note"] not in NOTE_ENUM:
            fail(f"{w}: bad note code")

    for i, h in enumerate(data["history"]):
        w = f"history[{i}]"
        # No exact runtime: only a coarse duration bucket is allowed.
        require_keys(h, ["alias", "status", "type", "runtime_bucket",
                         "finished_on"], w)
        if not ALIAS_RE.match(h["alias"]):
            fail(f"{w}: bad alias")
        if h["alias"] in seen:
            fail(f"{w}: duplicate alias")
        seen.add(h["alias"])
        if h["status"] not in HIST_STATUS:
            fail(f"{w}: bad status")
        if h["type"] not in TYPE_ENUM:
            fail(f"{w}: bad type")
        if h["runtime_bucket"] not in RUNTIME_BUCKET_ENUM:
            fail(f"{w}: bad runtime_bucket")
        if not DATE_RE.match(h["finished_on"]):
            fail(f"{w}: bad finished_on")

    s = data["summary"]
    require_keys(s, ["ranking", "relations", "pending", "status"], "summary")
    if not all(isinstance(c, str) and CAND_RE.match(c) for c in s["ranking"]):
        fail("summary.ranking: CAND-X ids only")
    if len(s["relations"]) != max(0, len(s["ranking"]) - 1) or \
            not all(r in RELATION_ENUM for r in s["relations"]):
        fail("summary.relations invalid")
    if not all(isinstance(c, str) and CAND_RE.match(c) for c in s["pending"]):
        fail("summary.pending: CAND-X ids only")
    if s["status"] not in SUMMARY_STATUS:
        fail("summary.status invalid")
    # Unpublished stability rankings must not appear in PUBLIC output.
    if s["status"] != "published" and (s["ranking"] or s["relations"]
                                       or s["pending"]):
        fail("summary: ranking/relations/pending must be empty unless published")

    print(f"OK: {path} valid "
          f"({len(data['active'])} active, {len(data['history'])} history)")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "public-data.json")
