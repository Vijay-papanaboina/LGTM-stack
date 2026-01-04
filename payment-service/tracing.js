/**
 * ============================================================
 * OPENTELEMETRY TRACING - Payment Service (Leaf Node)
 * ============================================================
 *
 * CRITICAL: This file MUST be loaded BEFORE any other imports!
 *
 * This is the LEAF SERVICE in our trace chain:
 * Gateway → Order Service → Payment Service (here - no further calls)
 *
 * The traceparent header arrives from order-service.
 * We create the final child span, completing the trace.
 * In Grafana, this appears as the innermost/deepest span.
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
const OTLP_ENDPOINT =
  process.env.OTLP_ENDPOINT || "http://tempo:4318/v1/traces";

// ============================================================
// TRACE EXPORTER - sends traces to Tempo
// ============================================================
const traceExporter = new OTLPTraceExporter({
  url: OTLP_ENDPOINT,
});

// ============================================================
// SDK CONFIGURATION
// ============================================================
const sdk = new NodeSDK({
  // Resource: Identifies this service in Grafana trace view
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "payment-service",
    [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
  }),
  traceExporter: traceExporter,
  // Auto-instrumentation patches express, http, etc.
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();

console.log("📊 OpenTelemetry initialized for payment-service");
console.log(`   Sending traces to: ${OTLP_ENDPOINT}`);

// ============================================================
// GRACEFUL SHUTDOWN - flush pending traces before exit
// ============================================================
process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("Tracing terminated"))
    .catch((error) => console.log("Error terminating tracing", error))
    .finally(() => process.exit(0));
});

export default sdk;
