/**
 * Sample Express Application with Observability
 * ==============================================
 *
 * Instrumented with:
 * - METRICS (OpenTelemetry auto-instrumentation -> Alloy -> Prometheus)
 * - LOGS (Winston -> Alloy -> Loki)
 * - TRACES (OpenTelemetry -> Alloy -> Tempo)
 */

// ============================================================
// IMPORTANT: Load tracing FIRST before any other imports!
// ============================================================
import { activeRequestsGauge } from "./tracing.js";

import express from "express";
import axios from "axios";
import logger from "./logger.js";

const app = express();
app.use(express.json());

// Active requests tracking middleware
app.use((req, res, next) => {
  activeRequestsGauge.add(1, { service: "gateway" });
  let decremented = false;
  const decrement = () => {
    if (!decremented) {
      decremented = true;
      activeRequestsGauge.add(-1, { service: "gateway" });
    }
  };
  res.on("finish", decrement);
  res.on("close", decrement); // Handles client disconnect
  next();
});

const PORT = 8000;
const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://order-service:8001";

// ============================================================
// HELPER: Simulate random delay
// ============================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = (min, max) => Math.random() * (max - min) + min;

// ============================================================
// HEALTH CHECK ENDPOINT (for Kubernetes probes)
// ============================================================

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

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
    logger.info("Received order request, forwarding to order-service");

    // Call order service
    // OpenTelemetry automatically propagates trace context via headers
    // Using axios because native fetch is not fully supported by default Node OTel
    const response = await axios.post(
      `${ORDER_SERVICE_URL}/orders`,
      req.body || { total: 99.99 }
    );
    const result = response.data;

    // Axios throws on non-2xx status, so we don't need manual check here
    logger.info("Order completed", { order_id: result.orderId });
    res.json(result);
  } catch (error) {
    if (error.response) {
      // Axios error with response from server
      return res.status(error.response.status).json(error.response.data);
    }
    logger.error("Order error", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  logger.info("Application started", { port: PORT });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Shutting down gracefully");
  process.exit(0);
});
