# Module 4: Distributed Tracing with Tempo

The third pillar: **Traces** - understanding request flow across services.

---

## What is Distributed Tracing?

Tracing follows a **single request** as it travels through multiple services.

```
┌─────────────────────────────────────────────────────────────────┐
│                    A SINGLE USER REQUEST                        │
│                                                                 │
│  User clicks "Buy" button                                       │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Gateway   │───►│   Orders    │───►│  Payments   │         │
│  │   (50ms)    │    │   (120ms)   │    │   (800ms)   │ ← SLOW! │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                                    │                  │
│         │                              ┌─────────────┐         │
│         │                              │  Database   │         │
│         │                              │   (200ms)   │         │
│         │                              └─────────────┘         │
│         ▼                                                       │
│  Response to user (total: 1170ms)                              │
│                                                                 │
│  WITHOUT TRACING: "Request was slow" (where? why?)             │
│  WITH TRACING: "Payments service took 800ms" ← Actionable!     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Trace

A **trace** represents the entire journey of a request through the system.

- Has a unique **Trace ID** (e.g., `abc123def456`)
- Contains multiple **spans**

### 2. Span

A **span** represents a single operation within a trace.

- Has a unique **Span ID**
- Has a **parent Span ID** (except root span)
- Contains: name, duration, status, attributes

```
Trace: abc123def456
├── Span: Gateway (root)          [0ms - 1170ms]
│   ├── Span: HTTP GET /orders    [10ms - 950ms]
│   │   ├── Span: DB Query        [50ms - 150ms]
│   │   └── Span: Call Payments   [200ms - 900ms]
│   │       └── Span: Stripe API  [250ms - 850ms]
│   └── Span: Format Response     [960ms - 1170ms]
```

### 3. Context Propagation

How trace context flows between services:

```
Service A                          Service B
─────────                          ─────────
Create trace ID ───────────────────►
Create span ────────────────────────►
Add to headers:                     Extract from headers:
  traceparent: 00-abc123-xyz-01     traceparent: 00-abc123-xyz-01

HTTP Request ─────────────────────► Receives trace context
                                    Creates child span
                                    Same trace ID!
```

---

## What is Tempo?

Tempo is Grafana's **distributed tracing backend**:

- Stores and queries traces
- Only indexes **Trace ID** (like Loki for logs)
- Integrates with Grafana for visualization
- Supports multiple protocols (Jaeger, Zipkin, OTLP)

## What is OpenTelemetry (OTel)?

**OpenTelemetry** is the standard for observability instrumentation:

- Single SDK for traces, metrics, AND logs
- Vendor-neutral (works with Tempo, Jaeger, Datadog, etc.)
- Auto-instrumentation for common libraries

```
┌─────────────────────────────────────────────────────────────────┐
│                     OPENTELEMETRY                               │
│                                                                 │
│  Your App ──► OTel SDK ──► OTel Collector ──► Tempo             │
│                                   │                             │
│                                   ├──► Prometheus               │
│                                   └──► Loki                     │
│                                                                 │
│  One SDK, multiple backends!                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Trace Anatomy

```json
{
  "traceId": "abc123def456789",
  "spans": [
    {
      "spanId": "span1",
      "parentSpanId": null, // Root span
      "operationName": "GET /api/buy",
      "serviceName": "gateway",
      "duration": 1170,
      "status": "OK",
      "attributes": {
        "http.method": "GET",
        "http.url": "/api/buy",
        "http.status_code": 200
      }
    },
    {
      "spanId": "span2",
      "parentSpanId": "span1", // Child of root
      "operationName": "orders.process",
      "serviceName": "orders",
      "duration": 120,
      "attributes": {
        "order.id": "ORD-12345"
      }
    }
  ]
}
```

---

## When to Use Tracing

| Scenario                           | Tracing Useful? |
| ---------------------------------- | --------------- |
| Single monolith, no external calls | 🤷 Limited      |
| Monolith + DB + Cache + APIs       | ✅ Yes          |
| Microservices                      | 🔥 Essential    |
| Debugging slow requests            | ✅ Yes          |
| Finding bottlenecks                | ✅ Yes          |

---

## Our Demo Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   User Request: POST /api/order                                 │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────┐                                               │
│   │   Gateway   │  (sample-app - Port 8000)                     │
│   │   API       │  Receives request, calls order-service        │
│   └─────────────┘                                               │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────┐                                               │
│   │   Order     │  (order-service - Port 8001)                  │
│   │   Service   │  Processes order, calls payment-service       │
│   └─────────────┘                                               │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────┐                                               │
│   │  Payment    │  (payment-service - Port 8002)                │
│   │  Service    │  Processes payment, returns result            │
│   └─────────────┘                                               │
│        │                                                        │
│        └─────── All 3 send traces to Tempo ─────────────────────│
│                           │                                     │
│                    ┌─────────────┐                              │
│                    │    Tempo    │  (Port 4318 - OTLP)          │
│                    └─────────────┘                              │
│                           │                                     │
│                    ┌─────────────┐                              │
│                    │   Grafana   │  Query & visualize           │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘

Trace View:
├── gateway ──────────────────────────────── 350ms
│   └── order-service ────────────────── 280ms
│       └── payment-service ────────── 150ms
```

---

## 🧠 Knowledge Check

1. **What's the difference between a trace and a span?**
2. **Why do we need context propagation?**
3. **What does OpenTelemetry provide?**
4. **Why is tracing more valuable in microservices?**

---

## ✅ Next: Hands-On!

1. Add Tempo to Docker Compose
2. Create order-service and payment-service
3. Instrument all 3 services with OpenTelemetry
4. See the full trace chain in Grafana!

Ready? 🚀
