/**
 * Chart utility functions — shared by SensorChart and MultiSensorChart
 * Design tokens mirror the HTML design system (SmartFactory Twin)
 */

export const SENSOR_COLORS = [
  'var(--s1, #2155D6)',
  'var(--s2, #E0720D)',
  'var(--s3, #12918C)',
  'var(--s4, #8A4FD6)',
  'var(--s5, #C9357E)',
  'var(--s6, #7A8A12)',
  'var(--s7, #4A5B6C)',
];

export const RANGE_OPTIONS = [
  { label: '1 h',  value: '1h'  },
  { label: '6 h',  value: '6h'  },
  { label: '24 h', value: '24h' },
  { label: '7 j',  value: '7j'  },
  { label: '30 j', value: '30j' },
  { label: 'Perso', value: 'custom' },
];

/** Compute nice Y-axis ticks */
export function niceTicks(min, max, count = 5) {
  const span = max - min || 1;
  const step0 = span / count;
  const p = Math.pow(10, Math.floor(Math.log10(step0)));
  const e = step0 / p;
  const step = (e >= 5 ? 5 : e >= 2 ? 2 : 1) * p;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    ticks.push(parseFloat(v.toFixed(6)));
  }
  return ticks;
}

/** Format X-axis label depending on range */
export function xLabel(ts, rangeMs) {
  const d = new Date(ts);
  if (rangeMs > 2 * 86400e3) {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Convert data points to SVG polyline string */
export function toPolyline(pts, xScale, yScale) {
  return pts
    .filter(([, v]) => v != null)
    .map(([t, v]) => `${xScale(t)},${yScale(v)}`)
    .join(' ');
}

/** Find anomaly segments (value > threshold) */
export function anomalySegments(pts, threshold) {
  const segments = [];
  let start = null;
  for (let i = 0; i < pts.length; i++) {
    const [t, v] = pts[i];
    if (v != null && v > threshold) {
      if (start === null) start = t;
    } else {
      if (start !== null) {
        segments.push([start, pts[i - 1][0]]);
        start = null;
      }
    }
  }
  if (start !== null) segments.push([start, pts[pts.length - 1][0]]);
  return segments;
}

/** Download chart SVG element as PNG (UC-15) */
export async function exportChartPNG(svgEl, filename = 'chart.png') {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const img  = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width  = svgEl.clientWidth  * 2;
  canvas.height = svgEl.clientHeight * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/** Build CSV string from sensor series (UC-15) */
export function buildSensorCSV(series, sensors) {
  const header = ['timestamp_utc', ...sensors.map((s) => `${s.name}_${s.unit}`)];
  // Collect all timestamps
  const allTs = [...new Set(
    Object.values(series).flatMap((pts) => pts.map(([t]) => t))
  )].sort((a, b) => a - b);

  const rows = allTs.map((ts) => {
    const row = [new Date(ts).toISOString()];
    sensors.forEach((s) => {
      const pts = series[s.id] ?? [];
      const pt  = pts.find(([t]) => t === ts);
      row.push(pt ? pt[1].toFixed(s.decimals ?? 2) : '');
    });
    return row;
  });

  return [header, ...rows].map((r) => r.join(';')).join('\n');
}
