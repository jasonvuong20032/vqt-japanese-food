import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/** "Nice" axis ticks (0, 2, 4... x 10^n) covering 0..max, at most `count` + 1 lines. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export interface SeriesPoint {
  label: string
  value: number
  /** Extra rows for the tooltip (e.g. order count), shown under the value */
  details?: { label: string; value: string }[]
}

/**
 * Single-series area chart for a trend over time: 2px line, 10% wash, hairline grid on clean ticks,
 * crosshair that snaps to the nearest point (pointer and arrow keys), peak marked and labelled.
 * The container includes the x-axis band, so nothing scrolls inside the card.
 */
export function AreaChart({ points, formatValue, formatAxis, ariaLabel, emptyText, height = 240 }: {
  points: SeriesPoint[]
  formatValue: (v: number) => string
  formatAxis: (v: number) => string
  ariaLabel: string
  /** Shown instead of a flat line when every value is zero */
  emptyText?: string
  height?: number
}) {
  const [wrap, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const axisBand = 28
  const left = 56
  const right = 16
  const top = 16
  const plotH = height - axisBand - top
  const plotW = Math.max(0, width - left - right)

  const ticks = useMemo(() => niceTicks(Math.max(...points.map((p) => p.value), 0)), [points])
  const yMax = ticks[ticks.length - 1] || 1
  const x = (i: number) => left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const y = (v: number) => top + plotH - (v / yMax) * plotH

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = points.length ? `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : ''
  const peak = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? -1) ? i : best), 0)
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 70))))

  const pick = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - box.left) / box.width
    setActive(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))))
  }
  const onKey = (e: KeyboardEvent<SVGRectElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setActive((i) => {
        const from = i ?? points.length - 1
        return Math.min(points.length - 1, Math.max(0, from + (e.key === 'ArrowRight' ? 1 : -1)))
      })
    } else if (e.key === 'Escape') setActive(null)
  }

  const shown = active ?? null
  const tooltipLeft = shown === null ? 0 : Math.min(Math.max(x(shown), left + 80), width - 90)

  if (emptyText && points.every((p) => p.value === 0)) {
    return (
      <div className="grid w-full place-items-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground" style={{ height }}>
        <p className="max-w-xs px-4">{emptyText}</p>
      </div>
    )
  }

  return (
    <div ref={wrap} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            // Every Nth date plus the last one; a regular label too close to the last would collide with it
            (i % labelEvery === 0 && points.length - 1 - i >= labelEvery * 0.75) || i === points.length - 1 ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[11px] tabular-nums">
                {p.label}
              </text>
            ) : null,
          )}
          <path d={area} fill="var(--color-chart-1)" fillOpacity={0.1} />
          <path d={line} fill="none" stroke="var(--color-chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* The one direct label: the peak */}
          {points[peak]?.value > 0 ? (
            <g>
              <circle cx={x(peak)} cy={y(points[peak].value)} r={4} fill="var(--color-chart-1)" stroke="var(--color-card)" strokeWidth={2} />
              <text
                x={x(peak)}
                y={y(points[peak].value) - 10}
                textAnchor={peak > points.length * 0.8 ? 'end' : peak < points.length * 0.2 ? 'start' : 'middle'}
                className="fill-foreground text-[11px] font-semibold"
              >
                {formatValue(points[peak].value)}
              </text>
            </g>
          ) : null}

          {shown !== null ? (
            <g pointerEvents="none">
              <line x1={x(shown)} x2={x(shown)} y1={top} y2={y(0)} stroke="var(--color-muted-foreground)" strokeWidth={1} shapeRendering="crispEdges" />
              <circle cx={x(shown)} cy={y(points[shown].value)} r={5} fill="var(--color-chart-1)" stroke="var(--color-card)" strokeWidth={2} />
            </g>
          ) : null}

          <rect
            x={left}
            y={top}
            width={plotW}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label={ariaLabel}
            className="cursor-crosshair outline-none focus-visible:stroke-ring"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((i) => i ?? points.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
          />
        </svg>
      ) : null}

      {shown !== null ? (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltipLeft }}
        >
          <p className="text-muted-foreground">{points[shown].label}</p>
          <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-0.5 w-3 rounded-full bg-chart-1" aria-hidden />
            {formatValue(points[shown].value)}
          </p>
          {points[shown].details?.map((d) => (
            <p key={d.label} className="mt-0.5 text-muted-foreground">
              {d.label}: <span className="font-medium text-foreground">{d.value}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Horizontal bars for comparing a few nominal categories: one color for every bar (no value ramp),
 * <= 24px thick with a rounded data end and a square baseline, value labelled at the tip.
 */
export function BarList({ items, formatValue, className }: {
  items: { key: string; label: string; value: number; href?: string }[]
  formatValue: (v: number) => string
  className?: string
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item) => {
        const row = (
          <>
            <span className="w-28 shrink-0 truncate text-sm text-muted-foreground sm:w-32">{item.label}</span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="h-3.5 rounded-r-[4px] bg-chart-1 transition-opacity group-hover:opacity-80"
                style={{ width: `${(item.value / max) * 100}%`, minWidth: item.value > 0 ? 3 : 0 }}
                aria-hidden
              />
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatValue(item.value)}</span>
            </span>
          </>
        )
        return (
          <li key={item.key}>
            {item.href ? (
              <Link to={item.href} className="group flex items-center gap-3 rounded-lg outline-offset-4">{row}</Link>
            ) : (
              <div className="flex items-center gap-3">{row}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
