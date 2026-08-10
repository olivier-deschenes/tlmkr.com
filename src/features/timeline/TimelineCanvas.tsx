import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconArrowDown,
  IconArrowUp,
  IconDots,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import {
  calculateDateRange,
  generateTimelineTicks,
  layoutAndPackTimelineEvents,
} from '#/features/timeline/layout'
import {
  formatEventDuration,
  formatLayerDuration,
} from '#/features/timeline/duration'
import type {
  TimelineEvent,
  TimelineLayer,
  TimelineRecord,
} from '#/features/timeline/model'
import type { LayerMoveDirection } from '#/features/timeline/operations'

const EVENT_ROW_HEIGHT = 52
const LANE_PADDING = 12
const MINIMUM_EVENT_LABEL_WIDTH = 160
const tooltipDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
})

function formatTooltipDate(date: string): string {
  return tooltipDateFormatter.format(new Date(`${date}T00:00:00.000Z`))
}

interface TimelineCanvasProps {
  timeline: TimelineRecord
  onCreateEvent: (layerId: string) => void
  onEditEvent: (eventId: string) => void
  onEditLayer: (layerId: string) => void
  onMoveLayer: (layerId: string, direction: LayerMoveDirection) => void
}

export function TimelineCanvas({
  timeline,
  onCreateEvent,
  onEditEvent,
  onEditLayer,
  onMoveLayer,
}: TimelineCanvasProps) {
  const axisRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(axisRef)
  const range = useMemo(
    () => calculateDateRange(timeline.events),
    [timeline.events],
  )
  const ticks = useMemo(
    () => (range && width > 0 ? generateTimelineTicks(range, width) : []),
    [range, width],
  )
  const orderedLayers = useMemo(
    () => [...timeline.layers].sort((left, right) => left.order - right.order),
    [timeline.layers],
  )

  if (orderedLayers.length === 0) {
    return (
      <div className="border border-dashed bg-card px-6 py-16 text-center">
        <p className="text-sm font-medium">This timeline has no layers.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add a layer before creating events.
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <section
        className="grid overflow-hidden border bg-card md:grid-cols-[220px_minmax(0,1fr)]"
        aria-label={`${timeline.title} timeline`}
      >
        <div className="hidden h-14 items-end border-r border-b bg-muted/20 px-4 pb-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:flex">
          Layers
        </div>
        <div
          ref={axisRef}
          className="relative h-14 overflow-hidden border-b bg-muted/20"
          aria-label="Timeline date axis"
        >
          {range ? (
            <>
              {ticks.map((tick) => (
                <div
                  key={`${tick.date}-${tick.position}`}
                  className="absolute inset-y-0"
                  style={{ left: tick.position }}
                >
                  <span className="absolute top-0 h-full w-px bg-border" />
                  <span className="absolute bottom-2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground tabular-nums">
                    {tick.label}
                  </span>
                </div>
              ))}
              <span className="sr-only">
                Range from {range.startDate} to {range.endDate}
              </span>
            </>
          ) : (
            <div className="flex h-full items-end px-4 pb-3 text-xs text-muted-foreground">
              Add an event to establish the date range
            </div>
          )}
        </div>

        {orderedLayers.map((layer, layerIndex) => {
          const layerEvents = timeline.events.filter(
            (event) => event.layerId === layer.id,
          )
          return (
            <Fragment key={layer.id}>
              <LayerSummary
                layer={layer}
                layerIndex={layerIndex}
                layerCount={orderedLayers.length}
                eventCount={layerEvents.length}
                duration={formatLayerDuration(layerEvents)}
                onCreateEvent={onCreateEvent}
                onEditLayer={onEditLayer}
                onMoveLayer={onMoveLayer}
              />
              <LayerLane
                events={layerEvents}
                layer={layer}
                range={range}
                width={width}
                onCreateEvent={onCreateEvent}
                onEditEvent={onEditEvent}
              />
            </Fragment>
          )
        })}
      </section>
    </TooltipProvider>
  )
}

interface LayerSummaryProps {
  layer: TimelineLayer
  layerIndex: number
  layerCount: number
  eventCount: number
  duration: string | null
  onCreateEvent: (layerId: string) => void
  onEditLayer: (layerId: string) => void
  onMoveLayer: (layerId: string, direction: LayerMoveDirection) => void
}

function LayerSummary({
  layer,
  layerIndex,
  layerCount,
  eventCount,
  duration,
  onCreateEvent,
  onEditLayer,
  onMoveLayer,
}: LayerSummaryProps) {
  return (
    <div className="flex min-h-24 items-start gap-3 border-b bg-background p-4 md:border-r">
      <span
        className="mt-1.5 size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: layer.color }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => onEditLayer(layer.id)}
          >
            <span className="block truncate text-sm font-medium">
              {layer.title}
            </span>
            {layer.subtitle ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {layer.subtitle}
              </span>
            ) : null}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${layer.title}`}
              >
                <IconDots />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => onCreateEvent(layer.id)}>
                <IconPlus />
                Add event
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEditLayer(layer.id)}>
                <IconPencil />
                Edit layer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={layerIndex === 0}
                onSelect={() => onMoveLayer(layer.id, 'up')}
              >
                <IconArrowUp />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={layerIndex === layerCount - 1}
                onSelect={() => onMoveLayer(layer.id, 'down')}
              >
                <IconArrowDown />
                Move down
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {layer.description ? (
          <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {layer.description}
          </p>
        ) : null}
        <p
          className={`${layer.description ? 'mt-1' : 'mt-2'} text-[11px] text-muted-foreground`}
        >
          {eventCount} {eventCount === 1 ? 'event' : 'events'}
          {duration ? ` · ${duration}` : ''}
        </p>
      </div>
    </div>
  )
}

interface LayerLaneProps {
  events: Array<TimelineEvent>
  layer: TimelineLayer
  range: ReturnType<typeof calculateDateRange>
  width: number
  onCreateEvent: (layerId: string) => void
  onEditEvent: (eventId: string) => void
}

function LayerLane({
  events,
  layer,
  range,
  width,
  onCreateEvent,
  onEditEvent,
}: LayerLaneProps) {
  const packed = useMemo(
    () =>
      range && width > 0
        ? layoutAndPackTimelineEvents(events, range, width, {
            minimumHitWidth: 32,
            minimumLabelWidth: MINIMUM_EVENT_LABEL_WIDTH,
            gap: 6,
          })
        : { events: [], rowCount: 0 },
    [events, range, width],
  )
  const eventById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events],
  )
  const height = Math.max(
    96,
    packed.rowCount * EVENT_ROW_HEIGHT + LANE_PADDING * 2,
  )

  return (
    <div
      className="relative overflow-hidden border-b bg-card"
      style={{ minHeight: height }}
      aria-label={`${layer.title} events`}
    >
      {range ? (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)] bg-[size:12.5%_100%] opacity-35" />
      ) : null}

      {packed.events.map((layout) => {
        const event = eventById.get(layout.eventId)
        if (!event) return null
        const startDateLabel = formatTooltipDate(event.startDate)
        const dateLabel = event.endDate
          ? `${startDateLabel} to ${formatTooltipDate(event.endDate)}`
          : startDateLabel
        const durationLabel = formatEventDuration(
          event.startDate,
          event.endDate,
        )
        const barOffset = Math.max(0, layout.barLeft - layout.left)
        const barWidth = Math.min(
          layout.barWidth,
          Math.max(2, layout.width - barOffset),
        )
        const barCenter = Math.min(
          layout.width - 1,
          Math.max(1, barOffset + barWidth / 2),
        )

        return (
          <Tooltip key={event.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="group/event absolute h-11 text-left outline-none hover:z-10 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/60"
                style={{
                  left: layout.left,
                  top: LANE_PADDING + layout.row * EVENT_ROW_HEIGHT,
                  width: layout.width,
                }}
                onClick={() => onEditEvent(event.id)}
                aria-label={`${event.title}, ${dateLabel}, in ${layer.title}`}
              >
                <span
                  className="absolute top-0 h-1 rounded-full"
                  style={{
                    left: barOffset,
                    width: barWidth,
                    backgroundColor: event.color,
                  }}
                  aria-hidden="true"
                />
                {layout.kind === 'point' ? (
                  <span
                    className="absolute top-0 h-2 w-0.5"
                    style={{
                      left: Math.max(0, layout.startX - layout.left - 1),
                      backgroundColor: event.color,
                    }}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className="absolute top-1 h-1 w-px"
                  style={{
                    left: barCenter,
                    backgroundColor: event.color,
                  }}
                  aria-hidden="true"
                />
                <span className="absolute inset-x-0 top-2 h-9 overflow-hidden border bg-background/95 px-2 py-1 shadow-xs transition-[border-color,box-shadow,transform] group-hover/event:-translate-y-px group-hover/event:border-foreground/25 group-hover/event:shadow-sm group-focus-visible/event:border-foreground/25">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: event.color }}
                      aria-hidden="true"
                    />
                    <span className="block min-w-0 truncate text-[11px] font-medium">
                      {event.title}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1 pl-3 text-[10px] text-muted-foreground">
                    {event.subtitle ? (
                      <>
                        <span className="truncate">{event.subtitle}</span>
                        <span aria-hidden="true">·</span>
                      </>
                    ) : null}
                    <span className="shrink-0 tabular-nums">
                      {durationLabel}
                    </span>
                  </span>
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              <span className="font-medium">{event.title}</span>
              <span className="text-background/70">{dateLabel}</span>
            </TooltipContent>
          </Tooltip>
        )
      })}

      {events.length === 0 ? (
        <button
          type="button"
          className="absolute inset-3 flex items-center justify-center border border-dashed text-xs text-muted-foreground outline-none hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => onCreateEvent(layer.id)}
        >
          <IconPlus className="mr-1 size-3.5" />
          Add an event to {layer.title}
        </button>
      ) : null}
    </div>
  )
}

function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => setWidth(element.getBoundingClientRect().width)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
