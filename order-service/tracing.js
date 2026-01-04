/**
 * ============================================================
 * OPENTELEMETRY TRACING - Order Service
 * ============================================================
 *
 * CRITICAL: This file MUST be loaded BEFORE any other imports!
 *
 * CONTEXT PROPAGATION (the magic of distributed tracing):
 * When gateway calls us, it includes a "traceparent" HTTP header.
 * OpenTelemetry automatically extracts this and creates a CHILD span.
 * When we call payment-service, we automatically ADD this header.
 * Result: All 3 services appear in ONE trace in Grafana!
 *
 * Without this, each service would create separate traces.
 * ============================================================
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

// ============================================================
// CONFIGURE THE OPENTELEMETRY SDK
// ============================================================

// Where to send traces (Tempo's OTLP HTTP endpoint)
const OTLP_ENDPOINT =
  process.env.OTLP_ENDPOINT || "http://tempo:4318/v1/traces";

// Create the trace exporter
// This sends traces to Tempo via HTTP
const traceExporter = new OTLPTraceExporter({
  url: OTLP_ENDPOINT,
});

// Create the SDK with auto-instrumentation
// Auto-instrumentation automatically creates spans for:
// - Incoming HTTP requests
// - Outgoing HTTP requests (fetch, http.request)
// - Express middleware and routes
// - Many more libraries!
const sdk = new NodeSDK({
  // Resource identifies this service in traces
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "order-service",
    [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
  }),

  // Export traces to Tempo
  traceExporter: traceExporter,

  // Auto-instrument common libraries
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable some noisy instrumentations
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

// Start the SDK
sdk.start();

console.log("📊 OpenTelemetry initialized for order-service");
console.log(`   Sending traces to: ${OTLP_ENDPOINT}`);

// Graceful shutdown
process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("Tracing terminated"))
    .catch((error) => console.log("Error terminating tracing", error))
    .finally(() => process.exit(0));
});

export default sdk;
