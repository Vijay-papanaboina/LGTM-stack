/**
 * ============================================================
 * OPENTELEMETRY INSTRUMENTATION - Payment Service
 * ============================================================
 *
 * CRITICAL: This file MUST be loaded BEFORE any other imports!
 *
 * This is the final service in the tracing chain.
 * trace: gateway → order-service → payment-service (this)
 *
 * This unified setup handles:
 * - TRACES: Auto-instrumented HTTP requests sent to Alloy → Tempo
 * - METRICS: Auto-instrumented metrics sent to Alloy → Prometheus
 * ============================================================
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";

// Semantic convention constants (using strings directly for ESM/CJS compatibility)
const SERVICE_NAME = "service.name";
const SERVICE_VERSION = "service.version";

// ============================================================
// CONFIGURATION
// ============================================================

const OTLP_ENDPOINT = process.env.OTLP_ENDPOINT || "http://alloy:4318";

// ============================================================
// EXPORTERS
// ============================================================

const traceExporter = new OTLPTraceExporter({
  url: `${OTLP_ENDPOINT}/v1/traces`,
});

const metricExporter = new OTLPMetricExporter({
  url: `${OTLP_ENDPOINT}/v1/metrics`,
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 5000,
});

// ============================================================
// SDK CONFIGURATION
// ============================================================

const sdk = new NodeSDK({
  resource: new Resource({
    [SERVICE_NAME]: "payment-service",
    [SERVICE_VERSION]: "1.0.0",
  }),

  traceExporter: traceExporter,
  metricReader: metricReader,

  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

// Start the SDK
sdk.start();

// ============================================================
// CUSTOM METRICS - Active Requests Gauge
// ============================================================
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("payment-service");
const activeRequestsGauge = meter.createUpDownCounter("http_active_requests", {
  description: "Number of active HTTP requests being processed",
});

console.log("📊 OpenTelemetry initialized for payment-service");
console.log(`   Sending telemetry to: ${OTLP_ENDPOINT}`);

// Graceful shutdown
process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("OpenTelemetry terminated"))
    .catch((error) => console.log("Error terminating OpenTelemetry", error))
    .finally(() => process.exit(0));
});

export default sdk;
export { activeRequestsGauge };
