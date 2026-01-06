/**
 * ============================================================
 * OPENTELEMETRY INSTRUMENTATION - Gateway Service
 * ============================================================
 *
 * IMPORTANT: This file MUST be loaded BEFORE any other imports!
 * OpenTelemetry works by "monkey-patching" Node.js modules.
 *
 * This unified setup handles:
 * - TRACES: Auto-instrumented HTTP requests sent to Alloy → Tempo
 * - METRICS: Auto-instrumented + default metrics sent to Alloy → Prometheus
 *
 * DATA FLOW:
 * Your App → OpenTelemetry SDK → OTLP Exporter → Alloy → Tempo/Prometheus
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

// Alloy's OTLP HTTP endpoint (set via docker-compose environment)
const OTLP_ENDPOINT = process.env.OTLP_ENDPOINT || "http://alloy:4318";

// ============================================================
// TRACE EXPORTER
// ============================================================

const traceExporter = new OTLPTraceExporter({
  url: `${OTLP_ENDPOINT}/v1/traces`,
});

// ============================================================
// METRIC EXPORTER
// ============================================================

const metricExporter = new OTLPMetricExporter({
  url: `${OTLP_ENDPOINT}/v1/metrics`,
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 5000, // Export every 5 seconds
});

// ============================================================
// SDK CONFIGURATION
// ============================================================

const sdk = new NodeSDK({
  resource: new Resource({
    [SERVICE_NAME]: "gateway",
    [SERVICE_VERSION]: "1.0.0",
  }),

  traceExporter: traceExporter,
  metricReader: metricReader,

  // Auto-instrumentation: Automatically creates spans AND metrics for HTTP
  // This provides default metrics like http.server.duration, http.server.request.size
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

// ============================================================
// START TRACING & METRICS
// ============================================================

sdk.start();

// ============================================================
// CUSTOM METRICS - Active Requests Gauge
// ============================================================
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("gateway");
const activeRequestsGauge = meter.createUpDownCounter("http_active_requests", {
  description: "Number of active HTTP requests being processed",
});

console.log("📊 OpenTelemetry initialized for gateway (sample-app)");
console.log(`   Sending telemetry to: ${OTLP_ENDPOINT}`);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("OpenTelemetry terminated"))
    .catch((error) => console.log("Error terminating OpenTelemetry", error))
    .finally(() => process.exit(0));
});

export default sdk;
export { activeRequestsGauge };
