/**
 * Sample Express Application with Observability
 * ==============================================
 *
 * Instrumented with:
 * - METRICS (Prometheus) - see metrics.js
 * - LOGS (Winston -> Promtail -> Loki)
 * - TRACES (OpenTelemetry -> Tempo)
 */

// ============================================================
// IMPORTANT: Load tracing FIRST before any other imports!
// ============================================================
import "./tracing.js";

import express from "express";
import axios from "axios";
import logger from "./logger.js";
import { register, createObservabilityMiddleware } from "./metrics.js";

const app = express();
app.use(express.json());

const PORT = 8000;
const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://order-service:8001";

// Use observability middleware
app.use(createObservabilityMiddleware(logger));

// ============================================================
// HELPER: Simulate random delay
// ============================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = (min, max) => Math.random() * (max - min) + min;

// ============================================================
// API ENDPOINTS
// ============================================================

app.get("/", async (req, res) => {
  res.json({
    message: "Welcome to the LGTM Sample App! 🚀",
    endpoints: {
      "/": "This page",
      "/api/fast": "Fast endpoint (~10-50ms)",
      "/api/slow": "Slow endpoint (200ms-2s)",
      "/api/error": "Always returns 500",
      "/api/order":
        "POST - Creates order (calls order-service → payment-service)",
      "/metrics": "Prometheus metrics",
    },
  });
});

app.get("/api/fast", async (req, res) => {
  await sleep(randomDelay(10, 50));
  res.json({ status: "ok", type: "fast" });
});

app.get("/api/slow", async (req, res) => {
  const delay = randomDelay(200, 2000);

  if (delay > 1500) {
    logger.warn("Slow operation taking longer than expected", {
      delay_ms: Math.round(delay),
    });
  }

  await sleep(delay);
  res.json({ status: "ok", type: "slow", delay_ms: Math.round(delay) });
});

app.get("/api/error", async (req, res) => {
  await sleep(randomDelay(10, 100));

  const errorId = Math.random().toString(36).substring(7);

  // Attach error info to request for middleware to log
  req.errorInfo = {
    error_type: "RandomFailure",
    error_message: "Random failure occurred",
    error_id: errorId,
  };

  res.status(500).json({
    status: "error",
    message: "Random failure!",
    error_id: errorId,
  });
});

/**
 * POST /api/order
 * Creates an order by calling order-service
 *
 * This demonstrates distributed tracing:
 * 1. Gateway receives request (root span)
 * 2. Gateway calls order-service (child span, context propagated)
 * 3. Order-service calls payment-service (grandchild span)
 * 4. Full trace visible in Grafana!
 */
app.post("/api/order", async (req, res) => {
  try {
    console.log("📦 Received order request, forwarding to order-service...");

    // Call order service
    // OpenTelemetry automatically propagates trace context via headers
    // Using axios because native fetch is not fully supported by default Node OTel
    const response = await axios.post(
      `${ORDER_SERVICE_URL}/orders`,
      req.body || { total: 99.99 }
    );
    const result = response.data;

    // Axios throws on non-2xx status, so we don't need manual check here
    console.log("✅ Order completed:", result.orderId);
    res.json(result);
  } catch (error) {
    if (error.response) {
      // Axios error with response from server
      return res.status(error.response.status).json(error.response.data);
    }
    console.error("Order error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  logger.info("Application started", { port: PORT });
  console.log("");
  console.log("🚀 Sample App started!");
  console.log(`📊 App:     http://localhost:${PORT}`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log("📝 Logs:    Console -> Promtail -> Loki");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Shutting down gracefully");
  process.exit(0);
});
