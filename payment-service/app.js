/**
 * Payment Service
 * ================
 * This is the final service in our tracing chain.
 * It simulates payment processing with success/failure scenarios.
 *
 * Request Flow:
 * Gateway → Order Service → Payment Service (this)
 *
 * This service:
 * - Receives payment requests from order-service
 * - Simulates payment processing
 * - Returns success or failure
 * - The trace shows this as the innermost span
 */

// Load tracing FIRST!
import "./tracing.js";

import express from "express";
import logger from "./logger.js";
import {
  register,
  createObservabilityMiddleware,
  paymentsTotal,
  paymentDuration,
  activePayments,
} from "./metrics.js";

const app = express();
app.use(express.json());

// Use standardized observability middleware (logs + platform metrics)
app.use(createObservabilityMiddleware(logger));

const PORT = 8002;

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
  res.json({ status: "ok", service: "payment-service" });
});

/**
 * POST /payments
 * Processes a payment
 *
 * In the trace, this appears as the innermost span:
 * gateway → order-service → payment-service (this span)
 */
app.post("/payments", async (req, res) => {
  const startTime = Date.now();
  activePayments.inc();

  const { orderId, amount } = req.body;
  const paymentId = `PAY-${Date.now()}`;

  logger.info("Processing payment", {
    payment_id: paymentId,
    order_id: orderId,
    amount: amount,
  });

  // Simulate payment processing (this is where the real payment gateway call would be)
  await sleep(randomDelay(100, 300));

  // Simulate occasional payment failures (10% chance)
  if (Math.random() < 0.1) {
    logger.warn("Payment declined", {
      payment_id: paymentId,
      order_id: orderId,
    });
    paymentsTotal.labels("declined").inc();
    activePayments.dec();
    paymentDuration.observe((Date.now() - startTime) / 1000);

    return res.status(400).json({
      status: "declined",
      paymentId: paymentId,
      orderId: orderId,
      error: "Card declined",
    });
  }

  logger.info("Payment approved", { payment_id: paymentId, order_id: orderId });
  paymentsTotal.labels("approved").inc();
  activePayments.dec();
  paymentDuration.observe((Date.now() - startTime) / 1000);

  res.json({
    status: "approved",
    paymentId: paymentId,
    orderId: orderId,
    amount: amount,
    processedAt: new Date().toISOString(),
  });
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
  logger.info("Payment Service started", { port: PORT });
});
