#!/usr/bin/env python
"""
DropWatch custom SPL command — run the agent's detection inside Splunk.

Usage:
    index=zerodrop sourcetype=zerodrop:telemetry | dropwatch
    index=zerodrop sourcetype=zerodrop:telemetry earliest=-15m | dropwatch window=15

Pipe DropWatch telemetry into `| dropwatch` and it emits one row per finding
(drop-health score, stampede, hold-expiry storm, and the OWASP OAT-005 scalping
bot SECURITY finding) — the same agentic detection that runs in the app, now
native in the Splunk search bar. This is what makes DropWatch feel embedded in
Splunk rather than a side dashboard.

Dependency: the Splunk SDK for Python (splunklib). Vendor it into bin/lib so the
app is self-contained:
    pip install splunk-sdk -t splunk-app/bin/lib
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from splunklib.searchcommands import (  # noqa: E402
    dispatch,
    ReportingCommand,
    Configuration,
    Option,
    validators,
)


def subnet24(ip):
    parts = (ip or "").split(".")
    if len(parts) >= 3 and all(p.isdigit() for p in parts[:3]):
        return "{0}.{1}.{2}.0/24".format(parts[0], parts[1], parts[2])
    return None


@Configuration()
class DropWatchCommand(ReportingCommand):
    window = Option(
        doc="Analysis window in minutes (informational label).",
        require=False,
        default=15,
        validate=validators.Integer(1),
    )

    @Configuration()
    def map(self, records):
        # No pre-reduce; pass events straight to reduce.
        for record in records:
            yield record

    def reduce(self, records):
        claims = rejects = holds_created = hold_expiries = waitlist_adds = checkouts = 0
        reject_subnets = defaultdict(lambda: {"count": 0, "ips": set()})
        drop_id = None

        for r in records:
            ev = (r.get("event") or "").strip()
            if r.get("dropId"):
                drop_id = r.get("dropId")
            if ev == "claim":
                claims += 1
            elif ev == "oversell_reject":
                rejects += 1
                sn = subnet24(r.get("ip"))
                if sn:
                    reject_subnets[sn]["count"] += 1
                    if r.get("ip"):
                        reject_subnets[sn]["ips"].add(r.get("ip"))
            elif ev == "hold_create":
                holds_created += 1
            elif ev == "hold_expiry":
                hold_expiries += 1
            elif ev == "waitlist_add":
                waitlist_adds += 1
            elif ev == "checkout":
                checkouts += 1

        denom = claims + rejects
        reject_rate = (rejects / float(denom)) if denom else 0.0
        health = 100
        findings = []

        # OWASP OAT-005 scalping bots: one /24 dominating post-sellout rejects.
        if reject_subnets and rejects >= 10:
            sn, info = max(reject_subnets.items(), key=lambda kv: kv[1]["count"])
            share = info["count"] / float(rejects)
            if share >= 0.25:
                ips = len(info["ips"]) or 1
                rejects_per_ip = info["count"] / float(ips)
                confidence = min(0.98, 0.45 + share * 0.4 + min(0.25, rejects_per_ip / 40.0))
                health -= 30
                findings.append({
                    "finding_id": "oversell-bot",
                    "title": "Automated scalping bots (OWASP OAT-005)",
                    "severity": "high",
                    "owasp": "OAT-005 Scalping",
                    "confidence": round(confidence, 2),
                    "reasoning": (
                        "Subnet {0} ({1} IPs) produced {2} of {3} oversell-rejects ({4}%). One /24 "
                        "dominating post-sellout rejects is the signature of automated scalping bots. "
                        "Overselling is impossible by construction, so the cluster is a clean security signal."
                    ).format(sn, ips, info["count"], rejects, int(share * 100)),
                    "recommendation": "Block subnet {0} at the edge (or soft-block + CAPTCHA); add to the abuse watchlist.".format(sn),
                    "action": "flag_ip_cluster: block {0}".format(sn),
                })

        if denom >= 100:
            health -= 15
            findings.append({
                "finding_id": "stampede",
                "title": "Stampede onset",
                "severity": "high",
                "owasp": "",
                "confidence": 0.8,
                "reasoning": "{0} claims and {1} oversell-rejects in the window: the drop is going viral and stock is draining fast.".format(claims, rejects),
                "recommendation": "Enable the queue throttle to smooth the surge and protect tail latency.",
                "action": "enable_throttle",
            })

        if hold_expiries >= 10 and holds_created and (hold_expiries / float(holds_created)) >= 0.3:
            health -= 10
            findings.append({
                "finding_id": "hold-expiry-storm",
                "title": "Hold-expiry storm",
                "severity": "medium",
                "owasp": "",
                "confidence": 0.7,
                "reasoning": "{0} holds expired unconfirmed ({1}% of holds created): stock bouncing back as buyers abandon carts.".format(
                    hold_expiries, int(hold_expiries / float(holds_created) * 100)),
                "recommendation": "Extend the hold window from 10 to 15 minutes.",
                "action": "extend_hold",
            })

        health = max(0, min(100, health))
        if not findings:
            findings.append({
                "finding_id": "healthy",
                "title": "Drop healthy",
                "severity": "info",
                "owasp": "",
                "confidence": 0.9,
                "reasoning": "No anomalies: {0} claims, {1} rejects ({2}% reject rate), {3} checkouts.".format(
                    claims, rejects, int(reject_rate * 100), checkouts),
                "recommendation": "No action needed.",
                "action": "none",
            })

        total_events = claims + rejects + holds_created + hold_expiries + waitlist_adds + checkouts
        for f in findings:
            yield {
                "dropId": drop_id or "(all)",
                "health_score": health,
                "reject_rate": round(reject_rate, 2),
                "events": total_events,
                "finding_id": f["finding_id"],
                "title": f["title"],
                "severity": f["severity"],
                "owasp": f["owasp"],
                "confidence": f["confidence"],
                "reasoning": f["reasoning"],
                "recommendation": f["recommendation"],
                "action": f["action"],
            }


dispatch(DropWatchCommand, sys.argv, sys.stdin, sys.stdout, __name__)
