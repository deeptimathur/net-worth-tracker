"use client";

import { useEffect, useRef, useState } from "react";
import type { GrowthPoint } from "@/lib/inflation";
import { formatMoney } from "@/lib/money";

const H = 240;
const M = { top: 14, right: 16, bottom: 28, left: 64 };

const monthLabel = (m: string, long = false) =>
  new Date(`${m}T00:00:00Z`).toLocaleDateString("en-US", { month: long ? "long" : "short", year: "numeric", timeZone: "UTC" });

/** "Nice" round tick values covering [min, max]. */
function ticks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

export function GrowthChart({ points, currency, inflationLabel }: { points: GrowthPoint[]; currency: string; inflationLabel: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  // null until measured on the client; number formatting can differ between server and browser ICU data.
  const [width, setWidth] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (width === null) return <div ref={wrap} style={{ height: H + 26 }} />;

  const values = points.flatMap((p) => (p.baseline === null ? [p.value] : [p.value, p.baseline]));
  const yTicks = ticks(Math.min(0, ...values), Math.max(...values));
  const y0 = yTicks[0];
  const y1 = yTicks[yTicks.length - 1];
  const innerW = width - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  // Place points by date, not index, so sparse past entries keep honest spacing.
  const t = points.map((p) => Number(p.month.slice(0, 4)) * 12 + Number(p.month.slice(5, 7)));
  const span = t[t.length - 1] - t[0];
  const x = (i: number) => M.left + (span === 0 ? innerW / 2 : ((t[i] - t[0]) / span) * innerW);
  const y = (v: number) => M.top + innerH - ((v - y0) / (y1 - y0 || 1)) * innerH;
  const path = (get: (p: GrowthPoint) => number | null) =>
    points
      .map((p, i) => (get(p) === null ? "" : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(get(p)!).toFixed(1)}`))
      .join("");
  const compact = (v: number) =>
    new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);

  // Label points left to right, skipping any that would crowd the previous label or the last one.
  const labelled = new Set<number>([points.length - 1]);
  let lastX = -Infinity;
  points.forEach((_, i) => {
    if (x(i) - lastX >= 80 && x(points.length - 1) - x(i) >= 80) {
      labelled.add(i);
      lastX = x(i);
    }
  });
  const h = hover === null ? null : points[hover];

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <div className="row small" style={{ marginBottom: 6 }} aria-hidden>
        <span className="row" style={{ gap: 6 }}>
          <svg width="18" height="8">
            <line x1="0" x2="18" y1="4" y2="4" stroke="var(--accent)" strokeWidth="2" />
          </svg>
          Net worth
        </span>
        <span className="row" style={{ gap: 6 }}>
          <svg width="18" height="8">
            <line x1="0" x2="18" y1="4" y2="4" stroke="var(--muted)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          Kept pace with {inflationLabel}
        </span>
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Net worth in ${currency} over time compared with inflation`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
          let best = 0;
          points.forEach((_, i) => {
            if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
          });
          setHover(best);
        }}
        style={{ display: "block", overflow: "visible", touchAction: "pan-y" }}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--muted)">
              {compact(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          labelled.has(i) ? (
            <text key={p.month} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {monthLabel(p.month)}
            </text>
          ) : null,
        )}
        <path d={path((p) => p.baseline)} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 4" />
        <path d={path((p) => p.value)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {points.length <= 24 &&
          points.map((p, i) => (
            <circle key={p.month} cx={x(i)} cy={y(p.value)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          ))}
        {h && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} stroke="var(--muted)" strokeWidth="1" />
            {h.baseline !== null && (
              <circle cx={x(hover)} cy={y(h.baseline)} r="4" fill="var(--muted)" stroke="var(--surface)" strokeWidth="2" />
            )}
            <circle cx={x(hover)} cy={y(h.value)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="card small"
          style={{
            position: "absolute",
            top: 28,
            left: Math.min(Math.max(0, x(hover) + 12), width - 200),
            width: 190,
            padding: "8px 10px",
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgb(0 0 0 / 0.12)",
          }}
        >
          <strong>{monthLabel(h.month, true)}</strong>
          <div>Net worth: {formatMoney(h.value, currency, { compact: true })}</div>
          {h.baseline !== null && <div className="muted">Inflation pace: {formatMoney(h.baseline, currency, { compact: true })}</div>}
        </div>
      )}
    </div>
  );
}
