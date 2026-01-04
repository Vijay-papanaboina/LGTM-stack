/**
 * ============================================================
 * OPENTELEMETRY TRACING SETUP - Gateway Service
 * ============================================================
 *
 * WHY THIS FILE EXISTS:
 * This file initializes distributed tracing for the entire application.
 * It MUST be loaded before ANY other imports because OpenTelemetry works
 * by "monkey-patching" Node.js modules (http, express, fetch, etc.).
 * If you import express before this file runs, tracing won't work!
 *
 * HOW AUTO-INSTRUMENTATION WORKS:
 * 1. This file loads first (require("./tracing") at top of app.js)
 * 2. OpenTelemetry patches Node's require() function
 * 3. When you later import express/fetch/etc., they get wrapped
 * 4. Every HTTP request automatically creates spans with timing
 * 5. Outgoing HTTP calls automatically propagate trace context
 *
 * WHAT GETS TRACED AUTOMATICALLY:
 * - Incoming HTTP requests (express routes)
 * - Outgoing HTTP requests (fetch, http.request)
 * - Database queries (if using pg, mysql, redis, etc.)
 * - Many other libraries (see: @opentelemetry/auto-instrumentations-node)
 *
 * DATA FLOW:
 * Your App → OpenTelemetry SDK → OTLP Exporter → Tempo → Grafana
 * ============================================================
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

// ============================================================
// CONFIGURATION
// ============================================================

// Tempo's OTLP HTTP endpoint (set via docker-compose environment)
// Using HTTP instead of gRPC because it's easier to debug and works through proxies
const OTLP_ENDPOINT =
  process.env.OTLP_ENDPOINT || "http://tempo:4318/v1/traces";

// ============================================================
// TRACE EXPORTER
// ============================================================
// Exports traces to Tempo using OTLP (OpenTelemetry Protocol)
// OTLP is the standard wire format - works with Tempo, Jaeger, Datadog, etc.

const traceExporter = new OTLPTraceExporter({
  url: OTLP_ENDPOINT,
  // Optional: Add custom headers for auth (not needed for local Tempo)
  // headers: { "Authorization": "Bearer xxx" },
});

// ============================================================
// SDK CONFIGURATION
// ============================================================

const sdk = new NodeSDK({
  // Resource: Identifies this service in traces
  // Every span from this app will have these attributes
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "gateway", // Shows as "gateway" in Tempo
    [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
    // You can add more: environment, team, region, etc.
  }),

  // Where to send traces
  traceExporter: traceExporter,

  // Auto-instrumentation: Automatically trace common libraries
  // This is the magic - no manual span creation needed for HTTP, DB, etc.
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable file system instrumentation - too noisy, not useful
      "@opentelemetry/instrumentation-fs": { enabled: false },
      // You can configure specific instrumentations here
      // "@opentelemetry/instrumentation-http": { ... }
    }),
  ],
});

// ============================================================
// START TRACING
// ============================================================

sdk.start();

console.log("📊 OpenTelemetry initialized for gateway (sample-app)");
console.log(`   Sending traces to: ${OTLP_ENDPOINT}`);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
// Ensures all pending traces are flushed before the process exits
// Without this, you might lose traces when the container stops

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("Tracing terminated"))
    .catch((error) => console.log("Error terminating tracing", error))
    .finally(() => process.exit(0));
});

export default sdk;
