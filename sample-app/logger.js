/**
 * ============================================================
 * WINSTON LOGGER - Structured JSON Logging
 * ============================================================
 *
 * WHY WINSTON:
 * - Industry standard for Node.js logging
 * - Outputs structured JSON (machine-parseable, not just text)
 * - Supports log levels (info, warn, error, debug)
 * - Easily extensible with transports (console, file, remote)
 *
 * WHY JSON FORMAT:
 * Text logs: "2024-01-04 User john logged in"
 *   → Hard to parse, search, or filter programmatically
 *
 * JSON logs: {"timestamp":"...", "user":"john", "action":"login"}
 *   → Easy to parse, filter by any field, aggregate in dashboards
 *
 * HOW LOGS FLOW TO LOKI:
 * 1. Winston outputs JSON to console (stdout)
 * 2. Docker captures container stdout
 * 3. Promtail reads Docker log files
 * 4. Promtail parses JSON, extracts labels (level, app)
 * 5. Promtail pushes to Loki
 * 6. Grafana queries Loki with LogQL
 *
 * WHY NOT PUSH DIRECTLY TO LOKI:
 * - Adds complexity to your app (HTTP client, retry logic, batching)
 * - If Loki is down, your app might crash or lose logs
 * - Promtail handles all this + adds container metadata automatically
 * ============================================================
 */

import winston from "winston";

// ============================================================
// LOGGER CONFIGURATION
// ============================================================

const logger = winston.createLogger({
  // Default log level (info and above: info, warn, error)
  // In production, you might set this from env var
  level: process.env.LOG_LEVEL || "info",

  // Format: Combine multiple formatters
  format: winston.format.combine(
    // Add ISO timestamp to every log
    // This is used by Promtail for ordering and by you for debugging
    winston.format.timestamp(),

    // Output as JSON (required for Promtail to parse)
    winston.format.json()
  ),

  // Default metadata added to EVERY log entry
  // This creates consistent labels for filtering in Loki
  defaultMeta: {
    app: "gateway", // Used in LogQL: {app="gateway"}
    env: process.env.NODE_ENV || "development",
  },

  // Where to send logs
  transports: [
    // Console transport: Write to stdout
    // Docker captures this, Promtail reads from Docker
    new winston.transports.Console(),

    // You could add more transports:
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.Http({ host: 'logstash', port: 5000 }),
  ],
});

// ============================================================
// USAGE EXAMPLES (for reference)
// ============================================================
// logger.info("User logged in", { user_id: "123", ip: "1.2.3.4" });
// logger.warn("Rate limit approaching", { current: 95, max: 100 });
// logger.error("Payment failed", { order_id: "ORD-123", error: "Card declined" });

export default logger;
