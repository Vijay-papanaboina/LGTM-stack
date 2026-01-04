/**
 * ============================================================
 * PROMETHEUS METRICS - Order Service
 * ============================================================
 *
 * TWO LAYERS OF METRICS:
 * 1. Platform Metrics (http_requests_total) - Standardized across all services
 * 2. Business Metrics (orders_total) - Specific to this service's domain
 *
 * This enables both unified dashboards AND domain-specific insights.
 * ============================================================
 */

import client from "prom-client";

const register = new client.Registry();

// Default metrics (CPU, memory, event loop lag)
client.collectDefaultMetrics({ register });

// ============================================================
// PLATFORM METRICS (Standardized across all services)
// ============================================================

// Total HTTP requests - enables `sum by (service)` queries
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "endpoint", "status"],
  registers: [register],
});

// HTTP request duration - enables unified latency dashboards
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "endpoint"],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
  registers: [register],
});

// Active requests gauge
const activeRequests = new client.Gauge({
  name: "active_requests",
  help: "Number of requests currently being processed",
  registers: [register],
});

// ============================================================
// BUSINESS METRICS (Specific to Order Service)
// ============================================================

// Order processing counter
const ordersTotal = new client.Counter({
  name: "orders_total",
  help: "Total orders processed",
  labelNames: ["status"], // status: completed, failed
  registers: [register],
});

// Order processing duration
const orderDuration = new client.Histogram({
  name: "order_duration_seconds",
  help: "Order processing duration in seconds",
  buckets: [0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
  registers: [register],
});

// Active orders being processed
const activeOrders = new client.Gauge({
  name: "active_orders",
  help: "Number of orders currently being processed",
  registers: [register],
});

// ============================================================
// OBSERVABILITY MIDDLEWARE
// ============================================================

function createObservabilityMiddleware(logger) {
  return (req, res, next) => {
    // Skip /metrics to avoid noise
    if (req.path === "/metrics") {
      return next();
    }

    const requestId = Math.random().toString(36).substring(7);
    activeRequests.inc();
    const startTime = Date.now();

    logger.info("Incoming request", {
      request_id: requestId,
      method: req.method,
      path: req.path,
    });

    // Flag to prevent double-decrement
    let decremented = false;
    const cleanup = () => {
      if (!decremented) {
        decremented = true;
        activeRequests.dec();
      }
    };

    res.on("finish", () => {
      const duration = (Date.now() - startTime) / 1000;

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

      const logLevel =
        res.statusCode >= 500
          ? "error"
          : res.statusCode >= 400
          ? "warn"
          : "info";

      logger[logLevel]("Request completed", {
        request_id: requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Math.round(duration * 1000),
      });
    });

    // Handle aborted connections
    res.on("close", () => {
      if (!res.writableEnded) {
        logger.warn("Request aborted by client", {
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
  ordersTotal,
  orderDuration,
  activeOrders,
};
