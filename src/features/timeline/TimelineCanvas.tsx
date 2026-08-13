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
  layoutTimelineEventCards,
  layoutTimelineLayerSegments,
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

const CARD_HEIGHT = 44
const CARD_ROW_GAP = 12
const CARD_ROW_STEP = CARD_HEIGHT + CARD_ROW_GAP
const CONNECTOR_LENGTH = 12
const LINE_HEIGHT = 16
const LANE_PADDING = 16
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
  const segments = useMemo(
    () =>
      range && width > 0
        ? layoutTimelineLayerSegments(events, range, width)
        : [],
    [events, range, width],
  )
  const eventById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events],
  )
  const eventOpacityById = useMemo(() => {
    const opacityById = new Map<string, number>()
    let previousEvent: TimelineEvent | undefined
    let runIndex = 0

    for (const { segment } of segments) {
      if (segment.kind === 'gap') {
        previousEvent = undefined
        runIndex = 0
        continue
      }

      const event = eventById.get(segment.eventId)
      if (!event) continue

      const touchesMatchingEvent =
        previousEvent?.color.toLowerCase() === event.color.toLowerCase()
      runIndex = touchesMatchingEvent ? runIndex + 1 : 0
      opacityById.set(event.id, runIndex % 2 === 1 ? 0.65 : 1)
      previousEvent = event
    }

    return opacityById
  }, [eventById, segments])
  const cardLayout = useMemo(
    () =>
      range && width > 0
        ? layoutTimelineEventCards(events, range, width, {
            minimumLabelWidth: 160,
            gap: 6,
          })
        : { cards: [], aboveRowCount: 0, belowRowCount: 0 },
    [events, range, width],
  )
  const aboveHeight = cardLayout.aboveRowCount
    ? cardLayout.aboveRowCount * CARD_ROW_STEP - CARD_ROW_GAP + CONNECTOR_LENGTH
    : 0
  const belowHeight = cardLayout.belowRowCount
    ? CONNECTOR_LENGTH + cardLayout.belowRowCount * CARD_ROW_STEP - CARD_ROW_GAP
    : 0
  const lineTop = LANE_PADDING + aboveHeight
  const laneHeight = lineTop + LINE_HEIGHT + belowHeight + LANE_PADDING

  return (
    <div
      className="relative overflow-hidden border-b bg-card"
      style={{ minHeight: laneHeight }}
      aria-label={`${layer.title} events`}
    >
      {range ? (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)] bg-[size:12.5%_100%] opacity-35" />
      ) : null}

      {events.length > 0 ? (
        <span
          className="pointer-events-none absolute inset-x-0 h-px bg-border"
          style={{ top: lineTop + LINE_HEIGHT / 2 }}
          aria-hidden="true"
        />
      ) : null}

      {segments.map((layout) => {
        const dateLabel = `${formatTooltipDate(layout.segment.startDate)} to ${formatTooltipDate(layout.segment.endDate)}`
        const durationLabel = formatEventDuration(
          layout.segment.startDate,
          layout.segment.endDate,
        )

        if (layout.segment.kind === 'gap') {
          return (
            <Tooltip
              key={`gap-${layout.segment.startDate}-${layout.segment.endDate}`}
            >
              <TooltipTrigger asChild>
                <div
                  className="absolute outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/60"
                  style={{
                    left: layout.left,
                    top: lineTop,
                    width: layout.width,
                    height: LINE_HEIGHT,
                  }}
                  tabIndex={0}
                  aria-label={`Gap, ${durationLabel}, ${dateLabel}`}
                />
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                <span className="font-medium">Gap · {durationLabel}</span>
                <span className="text-background/70">{dateLabel}</span>
              </TooltipContent>
            </Tooltip>
          )
        }

        const event = eventById.get(layout.segment.eventId)
        if (!event) return null
        const eventOpacity = eventOpacityById.get(event.id) ?? 1

        return (
          <Tooltip key={event.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="group/event absolute z-[1] border-0 bg-transparent p-0 outline-none hover:z-10 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/60"
                style={{
                  left: layout.left,
                  top: lineTop,
                  width: layout.width,
                  height: LINE_HEIGHT,
                }}
                onClick={() => onEditEvent(event.id)}
                aria-label={`${event.title}, ${durationLabel}, ${dateLabel}, in ${layer.title}`}
              >
                <span
                  className="absolute inset-x-0 top-1/2 block h-[3px] -translate-y-1/2 rounded-full"
                  style={{
                    backgroundColor: event.color,
                    opacity: eventOpacity,
                  }}
                  aria-hidden="true"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              <span className="font-medium">{event.title}</span>
              <span className="text-background/70">
                {dateLabel} · {durationLabel}
              </span>
            </TooltipContent>
          </Tooltip>
        )
      })}

      {cardLayout.cards.map((card) => {
        const event = eventById.get(card.eventId)
        if (!event) return null
        const eventOpacity = eventOpacityById.get(event.id) ?? 1

        const cardTop =
          card.side === 'above'
            ? lineTop -
              CONNECTOR_LENGTH -
              CARD_HEIGHT -
              card.level * CARD_ROW_STEP
            : lineTop +
              LINE_HEIGHT +
              CONNECTOR_LENGTH +
              card.level * CARD_ROW_STEP
        const anchorY = lineTop + LINE_HEIGHT / 2
        const connectorTop =
          card.side === 'above' ? cardTop + CARD_HEIGHT : anchorY
        const connectorHeight =
          card.side === 'above'
            ? anchorY - (cardTop + CARD_HEIGHT)
            : cardTop - anchorY
        const startDateLabel = formatTooltipDate(event.startDate)
        const dateLabel = event.endDate
          ? `${startDateLabel} to ${formatTooltipDate(event.endDate)}`
          : startDateLabel
        const durationLabel = formatEventDuration(
          event.startDate,
          event.endDate,
        )

        return (
          <Fragment key={`card-${event.id}`}>
            <span
              className="pointer-events-none absolute z-0 w-0 border-l border-border/80"
              style={{
                left: card.anchorX,
                top: connectorTop,
                height: connectorHeight,
              }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute z-[11] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card"
              style={{
                left: card.anchorX,
                top: anchorY,
                borderColor: event.color,
              }}
              aria-hidden="true"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="group/card absolute z-[2] overflow-hidden border bg-background/95 px-2 py-1 text-left shadow-xs outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-foreground/25 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/60"
                  style={{
                    left: card.left,
                    top: cardTop,
                    width: card.width,
                    height: CARD_HEIGHT,
                  }}
                  onClick={() => onEditEvent(event.id)}
                  aria-label={`${event.title}, ${dateLabel}, in ${layer.title}`}
                >
                  <span
                    className="absolute inset-x-0 top-0 h-1"
                    style={{
                      backgroundColor: event.color,
                      opacity: eventOpacity,
                    }}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: event.color,
                        opacity: eventOpacity,
                      }}
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
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                <span className="font-medium">{event.title}</span>
                <span className="text-background/70">{dateLabel}</span>
              </TooltipContent>
            </Tooltip>
          </Fragment>
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
