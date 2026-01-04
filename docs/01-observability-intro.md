# Module 1: Why Observability?

Welcome to your first module! Let's understand **why** observability matters before diving into tools.

---

## 🤔 The Problem: "It Works on My Machine"

Imagine this scenario:

```
Production Alert: "API response time > 5 seconds"

You: *checks code* "Looks fine to me..."
You: *checks local environment* "Works perfectly..."
You: *stares at screen* "What's happening in production?!"
```

**Without observability**, you're debugging blind. You have no visibility into what's actually happening inside your running systems.

---

## Monitoring vs Observability

These terms are often confused. Here's the key difference:

| Aspect        | Monitoring          | Observability           |
| ------------- | ------------------- | ----------------------- |
| **Approach**  | "Did X happen?"     | "Why did X happen?"     |
| **Questions** | Pre-defined         | Unknown unknowns        |
| **Data**      | Metrics only        | Metrics + Logs + Traces |
| **Use case**  | Known failure modes | Debugging novel issues  |

### Analogy: Car Dashboard

**Monitoring** = Your car's dashboard lights

- ✅ "Check engine light is on"
- ❌ Doesn't tell you WHY

**Observability** = Being able to inspect the engine

- ✅ "Check engine light is on"
- ✅ "Because the oxygen sensor failed"
- ✅ "Which caused incomplete combustion"
- ✅ "Which started after 50,000 miles"

> [!NOTE] > **Observability is NOT about having more data.** It's about having the RIGHT data to answer questions you haven't thought of yet.

---

## The Three Pillars of Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY                                │
│                                                                 │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐                │
│    │ METRICS  │    │   LOGS   │    │  TRACES  │                │
│    │          │    │          │    │          │                │
│    │  "What"  │    │  "Why"   │    │  "Where" │                │
│    │ happened │    │ happened │    │ happened │                │
│    └──────────┘    └──────────┘    └──────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1️⃣ Metrics (Prometheus)

**What they are:** Numeric measurements over time

**Example:**

```
http_requests_total = 15,234
http_request_duration_seconds = 0.023
memory_usage_bytes = 524288000
```

**Best for:**

- Alerting ("CPU > 80%")
- Trends ("Requests growing 10% weekly")
- Aggregates ("Average response time")

**Limitation:** No context about individual events

---

### 2️⃣ Logs (Loki)

**What they are:** Timestamped text records of events

**Example:**

```
2024-01-03 10:15:23 INFO  User login successful user_id=12345
2024-01-03 10:15:24 ERROR Database connection timeout after 30s
2024-01-03 10:15:25 WARN  Retrying database connection (attempt 2/3)
```

**Best for:**

- Debugging specific errors
- Audit trails
- Understanding sequences of events

**Limitation:** Hard to follow across services

---

### 3️⃣ Traces (Tempo)

**What they are:** Records of a request's journey through your system

**Example:**

```
Trace ID: abc123
├── [200ms] API Gateway: /api/orders
│   ├── [50ms] Auth Service: validate token
│   ├── [120ms] Order Service: create order  ← SLOW!
│   │   └── [110ms] Database: INSERT query   ← HERE'S WHY!
│   └── [30ms] Notification Service: send email
```

**Best for:**

- Finding bottlenecks
- Understanding request flow
- Debugging distributed systems

**Limitation:** Sampling required at scale

---

## When to Use What?

| Scenario                  | Best Pillar | Why                     |
| ------------------------- | ----------- | ----------------------- |
| "Is my service healthy?"  | Metrics     | Quick numeric check     |
| "Why did request X fail?" | Logs        | Detailed error message  |
| "Why is service slow?"    | Traces      | See where time is spent |
| "What happened at 3am?"   | All three!  | Full picture            |

### The Correlation Power

The real power comes from **combining all three**:

```
1. ALERT fires: "High latency detected" (Metrics)
         │
         ▼
2. FILTER logs: "Show me errors from that time" (Logs)
         │
         ▼
3. JUMP to trace: "Show me slow requests" (Traces)
         │
         ▼
4. ROOT CAUSE: "Database query taking 5 seconds"
```

This is exactly what we'll build!

---

## Real-World Scenario: Debugging a Slow API

Let's walk through how you'd debug with observability:

### The Alert

```
🚨 Alert: API latency p95 > 2s (was 200ms yesterday)
```

### Step 1: Check Metrics

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

You see: Latency spiked at 2:00 PM

### Step 2: Filter Logs

```logql
{app="order-service"} | json | latency > 2s
```

You see: "Database connection pool exhausted"

### Step 3: View Trace

You click on a slow request's trace ID and see:

```
├── Order API: 2100ms
│   ├── Auth: 10ms
│   └── DB Query: 2050ms  ← 🎯 FOUND IT!
```

### Root Cause

The database added a new index that's causing full table scans!

**Without observability:** "Umm... let me restart the server?"
**With observability:** Precise diagnosis in minutes

---

## OpenTelemetry: The Standard

Before we proceed, you should know about **OpenTelemetry (OTel)**:

- **What:** Vendor-neutral standard for instrumentation
- **Why:** Instrument once, send data anywhere
- **Components:** SDKs, Collector, Protocols

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│   Your App   │────▶│ OTel Collector │────▶│ Prometheus   │
│ (with OTel)  │     │                │     │ Loki         │
└──────────────┘     └────────────────┘     │ Tempo        │
                                            └──────────────┘
```

We'll use OpenTelemetry to instrument our sample app!

---

## 🧠 Knowledge Check

Before moving on, make sure you can answer:

1. **What's the difference between monitoring and observability?**

2. **Name the three pillars and what each is best for:**

   - Metrics → ?
   - Logs → ?
   - Traces → ?

3. **Why do you need all three, not just one?**

4. **What is OpenTelemetry and why does it matter?**

---

## ✅ What's Next?

Now that you understand WHY observability matters, let's dive deep into the first pillar:

**Module 2: Prometheus Deep Dive** →

- Pull vs Push model
- Metric types (Counter, Gauge, Histogram)
- PromQL basics
- Hands-on: Set up Prometheus!

---

> [!TIP]
> Take a moment to think about your past debugging experiences. How would observability have helped?

**Ready to continue? Let me know and we'll start with Prometheus!** 🚀
