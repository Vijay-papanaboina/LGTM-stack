/**
 * Payment Service
 * ================
 * This is the final service in our tracing chain.
 * It simulates payment processing with success/failure scenarios.
 *
 * Request Flow:
 * Gateway → Order Service → Payment Service (this)
 *
 * Observability:
 * - TRACES: OpenTelemetry auto-instrumentation -> Alloy -> Tempo
 * - METRICS: OpenTelemetry auto-instrumentation -> Alloy -> Prometheus
 * - LOGS: Winston -> Alloy -> Loki
 */

// Load tracing FIRST!
import { activeRequestsGauge } from "./tracing.js";

import express from "express";
import logger from "./logger.js";

const app = express();
app.use(express.json());

// Active requests tracking middleware
app.use((req, res, next) => {
  activeRequestsGauge.add(1, { service: "payment-service" });
  let decremented = false;
  const decrement = () => {
    if (!decremented) {
      decremented = true;
      activeRequestsGauge.add(-1, { service: "payment-service" });
    }
  };
  res.on("finish", decrement);
  res.on("close", decrement); // Handles client disconnect
  next();
});

const PORT = 8002;

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
 * POST /payments
 * Processes a payment
 *
 * In the trace, this appears as the innermost span:
 * gateway → order-service → payment-service (this span)
 */
app.post("/payments", async (req, res) => {
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

    return res.status(400).json({
      status: "declined",
      paymentId: paymentId,
      orderId: orderId,
      error: "Card declined",
    });
  }

  logger.info("Payment approved", { payment_id: paymentId, order_id: orderId });

  res.json({
    status: "approved",
    paymentId: paymentId,
    orderId: orderId,
    amount: amount,
    processedAt: new Date().toISOString(),
  });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  logger.info("Payment Service started", { port: PORT });
});
