# Module 2: Prometheus Deep Dive

Now that you understand the "why", let's master the first pillar: **Metrics with Prometheus**.

---

## What is Prometheus?

Prometheus is an open-source **metrics monitoring system** created at SoundCloud in 2012, now a CNCF graduated project (same level as Kubernetes!).

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROMETHEUS                                 │
│                                                                 │
│   "An open-source systems monitoring and alerting toolkit"      │
│                                                                 │
│   Key Features:                                                 │
│   • Multi-dimensional data model                                │
│   • Powerful query language (PromQL)                            │
│   • Pull-based architecture                                     │
│   • Built-in alerting                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Concept #1: Pull vs Push

### Most monitoring systems: PUSH model

```
App ──push──► Monitoring Server

- App is responsible for sending data
- What if app crashes? Data lost!
- Need to configure EACH app with server address
```

### Prometheus: PULL model

```
Prometheus ──scrape──► App's /metrics endpoint

- Prometheus collects ("scrapes") data
- If app is down, Prometheus knows immediately
- Centralized configuration
- Apps just expose an endpoint
```

> [!TIP] > **Why pull is powerful**: If Prometheus can't reach an app, that itself is valuable data! Push systems can't detect this.

### Your App's Job

Your app needs to expose a `/metrics` endpoint:

```
GET /metrics

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/users"} 1234
http_requests_total{method="POST",path="/api/orders"} 567

# HELP http_request_duration_seconds Request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 800
http_request_duration_seconds_bucket{le="0.5"} 950
http_request_duration_seconds_bucket{le="1.0"} 1000
```

This is the **Prometheus exposition format** - we'll learn to generate this!

---

## 🔑 Key Concept #2: Labels (Dimensions)

Labels are key-value pairs that add dimensions to metrics:

```
http_requests_total                          = 1000   ❌ Useless

http_requests_total{method="GET"}            = 800    ✅ Better
http_requests_total{method="POST"}           = 200    ✅ Better

http_requests_total{method="GET", status="200", path="/api/users"} = 750  ✅ Best!
```

### The Power of Labels

One metric name, infinite combinations:

```promql
# All requests
sum(http_requests_total)

# Only GET requests
sum(http_requests_total{method="GET"})

# Only errors
sum(http_requests_total{status=~"5.."})

# Specific endpoint
sum(http_requests_total{path="/api/orders"})
```

> [!CAUTION] > **Cardinality trap!** Every unique label combination creates a new time series.
>
> ❌ BAD: `{user_id="12345"}` - millions of users = millions of series!
>
> ✅ GOOD: `{endpoint="/api/users", method="GET", status="200"}`

---

## 🔑 Key Concept #3: The Four Metric Types

### 1️⃣ Counter

**What:** Value that only goes UP (or resets to 0)

**Use for:**

- Total requests
- Errors count
- Bytes sent

```python
# Example: Count requests
requests_total = Counter('http_requests_total', 'Total requests')

def handle_request():
    requests_total.inc()  # +1
```

```promql
# Rate of requests per second (last 5 min)
rate(http_requests_total[5m])
```

---

### 2️⃣ Gauge

**What:** Value that can go UP or DOWN

**Use for:**

- Current temperature
- Active connections
- Queue size

```python
# Example: Track active connections
active_connections = Gauge('active_connections', 'Current connections')

def on_connect():
    active_connections.inc()  # +1

def on_disconnect():
    active_connections.dec()  # -1
```

```promql
# Current value
active_connections

# Max in last hour
max_over_time(active_connections[1h])
```

---

### 3️⃣ Histogram

**What:** Samples observations and counts them in buckets

**Use for:**

- Request latency
- Response sizes
- Any distribution

```python
# Example: Track request duration
request_duration = Histogram(
    'http_request_duration_seconds',
    'Request duration',
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0]  # Bucket boundaries
)

def handle_request():
    with request_duration.time():  # Auto-measures duration
        do_work()
```

**Buckets explained:**

```
Bucket le="0.1"  → Count of requests ≤ 100ms
Bucket le="0.5"  → Count of requests ≤ 500ms
Bucket le="1.0"  → Count of requests ≤ 1 second
```

```promql
# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

---

### 4️⃣ Summary

**What:** Similar to histogram, calculates quantiles client-side

**Difference from Histogram:**
| | Histogram | Summary |
|---|-----------|---------|
| Aggregatable across instances? | ✅ Yes | ❌ No |
| Accuracy | Approximate | Exact |
| Performance | Better | Worse |
| **Recommendation** | **Use this** | Rare use cases |

> [!IMPORTANT] > **Rule of thumb:** Always prefer Histogram. You can calculate percentiles server-side with PromQL, and histograms can be aggregated across multiple instances.

---

## 🔑 Key Concept #4: Prometheus Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROMETHEUS SERVER                            │
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │   Retrieval  │────────▶│    TSDB      │                     │
│  │   (Scraper)  │         │  (Storage)   │                     │
│  └──────────────┘         └──────────────┘                     │
│         │                        │                              │
│         │                        ▼                              │
│         │                 ┌──────────────┐                     │
│         │                 │  PromQL      │◀──── Grafana        │
│         │                 │  (Query)     │                     │
│         │                 └──────────────┘                     │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │ Alertmanager │───────▶ Slack, PagerDuty, etc.              │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
         │
         │ scrapes
         ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Your App     │  │   Node Exporter │  │  Other Apps     │
│   /metrics      │  │   /metrics      │  │  /metrics       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Components:**

1. **Retrieval (Scraper)**: Pulls metrics from targets at configured intervals
2. **TSDB (Time Series Database)**: Stores metrics efficiently on disk
3. **PromQL Engine**: Query language for analyzing data
4. **Alertmanager**: Handles alerts, deduplication, routing

---

## 🔑 Key Concept #5: Service Discovery

How does Prometheus know what to scrape?

### Option 1: Static config (simple)

```yaml
scrape_configs:
  - job_name: "my-app"
    static_configs:
      - targets: ["app1:8080", "app2:8080"]
```

### Option 2: Dynamic discovery (production)

```yaml
scrape_configs:
  - job_name: "kubernetes-pods"
    kubernetes_sd_configs: # Auto-discover K8s pods!
      - role: pod
```

Prometheus supports discovery for: Kubernetes, EC2, GCE, Consul, DNS, and more!

---

## PromQL: The Query Language

PromQL is what makes Prometheus powerful. Here are the essentials:

### Instant Vector (current values)

```promql
http_requests_total
# Returns: current value for each label combination
```

### Range Vector (values over time)

```promql
http_requests_total[5m]
# Returns: all values from the last 5 minutes
```

### Common Functions

| Function               | Purpose                     | Example                         |
| ---------------------- | --------------------------- | ------------------------------- |
| `rate()`               | Per-second rate of increase | `rate(requests_total[5m])`      |
| `increase()`           | Total increase over time    | `increase(requests_total[1h])`  |
| `sum()`                | Sum across labels           | `sum(requests_total)`           |
| `avg()`                | Average across labels       | `avg(cpu_usage)`                |
| `max()` / `min()`      | Extremes                    | `max(memory_bytes)`             |
| `histogram_quantile()` | Calculate percentiles       | `histogram_quantile(0.95, ...)` |

### Aggregation by Label

```promql
# Total requests per endpoint
sum(rate(http_requests_total[5m])) by (path)

# Average CPU per node
avg(cpu_usage) by (instance)
```

---

## 🧠 Knowledge Check

Before hands-on, make sure you understand:

1. **Why does Prometheus use pull instead of push?**

2. **What's the difference between a Counter and a Gauge?**

3. **When would you use a Histogram?**

4. **What is cardinality and why should you care about it?**

5. **What does `rate(http_requests_total[5m])` return?**

---

## ✅ Next: Hands-On!

Now let's put this into practice:

1. Set up Prometheus with Docker
2. Create a sample app with metrics
3. Write PromQL queries
4. Visualize in Prometheus UI

**Let me know when you're ready for the hands-on setup!** 🚀
