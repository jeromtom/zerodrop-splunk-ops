# Architecture: DropWatch, a general agentic observability layer on Splunk

DropWatch is not tied to one app. It is a **general observability agent**: any
instrumented source (an app's hot paths, an ITOps host, a NetOps device) emits
telemetry into Splunk over HEC, and the DropWatch agent **reads it back**,
extracts features, runs **detectors** (domain rules plus a generic z-score
anomaly detector and a leading-indicator early-warning), reasons over the result
with an **LLM**, and emits a **health score + ranked findings**. Those findings
drive a `/ops` dashboard with one-click apply, an **AI alert webhook**
(Slack / PagerDuty) for automated response, and the packaged Splunk app's own
scheduled alerts. ZeroDrop is shown as the worked example source.

Each read tier and reasoning tier degrades gracefully, so the agent always
returns findings even with nothing but a local buffer and the rules engine.

## System diagram

```mermaid
flowchart TB
    subgraph Sources["Event sources: any instrumented source"]
        ZD["ZeroDrop hot paths (example)<br/>claim · hold-create · hold-expiry<br/>oversell-reject · waitlist · checkout"]
        ITOPS["ITOps sources<br/>hosts · services · app logs"]
        NETOPS["NetOps sources<br/>devices · flows · SNMP"]
        SINK["lib/dropwatch/sink.ts<br/>HEC client + local ring buffer<br/>(choke point)"]
    end

    subgraph Splunk["Splunk (AI platform)"]
        HEC["HTTP Event Collector"]
        IDX[("index=zerodrop<br/>sourcetype telemetry")]
        MCP["Splunk MCP Server<br/>run_splunk_search"]
        REST["REST search API<br/>search/jobs/export"]
        HM["Splunk Hosted Models"]
        DASH["Packaged Splunk app<br/>dashboard + scheduled alerts"]
    end

    subgraph Agent["DropWatch agent (lib/dropwatch)"]
        SCAN["agent.ts scan()<br/>orchestrator"]
        PULL{"search.ts<br/>3-tier pull"}
        FEAT["analyze.ts<br/>feature extraction"]
        DET["detectors / rules engine<br/>stampede · oversell-bot<br/>hold-storm · waitlist<br/>+ z-score anomaly (generic)<br/>+ leading-indicator early-warning"]
        REASON{"llm.ts<br/>3-tier reasoning"}
        SCORE["health score +<br/>ranked findings"]
    end

    subgraph Out["Outputs"]
        OPSUI["/ops dashboard<br/>health · findings · one-click apply"]
        WEBHOOK["AI alert webhook<br/>Slack / PagerDuty<br/>automated response"]
        OPS["Ops operator"]
    end

    %% ingest (LIVE)
    ZD ==> SINK
    ITOPS -.-> SINK
    NETOPS -.-> SINK
    SINK == "HTTPS POST · Authorization: Splunk TOKEN" ==> HEC ==> IDX

    %% 3-tier pull
    SCAN --> PULL
    PULL -. "tier 1: SPL via JSON-RPC tools/call" .-> MCP -.-> IDX
    PULL -. "tier 2: REST search" .-> REST -.-> IDX
    PULL == "tier 3 (LIVE): local buffer" ==> SINK

    %% analyze + detect
    PULL --> FEAT --> DET --> REASON

    %% 3-tier reasoning
    REASON -. "tier 1: Hosted Models" .-> HM
    REASON == "tier 2 (LIVE): OpenAI-compatible AIML API" ==> SCORE
    REASON == "tier 3 (LIVE): rules engine" ==> SCORE

    %% outputs
    SCORE --> OPSUI
    SCORE --> WEBHOOK
    OPS --> OPSUI
    OPSUI == "Apply remediation -> breadcrumb event" ==> SINK
    IDX --> DASH

    classDef splunk fill:#65a637,stroke:#3c6e1f,color:#08210a;
    classDef live fill:#1f6feb,stroke:#0b3d91,color:#eaf2ff;
    classDef wired fill:#3a3f4b,stroke:#8b95a7,color:#dfe4ee,stroke-dasharray:5 4;
    class HEC,IDX,MCP,REST,DASH,HM splunk;
    class ZD,SINK,FEAT,DET,SCORE,OPSUI,WEBHOOK live;
    class MCP,REST,HM,ITOPS,NETOPS wired;
```

### Legend

- **`==>` thick / blue `live` nodes are LIVE.** Running on the demo deployment:
  ZeroDrop HEC ingest, the local ring buffer read tier, feature extraction +
  detectors, the OpenAI-compatible AIML reasoning tier, the rules-engine
  fallback, the `/ops` dashboard with apply, and the AI alert webhook.
- **`-.->` dashed / grey `wired` nodes are WIRED, not live on the Cloud trial.**
  Coded and ready but unverified end-to-end here: the Splunk **MCP Server** read
  tier, the **REST search** read tier, **Splunk Hosted Models** reasoning, and
  the additional **ITOps / NetOps** source connectors. These are never claimed
  as live.
- **Green `splunk` nodes** are Splunk platform components.

## The agentic loop (one `scan()` cycle)

```mermaid
sequenceDiagram
    participant U as /ops UI
    participant A as agent.scan()
    participant S as Splunk read<br/>(MCP -> REST -> buffer)
    participant F as analyze: features + detectors
    participant L as llm: Hosted -> AIML -> rules
    participant N as Alert webhook<br/>(Slack / PagerDuty)

    U->>A: GET /api/ops/scan?source=...
    A->>S: SPL: index=zerodrop earliest=-15m
    S-->>A: recent events (live tier = local buffer)
    A->>F: summarize -> features
    F->>F: detectors: domain rules + z-score anomaly + early-warning
    F-->>A: candidate signals
    A->>L: reason(features, signals)
    L-->>A: health score + severity-ranked findings + actions
    A-->>U: { healthScore, findings[], spl, telemetrySource, llmTier }
    A->>N: POST high-severity findings (automated response)
    U->>S: (operator clicks Apply) breadcrumb event -> HEC
```

## Key design choices

- **Source-agnostic by design.** Detectors split into domain rules (stampede,
  oversell-bot, hold-storm, waitlist) and **generic** detectors (z-score anomaly
  + leading-indicator early-warning), so the same agent serves ITOps and NetOps
  sources, not just ZeroDrop.
- **Telemetry never breaks the source.** Emission is fire-and-forget and the HEC
  client no-ops without env, so a source's latency and correctness guarantees
  are untouched.
- **Splunk is the system of record; the ring buffer is a hot cache** that keeps
  mock mode and local dev fully offline-capable.
- **Graceful degradation everywhere:** MCP -> REST -> buffer for reads, Hosted
  Models -> AIML -> rules for reasoning. The agent always returns findings.
- **Findings fan out three ways:** interactive `/ops` apply, automated webhook
  (Slack / PagerDuty), and the packaged Splunk app's scheduled alerts.
- **No heavy dependencies:** stdlib `fetch`/`http` only, so the layer is light
  and disk-cheap.
