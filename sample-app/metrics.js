/**
 * ============================================================
 * PROMETHEUS METRICS MODULE
 * ============================================================
 *
 * WHY PROMETHEUS METRICS:
 * - Pull-based: Prometheus scrapes /metrics endpoint (simpler than push)
 * - Dimensional: Labels allow slicing data (by endpoint, status, method)
 * - Efficient: Counters/histograms are cheap to update
 *
 * THE THREE METRIC TYPES WE USE:
 * 1. Counter - Only goes up (total requests, errors)
 * 2. Histogram - Distribution of values (latency percentiles)
 * 3. Gauge - Can go up/down (active connections, queue size)
 *
 * DATA FLOW:
 * App updates metrics → Prometheus scrapes /metrics → Grafana queries PromQL
 * ============================================================
 */

import client from "prom-client";

// Registry holds all metrics - exposed at /metrics endpoint
const register = new client.Registry();

// Default metrics: CPU, memory, event loop lag, GC stats
// These help identify if performance issues are app-level or system-level
client.collectDefaultMetrics({ register });

// ============================================================
// CUSTOM METRICS DEFINITIONS
// ============================================================

// COUNTER: Total requests - the "R" in RED metrics (Rate)
// Use rate(http_requests_total[5m]) to get requests/second
// Labels let you filter: rate(http_requests_total{status="500"}[5m])
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "endpoint", "status"],
  registers: [register],
});

// HISTOGRAM: Request duration - the "D" in RED metrics (Duration)
// Buckets define the ranges for counting (how many requests took 0-10ms, 10-25ms, etc.)
// Use histogram_quantile(0.95, ...) to get p95 latency
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "endpoint"],
  // Buckets chosen to capture fast (10ms) to slow (10s) requests
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
  registers: [register],
});

// GAUGE: Current number of active requests (can go up/down)
const activeRequests = new client.Gauge({
  name: "active_requests",
  help: "Number of requests currently being processed",
  registers: [register],
});

// GAUGE: Application info
const appInfo = new client.Gauge({
  name: "app_info",
  help: "Application information",
  labelNames: ["version", "environment", "nodejs_version"],
  registers: [register],
});

// Set app info once
appInfo.labels("1.0.0", "development", process.version).set(1);

/**
 * OBSERVABILITY MIDDLEWARE FACTORY
 *
 * WHY A FACTORY FUNCTION:
 * - Allows injecting the logger (dependency injection)
 * - Makes testing easier (can pass mock logger)
 * - Decouples metrics from logging implementation
 *
 * WHAT THIS MIDDLEWARE DOES:
 * 1. Generates request ID for correlation across logs/traces
 * 2. Tracks timing from request start to response end
 * 3. Records Prometheus metrics (counter, histogram, gauge)
 * 4. Logs request details with appropriate level (info/warn/error)
 */
function createObservabilityMiddleware(logger) {
  return (req, res, next) => {
    // Skip internal endpoints to avoid noise in metrics
    if (req.path === "/metrics" || req.path === "/health") {
      return next();
    }

    // Generate a request ID for tracing
    const requestId = Math.random().toString(36).substring(7);

    // Track active requests
    activeRequests.inc();

    // Start timing
    const startTime = Date.now();

    // Log incoming request
    logger.info(`Incoming request`, {
      request_id: requestId,
      method: req.method,
      path: req.path,
    });

    // Flag to prevent double-decrement
    // (both 'finish' and 'close' can fire in normal completion)
    let decremented = false;

    // Helper to safely decrement gauge
    const cleanup = () => {
      if (!decremented) {
        decremented = true;
        activeRequests.dec();
      }
    };

    // When response finishes successfully
    res.on("finish", () => {
      const duration = (Date.now() - startTime) / 1000;
      const durationMs = Math.round(duration * 1000);

      // Record metrics
      httpRequestsTotal.inc({
        method: req.method,
        endpoint: req.path,
        status: res.statusCode,
      });

      httpRequestDuration.observe(
        { method: req.method, endpoint: req.path },
        duration
      );

      cleanup();

      // Log completed request
      const logLevel =
        res.statusCode >= 500
          ? "error"
          : res.statusCode >= 400
          ? "warn"
          : "info";

      logger[logLevel](`Request completed`, {
        request_id: requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: durationMs,
        ...(req.errorInfo || {}), // Include error details if present
      });
    });

    // CRITICAL: 'close' fires when connection is closed (even if aborted!)
    // This prevents the gauge from getting stuck when client disconnects
    res.on("close", () => {
      if (!res.writableEnded) {
        // Response was aborted before completion
        logger.warn(`Request aborted by client`, {
          request_id: requestId,
          method: req.method,
          path: req.path,
        });
      }
      cleanup();
    });

    next();
  };
}

export {
  register,
  createObservabilityMiddleware,
  httpRequestsTotal,
  httpRequestDuration,
  activeRequests,
};
