/**
 * Web Vitals dev-mode reporter (PERF-01).
 * Per D-21: console.table only, no UI overlay.
 * Per Pitfall E: this module is lazy-imported via requestIdleCallback
 * so its initialization can never regress the LCP it is measuring.
 */
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

export function bootPerfMetrics() {
  if (!import.meta.env.DEV) return; // D-21: dev-only, production builds skip entirely

  const metrics = {};
  const render = () => console.table(metrics);

  const track = (metric) => {
    metrics[metric.name] = {
      value: +metric.value.toFixed(2),
      rating: metric.rating,
      delta: +metric.delta.toFixed(2),
      id: metric.id.slice(0, 12),
    };
    render();
  };

  onLCP(track);
  onINP(track);
  onCLS(track);
  onFCP(track);
  onTTFB(track);
}
