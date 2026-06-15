/**
 * Applied-action store for DropWatch.
 *
 * When an operator clicks "Apply" on a finding in the /ops dashboard (or the
 * agent auto-applies), the action is recorded here and emitted as telemetry so
 * the loop is visible in Splunk too. In a production deploy each action `kind`
 * would call the corresponding control plane (toggle throttle flag on the drop
 * item, bump HOLD_SECONDS, push the subnet to an edge block list). Here we keep
 * a process-local log + telemetry breadcrumb, which is enough for the demo and
 * keeps the hot path dependency-free.
 */

import type { OpsAction } from "./analyze";
import { newEvent } from "./events";
import { recordSync } from "./sink";

export interface AppliedAction {
  id: string;
  at: string;
  findingId: string;
  action: OpsAction;
  result: string;
}

const g = globalThis as unknown as { __dropwatchActions?: AppliedAction[] };
const log: AppliedAction[] = (g.__dropwatchActions ??= []);

export function applyAction(findingId: string, action: OpsAction): AppliedAction {
  const result = describe(action);
  const applied: AppliedAction = {
    id: `act_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    findingId,
    action,
    result,
  };
  log.push(applied);
  // Breadcrumb back into telemetry so the remediation shows up in Splunk.
  recordSync(
    newEvent("sim_summary", String((action.params?.dropId as string) ?? "ops"), {
      meta: { opsAction: action.kind, findingId, result, params: action.params },
    })
  );
  return applied;
}

function describe(action: OpsAction): string {
  switch (action.kind) {
    case "enable_throttle":
      return `Queue throttle enabled (${action.params?.rps ?? 50} rps) on drop ${action.params?.dropId}.`;
    case "extend_hold":
      return `Hold window extended to ${Number(action.params?.seconds ?? 900) / 60} min on drop ${action.params?.dropId}.`;
    case "flag_ip_cluster":
      return `IP cluster ${action.params?.subnet ?? action.params?.ip} flagged for soft-block / CAPTCHA.`;
    case "notify": {
      // Restock/waitlist findings carry an `audience`; generic anomaly findings
      // carry an `eventType` instead. Never render the literal "undefined".
      if (action.params?.audience)
        return `Restock-notify campaign queued for ${action.params.audience} on drop ${action.params.dropId}.`;
      const who = action.params?.eventType
        ? `the "${action.params.eventType}" spike`
        : "the anomaly";
      return `On-call alerted for ${who} on drop ${action.params?.dropId ?? "(all)"}.`;
    }
    default:
      return "Acknowledged.";
  }
}

export function recentActions(limit = 20): AppliedAction[] {
  return log.slice(-limit).reverse();
}
