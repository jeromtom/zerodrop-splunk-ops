# Architecture — DropWatch agentic observability on ZeroDrop

Data flows in two directions around Splunk: ZeroDrop **emits** telemetry into
Splunk via HEC, and the DropWatch agent **reads it back** (via the Splunk MCP
Server, REST search, or — offline — a local buffer), reasons over it with an
LLM, and surfaces remediations at `/ops`.

```mermaid
flowchart TB
    subgraph Clients
        B["Buyers (concurrent)"]
        SIM["Load simulator<br/>(up to 1000 buyers)"]
        OPS["Ops operator"]
    end

    subgraph App["ZeroDrop — Next.js App Router (Vercel)"]
        API["Route Handlers /api/*<br/>claim · confirm · simulate"]
        HOT["lib/drops.ts hot paths<br/>claim · hold-create · hold-expiry<br/>oversell-reject · waitlist · checkout"]
        SINK["lib/dropwatch/sink.ts<br/>(choke point)"]
        OPSUI["/ops dashboard<br/>health score · findings · apply"]
    end

    subgraph DDB["AWS DynamoDB"]
        T[("table zerodrop<br/>atomic conditional writes<br/>claimed < totalStock")]
    end

    subgraph Splunk["Splunk (AI platform)"]
        HEC["HTTP Event Collector"]
        IDX[("index=zerodrop<br/>sourcetype zerodrop:telemetry")]
        MCP["Splunk MCP Server<br/>run_splunk_search"]
        REST["REST search API"]
        DASH["dropwatch.xml dashboard"]
        HM["Splunk Hosted Models"]
    end

    subgraph Agent["DropWatch agent (lib/dropwatch)"]
        SEARCH["search.ts<br/>pull telemetry"]
        ANALYZE["analyze.ts<br/>features + rules"]
        LLM["llm.ts<br/>reason"]
        SCAN["agent.ts scan()<br/>orchestrator"]
    end

    B --> API
    SIM --> API
    API --> HOT --> T
    HOT -- "structured JSON events + metrics" --> SINK
    SINK -- "HTTPS POST<br/>Authorization: Splunk TOKEN" --> HEC --> IDX

    SCAN --> SEARCH
    SEARCH -- "SPL via JSON-RPC tools/call (preferred)" --> MCP --> IDX
    SEARCH -- "fallback: search/jobs/export" --> REST --> IDX
    SEARCH -- "offline fallback" --> SINK
    SCAN --> ANALYZE --> LLM
    LLM -- "live reasoning (OpenAI-compatible)" --> HM
    LLM -. "fallback: AI/ML API -> rules engine" .-> ANALYZE
    SCAN --> OPSUI
    OPS --> OPSUI
    OPSUI -- "Apply remediation" --> SINK
    IDX --> DASH

    classDef splunk fill:#65a637,stroke:#3c6e1f,color:#08210a;
    class HEC,IDX,MCP,REST,DASH,HM splunk;
```

## The agentic loop (one `scan()` cycle)

```mermaid
sequenceDiagram
    participant U as /ops UI
    participant A as agent.scan()
    participant S as Splunk (MCP/REST)
    participant F as analyze.summarize()
    participant L as LLM (Hosted Models -> AIML -> rules)

    U->>A: GET /api/ops/scan?dropId=...
    A->>S: SPL: index=zerodrop sourcetype=zerodrop:telemetry earliest=-15m
    S-->>A: recent DropEvents
    A->>F: summarize(events) -> features
    A->>L: reason(features)
    L-->>A: severity-ranked findings + recommended actions
    A-->>U: { healthScore, findings[], spl, telemetrySource, llmTier }
    U->>S: (operator clicks Apply) breadcrumb event -> HEC
```

## Key design choices

- **Telemetry never breaks the hot path.** Emission is fire-and-forget and the
  HEC client no-ops without env — ZeroDrop's latency and oversell guarantee are
  untouched.
- **Splunk is the system of record; the ring buffer is a hot cache** that also
  makes mock mode and local dev fully offline-capable.
- **Graceful degradation everywhere:** MCP → REST → buffer for reads; Hosted
  Models → AIML → rules for reasoning. The agent always returns findings.
- **No heavy dependencies** — stdlib `fetch`/`http` only, so the layer is light
  and disk-cheap.
