/**
 * Order Service
 * =============
 * This service processes orders and calls the payment-service.
 *
 * Request Flow:
 * Gateway (sample-app) → Order Service → Payment Service
 *
 * Observability:
 * - TRACES: OpenTelemetry auto-instruments incoming/outgoing HTTP
 * - METRICS: OpenTelemetry auto-instrumentation -> Alloy -> Prometheus
 * - LOGS: Winston -> Alloy -> Loki
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
  activeRequestsGauge.add(1, { service: "order-service" });
  let decremented = false;
  const decrement = () => {
    if (!decremented) {
      decremented = true;
      activeRequestsGauge.add(-1, { service: "order-service" });
    }
  };
  res.on("finish", decrement);
  res.on("close", decrement); // Handles client disconnect
  next();
});

const PORT = 8001;
const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL || "http://payment-service:8002";

// ============================================================
// HEALTH CHECK ENDPOINT (for Kubernetes probes)
// ============================================================

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ============================================================
// HELPER: Simulate processing delay
// ============================================================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = (min, max) => Math.random() * (max - min) + min;

// ============================================================
// API ENDPOINTS
// ============================================================

/**
 * POST /orders
 * Creates a new order and processes payment
 *
 * This endpoint demonstrates distributed tracing:
 * 1. Receives request (span created automatically)
 * 2. Processes order (simulated delay)
 * 3. Calls payment-service (child span created, context propagated)
 * 4. Returns result
 */
app.post("/orders", async (req, res) => {
  try {
    const orderId = `ORD-${Date.now()}`;
    logger.info("Processing order", { order_id: orderId });

    // Simulate order processing
    await sleep(randomDelay(50, 150));

    const orderTotal =
      req.body.total || Math.round(Math.random() * 10000) / 100;

    // Call payment service
    // OpenTelemetry automatically:
    // 1. Creates a span for this HTTP request
    // 2. Adds traceparent header to propagate trace context
    logger.info("Calling payment service", {
      order_id: orderId,
      amount: orderTotal,
    });

    const paymentResponse = await axios.post(
      `${PAYMENT_SERVICE_URL}/payments`,
      {
        orderId: orderId,
        amount: orderTotal,
      }
    );

    const paymentResult = paymentResponse.data;

    logger.info("Order completed", { order_id: orderId, total: orderTotal });

    res.json({
      status: "completed",
      orderId: orderId,
      total: orderTotal,
      payment: paymentResult,
    });
  } catch (error) {
    if (error.response) {
      logger.error("Payment failed", {
        error: error.response.data.error,
      });
      return res.status(error.response.status).json({
        status: "failed",
        error: error.response.data.error || "Payment failed",
      });
    }

    logger.error("Order processing error", { error: error.message });
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  logger.info("Order Service started", {
    port: PORT,
    payment_service: PAYMENT_SERVICE_URL,
  });
});
