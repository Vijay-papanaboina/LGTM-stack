# Module 3: Loki Deep Dive

Now let's tackle the second pillar: **Logs with Loki**.

---

## What is Loki?

Loki is a **log aggregation system** created by Grafana Labs. Think of it as "Prometheus, but for logs."

```
┌─────────────────────────────────────────────────────────────────┐
│                           LOKI                                  │
│                                                                 │
│   "A horizontally-scalable, highly-available, multi-tenant      │
│    log aggregation system inspired by Prometheus"               │
│                                                                 │
│   Key Innovation:                                               │
│   • Only indexes LABELS, not log content                        │
│   • Much cheaper to run than Elasticsearch                      │
│   • Native Grafana integration                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Concept #1: Index-Free Design

### Traditional Log Systems (Elasticsearch/Splunk)

```
Log: "2024-01-04 10:15:23 ERROR User 12345 failed login attempt"

Elasticsearch indexes EVERY word:
├── "2024-01-04" → index
├── "10:15:23" → index
├── "ERROR" → index
├── "User" → index
├── "12345" → index
├── "failed" → index
├── "login" → index
└── "attempt" → index

Result: Fast search, but HUGE storage + CPU cost
```

### Loki's Approach

```
Log: "2024-01-04 10:15:23 ERROR User 12345 failed login attempt"
Labels: {app="auth-service", level="error", env="prod"}

Loki indexes ONLY labels:
├── app="auth-service" → index
├── level="error" → index
└── env="prod" → index

Log content: compressed, stored as-is (NOT indexed)

Result: Smaller index, cheaper storage, still fast for label queries
```

> [!IMPORTANT] > **Loki's Philosophy**: Use labels to find the right log streams, then grep through them.
>
> It trades full-text search speed for massive cost savings.

---

## 🔑 Key Concept #2: Labels (Again!)

Just like Prometheus, labels are critical in Loki:

### Good Labels (Low Cardinality)

```yaml
{app="sample-app", env="prod", level="error"}
{app="sample-app", env="prod", level="info"}
{app="auth-service", env="prod", level="error"}
```

### Bad Labels (High Cardinality) ❌

```yaml
{user_id="12345"}      # Millions of users = millions of streams!
{request_id="abc123"}  # Every request = new stream!
{timestamp="..."}      # Infinite streams!
```

> [!CAUTION] > **High cardinality kills Loki!** Keep label values in the hundreds, not millions.
>
> Put high-cardinality data IN the log content, not in labels.

---

## 🔑 Key Concept #3: Loki Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      LOKI ARCHITECTURE                          │
│                                                                 │
│  ┌──────────────┐                                              │
│  │   Promtail   │ ─── Push logs ──┐                            │
│  │   (Agent)    │                 │                            │
│  └──────────────┘                 ▼                            │
│                            ┌──────────────┐                    │
│  ┌──────────────┐          │ Distributor  │                    │
│  │    Alloy     │ ────────►│              │                    │
│  │   (Agent)    │          └──────────────┘                    │
│  └──────────────┘                 │                            │
│                                   ▼                            │
│                            ┌──────────────┐                    │
│  ┌──────────────┐          │   Ingester   │                    │
│  │  Your App    │ ────────►│              │                    │
│  │ (Direct Push)│          └──────────────┘                    │
│  └──────────────┘                 │                            │
│                                   ▼                            │
│                            ┌──────────────┐                    │
│                            │   Storage    │                    │
│                            │ (Filesystem/ │                    │
│                            │  S3/GCS)     │                    │
│                            └──────────────┘                    │
│                                   │                            │
│                                   ▼                            │
│                            ┌──────────────┐                    │
│                            │   Querier    │◄──── Grafana       │
│                            └──────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

**Components:**

1. **Promtail/Alloy**: Agents that collect logs and push to Loki
2. **Distributor**: Receives logs, validates, forwards to ingesters
3. **Ingester**: Batches and compresses logs, writes to storage
4. **Querier**: Handles queries from Grafana
5. **Storage**: Filesystem, S3, GCS, etc.

---

## 🔑 Key Concept #4: Ways to Send Logs

### Option 1: Promtail (File-based)

Reads log files from disk, adds labels, pushes to Loki.

```
Your App → writes to /var/log/app.log → Promtail reads → Loki
```

### Option 2: Direct Push (HTTP API)

Your app pushes logs directly to Loki's API.

```
Your App → HTTP POST to Loki → Loki
```

### Option 3: Alloy (OpenTelemetry Collector)

Grafana's unified agent for metrics, logs, AND traces.

```
Your App (OTel) → Alloy → Loki + Tempo + Prometheus
```

**For our learning, we'll use Option 2 (Direct Push)** - simplest to understand!

---

## 🔑 Key Concept #5: LogQL

LogQL is Loki's query language. It's inspired by PromQL!

### Stream Selector (like Prometheus labels)

```logql
{app="sample-app"}                    # All logs from sample-app
{app="sample-app", level="error"}     # Only errors
{app=~"sample-.*"}                    # Regex match
```

### Line Filters

```logql
{app="sample-app"} |= "error"         # Contains "error"
{app="sample-app"} != "debug"         # Does NOT contain "debug"
{app="sample-app"} |~ "user_id=\\d+"  # Regex match
```

### Parsers

```logql
# Parse JSON logs
{app="sample-app"} | json

# Parse and filter
{app="sample-app"} | json | level="error"
{app="sample-app"} | json | duration > 1s
```

### Aggregations (Metric queries)

```logql
# Count logs per minute
count_over_time({app="sample-app"}[1m])

# Error rate
sum(rate({app="sample-app", level="error"}[5m]))

# Top endpoints by log volume
sum by (endpoint) (rate({app="sample-app"} | json [5m]))
```

---

## Loki vs Elasticsearch: When to Use What?

| Feature                 | Loki                   | Elasticsearch                       |
| ----------------------- | ---------------------- | ----------------------------------- |
| **Full-text search**    | Slower (grep-style)    | Fast (inverted index)               |
| **Cost**                | Much cheaper           | Expensive                           |
| **Complexity**          | Simple                 | Complex cluster                     |
| **Label queries**       | Very fast              | N/A                                 |
| **Grafana integration** | Native                 | Plugin required                     |
| **Best for**            | Cloud-native apps, K8s | Full-text search, complex analytics |

> [!TIP] > **Use Loki when**: You know what you're looking for (by app, service, level)
>
> **Use Elasticsearch when**: You need to search unknown patterns across all logs

---

## 🧠 Knowledge Check

Before hands-on, make sure you understand:

1. **Why doesn't Loki index log content?**

2. **What should you use as labels vs. what should stay in log content?**

3. **What's the difference between `|=` and `| json` in LogQL?**

4. **How is LogQL similar to PromQL?**

---

## ✅ Next: Hands-On!

Now let's:

1. Add Loki to our Docker Compose
2. Update our Node.js app to push logs to Loki
3. Query logs in Grafana

**Ready for the hands-on setup?** Just say yes! 🚀
