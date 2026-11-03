#!/usr/bin/env python3
"""Measure local login and commute-search HTTP latency without printing secrets."""

from __future__ import annotations

import argparse
import getpass
import json
import math
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from urllib.parse import urlparse


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


LOCAL_OPENER = urllib.request.build_opener(NoRedirect)


def percentile(values: list[float], p: float) -> float:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(p * len(ordered)) - 1)]


def send(url: str, method: str, payload: dict | None, token: str | None, timeout: float) -> tuple[int, float, dict]:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload, separators=(",", ":")).encode()
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    started = time.perf_counter()
    try:
        with LOCAL_OPENER.open(request, timeout=timeout) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as error:
        raw = error.read()
        status = error.code
    elapsed_ms = (time.perf_counter() - started) * 1000
    try:
        parsed = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        parsed = {}
    return status, elapsed_ms, parsed if isinstance(parsed, dict) else {}


def nested(value: dict, path: str):
    for part in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def summarize(samples: list[tuple[int, float]]) -> dict:
    durations = [duration for _, duration in samples]
    return {
        "requests": len(samples),
        "status_counts": {str(status): sum(1 for code, _ in samples if code == status) for status in sorted({code for code, _ in samples})},
        "latency_ms": {
            "min": round(min(durations), 2),
            "median": round(statistics.median(durations), 2),
            "p90": round(percentile(durations, 0.90), 2),
            "p95": round(percentile(durations, 0.95), 2),
            "p99": round(percentile(durations, 0.99), 2),
            "max": round(max(durations), 2),
            "mean": round(statistics.mean(durations), 2),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:18080")
    parser.add_argument("--login-path", default="/api/login")
    parser.add_argument("--login-user-field", default="email")
    parser.add_argument("--login-password-field", default="password")
    parser.add_argument("--token-path", default="token", help="Dotted path in login JSON response, e.g. data.token")
    parser.add_argument("--search-path", default="/api/mobility/commute/rides")
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--direction", choices=("outbound", "return"), default="outbound")
    parser.add_argument("--vehicle-type", choices=("car", "bike", "both"), default="both")
    parser.add_argument("--pickup-choice", choices=("both", "DIRECT_RIDER_PICKUP", "ON_ROUTE_MEETING_POINT"), default="both")
    parser.add_argument("--warmup", type=int, default=1)
    parser.add_argument("--samples", type=int, default=4)
    parser.add_argument("--timeout", type=float, default=20)
    parser.add_argument("--revision", default="unknown", help="App source revision under measurement")
    parser.add_argument("--dataset", required=True, help="Short description of synthetic dataset and size")
    parser.add_argument("--output", type=Path, help="Optional JSON report file")
    parser.add_argument("--confirm-disposable", action="store_true", help="Confirm both API and backing database are disposable local test resources")
    args = parser.parse_args()

    parsed_url = urlparse(args.base_url)
    if (parsed_url.scheme != "http" or parsed_url.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed_url.username or parsed_url.password or parsed_url.query or parsed_url.fragment):
        parser.error("Only an HTTP loopback API is allowed; use a local disposable test host.")
    for path in (args.login_path, args.search_path):
        path_url = urlparse(path)
        if path_url.scheme or path_url.netloc or path_url.query or path_url.fragment or not path.startswith("/"):
            parser.error("Endpoint paths must be local absolute paths without URL hosts, query strings or fragments.")
    if not args.confirm_disposable:
        parser.error("Login and search mutate session/match state; pass --confirm-disposable only for disposable local test resources.")
    if args.samples < 3 or args.samples > 5 or args.warmup < 0 or args.warmup > 2 or args.warmup + args.samples > 5 or args.timeout <= 0:
        parser.error("The configured login route allows five attempts per 15 minutes; use 3–5 samples, at most 2 warmups, and no more than 5 requests total.")
    try:
        date.fromisoformat(args.date)
    except ValueError:
        parser.error("--date must be an ISO date (YYYY-MM-DD).")

    username = input("Synthetic test login identifier: ")
    password = getpass.getpass("Synthetic test password (input hidden): ")
    if not username or not password:
        parser.error("A synthetic local test account is required.")

    root = args.base_url.rstrip("/")
    login_url = urllib.parse.urljoin(root + "/", args.login_path.lstrip("/"))
    search_url = urllib.parse.urljoin(root + "/", args.search_path.lstrip("/"))
    search_url += "?" + urllib.parse.urlencode({
        "direction": args.direction,
        "date": args.date,
        "vehicle_type": args.vehicle_type,
        "pickup_choice": args.pickup_choice,
    })
    login_payload = {args.login_user_field: username, args.login_password_field: password}

    login_samples: list[tuple[int, float]] = []
    token = None
    for index in range(args.warmup + args.samples):
        status, elapsed, body = send(login_url, "POST", login_payload, None, args.timeout)
        if status != 200:
            print(f"Login failed with HTTP {status}; response body was not recorded.", file=sys.stderr)
            return 2
        token = nested(body, args.token_path)
        if not isinstance(token, str) or not token:
            print("Login response did not contain a token at --token-path; response body was not recorded.", file=sys.stderr)
            return 2
        if index >= args.warmup:
            login_samples.append((status, elapsed))

    search_samples: list[tuple[int, float]] = []
    for index in range(args.warmup + args.samples):
        status, elapsed, _ = send(search_url, "GET", None, token, args.timeout)
        if status != 200:
            print(f"Search failed with HTTP {status}; response body was not recorded.", file=sys.stderr)
            return 3
        if index >= args.warmup:
            search_samples.append((status, elapsed))

    report = {
        "base_url": root,
        "revision": args.revision,
        "dataset": args.dataset,
        "date": args.date,
        "warmup_requests_per_endpoint": args.warmup,
        "measured_requests_per_endpoint": args.samples,
        "concurrency": 1,
        "note": "Local serial HTTP measurements; excludes browser rendering and should not be presented as production or field latency.",
        "login": summarize(login_samples),
        "search": summarize(search_samples),
    }
    encoded = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(encoded, encoding="utf-8")
        print(f"Wrote measurements to {args.output}")
    else:
        print(encoded, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
