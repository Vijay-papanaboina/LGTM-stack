/**
 * Order Service
 * =============
 * This service processes orders and calls the payment-service.
 *
 * Request Flow:
 * Gateway (sample-app) → Order Service → Payment Service
 *
 * Tracing:
 * - OpenTelemetry auto-instruments incoming HTTP requests
 * - When we call payment-service, the trace context is automatically propagated
 * - This creates a chain of spans showing the full request journey
 */

// ============================================================
// IMPORTANT: Load tracing FIRST before any other imports!
// ============================================================
import "./tracing.js";

import express from "express";
import axios from "axios";
import logger from "./logger.js";
import {
  register,
  createObservabilityMiddleware,
  ordersTotal,
  orderDuration,
  activeOrders,
} from "./metrics.js";

const app = express();
app.use(express.json());

// Use standardized observability middleware (logs + platform metrics)
app.use(createObservabilityMiddleware(logger));

const PORT = 8001;
const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL || "http://payment-service:8002";

// ============================================================
// HELPER: Simulate processing delay
// ============================================================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = (min, max) => Math.random() * (max - min) + min;

// ============================================================
// API ENDPOINTS
// ============================================================

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "order-service" });
});

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
  const startTime = Date.now();
  activeOrders.inc();

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
    ordersTotal.labels("completed").inc();
    activeOrders.dec();
    orderDuration.observe((Date.now() - startTime) / 1000);

    res.json({
      status: "completed",
      orderId: orderId,
      total: orderTotal,
      payment: paymentResult,
    });
  } catch (error) {
    if (error.response) {
      logger.error("Payment failed", {
        order_id: "unknown", // we might lose context here if error happens early
        error: error.response.data.error,
      });
      ordersTotal.labels("failed").inc();
      activeOrders.dec();
      orderDuration.observe((Date.now() - startTime) / 1000);
      return res.status(error.response.status).json({
        status: "failed",
        error: error.response.data.error || "Payment failed",
      });
    }

    logger.error("Order processing error", { error: error.message });
    ordersTotal.labels("failed").inc();
    activeOrders.dec();
    orderDuration.observe((Date.now() - startTime) / 1000);
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// Metrics endpoint for Prometheus
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
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
