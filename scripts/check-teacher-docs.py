#!/usr/bin/env python3
"""Validate local Markdown links in the maintained teacher-facing docs (stdlib only)."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
DOCS = (
    "README.md", "CONTRIBUTING.md", "RUN_LOCAL_CORE.md",
    "frontend-next/README.md", "docs/README.md", "docs/FEATURE_STATUS.md",
    "docs/ARCHITECTURE.md", "docs/COURSE_DEMO.md",
    "docs/engineering/OLA_MIGRATION_ACCEPTANCE_20261110.md",
    "docs/engineering/BRANCH_MAINTENANCE_20261110.md",
)
LINK = re.compile(r"\]\(([^)]+)\)")


def validate() -> list[str]:
    failures: list[str] = []
    for item in DOCS:
        file = ROOT / item
        if not file.is_file():
            failures.append(f"Missing maintained documentation: {item}")
            continue
        content = file.read_text(encoding="utf-8")
        for destination in LINK.findall(content):
            if destination.startswith(("http://", "https://", "mailto:", "#")):
                continue
            # Accept Markdown title syntax without attempting to crawl external sites.
            relative = unquote(destination.split("#", 1)[0].strip())
            if not relative:
                continue
            target = file.parent / relative
            if not target.exists():
                failures.append(f"{item}: broken relative link -> {destination}")
    return failures


if __name__ == "__main__":
    problems = validate()
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        sys.exit(1)
    print(f"Teacher documentation link check passed ({len(DOCS)} maintained files).")
