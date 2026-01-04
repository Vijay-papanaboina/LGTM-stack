/**
 * ============================================================
 * WINSTON LOGGER - Order Service
 * ============================================================
 *
 * Structured JSON logging for Order Service.
 * Logs flow: Console → Docker → Promtail → Loki → Grafana
 * ============================================================
 */

import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    app: "order-service",
    env: process.env.NODE_ENV || "development",
  },
  transports: [new winston.transports.Console()],
});

export default logger;
