import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  IconArrowDown,
  IconArrowUp,
  IconDots,
  IconGripVertical,
  IconPencil,
  IconPlus,
  IconZoomScan,
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
  TIMELINE_GEOMETRY,
  calculateCardTop,
  calculateLaneMetrics,
  frameViewRange,
  generateTimelineTicks,
  isDateInRange,
  layoutTimelineEventCards,
  layoutTimelineLayerSegments,
  panViewRange,
  parseIsoDate,
  todayIsoDate,
  zoomViewRange,
} from '#/features/timeline/layout'
import type {
  TimelineDateRange,
  TimelineTick,
} from '#/features/timeline/layout'
import {
  applyEventDrag,
  eventDatesEqual,
  formatDragOffset,
  pixelsToDays,
  reorderLayerIds,
} from '#/features/timeline/drag'
import type { EventDates, EventDragMode } from '#/features/timeline/drag'
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

const { cardHeight: CARD_HEIGHT, lineHeight: LINE_HEIGHT } = TIMELINE_GEOMETRY
/** Below this the bar is too thin to host grab targets on both edges. */
const MINIMUM_RESIZE_BAR_WIDTH = 24
const RESIZE_HANDLE_WIDTH = 8
/** Pointer travel before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 3

const tooltipDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
})

function formatTooltipDate(date: string): string {
  return tooltipDateFormatter.format(new Date(`${date}T00:00:00.000Z`))
}

interface EventDrag {
  eventId: string
  mode: EventDragMode
  pointerId: number
  originX: number
  original: EventDates
  offsetDays: number
  moved: boolean
}

interface TimelineCanvasProps {
  timeline: TimelineRecord
  /** The visible window. Null only while the timeline has no events. */
  range: TimelineDateRange | null
  /** The full extent of the timeline, used to clamp zoom and pan. */
  contentRange: TimelineDateRange | null
  matchedEventIds: ReadonlySet<string>
  isSearchActive: boolean
  readOnly?: boolean
  onViewRangeChange: (range: TimelineDateRange | null) => void
  onCreateEvent: (layerId: string) => void
  onEditEvent: (eventId: string) => void
  onEditLayer: (layerId: string) => void
  onMoveLayer: (layerId: string, direction: LayerMoveDirection) => void
  onReorderLayers: (orderedLayerIds: Array<string>) => void
  onChangeEventDates: (eventId: string, dates: EventDates) => void
}

export function TimelineCanvas({
  timeline,
  range,
  contentRange,
  matchedEventIds,
  isSearchActive,
  readOnly = false,
  onViewRangeChange,
  onCreateEvent,
  onEditEvent,
  onEditLayer,
  onMoveLayer,
  onReorderLayers,
  onChangeEventDates,
}: TimelineCanvasProps) {
  const axisRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(axisRef)
  const [drag, setDrag] = useState<EventDrag | null>(null)
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)

  const ticks = useMemo(
    () => (range && width > 0 ? generateTimelineTicks(range, width) : []),
    [range, width],
  )
  const orderedLayers = useMemo(
    () => [...timeline.layers].sort((left, right) => left.order - right.order),
    [timeline.layers],
  )

  /**
   * A drag rewrites the dragged event's dates in place so the rail, the gaps
   * and the card packing all re-lay-out live. Nothing is written to storage
   * until the pointer is released.
   */
  const previewEvents = useMemo(() => {
    if (!drag || drag.offsetDays === 0) return timeline.events

    return timeline.events.map((event) =>
      event.id === drag.eventId
        ? {
            ...event,
            ...applyEventDrag(drag.original, drag.offsetDays, drag.mode),
          }
        : event,
    )
  }, [drag, timeline.events])

  const today = todayIsoDate()
  const todayPosition =
    range && width > 0 && isDateInRange(today, range)
      ? ((parseIsoDate(today) - range.startMs) /
          (range.endMs - range.startMs)) *
        width
      : null

  const zoomAt = useCallback(
    (factor: number, anchorRatio: number) => {
      if (!range || !contentRange) return
      onViewRangeChange(zoomViewRange(range, contentRange, factor, anchorRatio))
    },
    [contentRange, onViewRangeChange, range],
  )

  const panBy = useCallback(
    (deltaRatio: number) => {
      if (!range || !contentRange) return
      onViewRangeChange(panViewRange(range, contentRange, deltaRatio))
    },
    [contentRange, onViewRangeChange, range],
  )

  // A pan gesture outlives the render that started it, and every move changes
  // the range it must pan from. Reading through a ref keeps each step relative
  // to the current viewport instead of the one captured at pointer-down.
  const panByRef = useRef(panBy)
  useEffect(() => {
    panByRef.current = panBy
  }, [panBy])

  /** Set when a drag actually moved, so the trailing click does not also open the editor. */
  const justDraggedRef = useRef(false)

  const handleEventClick = useCallback(
    (eventId: string) => {
      if (justDraggedRef.current) {
        justDraggedRef.current = false
        return
      }
      onEditEvent(eventId)
    },
    [onEditEvent],
  )

  // React attaches onWheel passively, so preventDefault needs a native
  // listener; without it the page scrolls while the canvas zooms.
  const surfaceRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface || !range || !contentRange || width <= 0) return

    const onWheel = (wheelEvent: WheelEvent) => {
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        wheelEvent.preventDefault()
        const bounds = axisRef.current?.getBoundingClientRect()
        const anchorRatio = bounds
          ? (wheelEvent.clientX - bounds.left) / bounds.width
          : 0.5
        zoomAt(wheelEvent.deltaY > 0 ? 1.15 : 1 / 1.15, anchorRatio)
        return
      }

      // Trackpad sideways scrolling pans; vertical scrolling is left to the page.
      if (Math.abs(wheelEvent.deltaX) > Math.abs(wheelEvent.deltaY)) {
        wheelEvent.preventDefault()
        panBy(wheelEvent.deltaX / width)
      }
    }

    surface.addEventListener('wheel', onWheel, { passive: false })
    return () => surface.removeEventListener('wheel', onWheel)
  }, [contentRange, panBy, range, width, zoomAt])

  const beginEventDrag = useCallback(
    (
      pointerEvent: React.PointerEvent<HTMLElement>,
      event: TimelineEvent,
      mode: EventDragMode,
    ) => {
      if (readOnly || !range || width <= 0 || pointerEvent.button !== 0) return

      pointerEvent.stopPropagation()
      justDraggedRef.current = false
      pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
      setDrag({
        eventId: event.id,
        mode,
        pointerId: pointerEvent.pointerId,
        originX: pointerEvent.clientX,
        original: { startDate: event.startDate, endDate: event.endDate },
        offsetDays: 0,
        moved: false,
      })
    },
    [range, readOnly, width],
  )

  const updateEventDrag = useCallback(
    (pointerEvent: React.PointerEvent<HTMLElement>) => {
      if (!drag || drag.pointerId !== pointerEvent.pointerId || !range) return

      const travel = pointerEvent.clientX - drag.originX
      const moved = drag.moved || Math.abs(travel) > DRAG_THRESHOLD
      if (!moved) return

      const offsetDays = pixelsToDays(travel, range, width)
      if (offsetDays === drag.offsetDays && moved === drag.moved) return
      setDrag({ ...drag, offsetDays, moved })
    },
    [drag, range, width],
  )

  const endEventDrag = useCallback(
    (pointerEvent: React.PointerEvent<HTMLElement>) => {
      if (!drag || drag.pointerId !== pointerEvent.pointerId) return
      setDrag(null)

      if (!drag.moved) return
      justDraggedRef.current = true
      const next = applyEventDrag(drag.original, drag.offsetDays, drag.mode)
      if (eventDatesEqual(next, drag.original)) return
      onChangeEventDates(drag.eventId, next)
    },
    [drag, onChangeEventDates],
  )

  const dragHandlers = {
    onPointerMove: updateEventDrag,
    onPointerUp: endEventDrag,
    onPointerCancel: (pointerEvent: React.PointerEvent<HTMLElement>) => {
      if (drag?.pointerId === pointerEvent.pointerId) setDrag(null)
    },
  }

  const handleLayerDrop = useCallback(
    (targetLayerId: string) => {
      if (!draggingLayerId) return
      const next = reorderLayerIds(
        orderedLayers.map((layer) => layer.id),
        draggingLayerId,
        targetLayerId,
      )
      setDraggingLayerId(null)
      if (next) onReorderLayers(next)
    },
    [draggingLayerId, onReorderLayers, orderedLayers],
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
        ref={surfaceRef}
        data-timeline-canvas
        className="relative grid overflow-hidden border bg-card md:grid-cols-[220px_minmax(0,1fr)]"
        aria-label={`${timeline.title} timeline`}
      >
        <div className="hidden h-10 items-end border-r border-b bg-muted/20 px-4 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:flex">
          Layers
        </div>
        <div
          ref={axisRef}
          className={`relative h-10 overflow-hidden border-b bg-muted/20 ${range && !readOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
          aria-label="Timeline date axis"
          onPointerDown={(pointerEvent) => {
            if (!range || pointerEvent.button !== 0) return
            startPan(pointerEvent, width, panByRef)
          }}
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
                  <span className="absolute bottom-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground tabular-nums">
                    {tick.label}
                  </span>
                </div>
              ))}
              {todayPosition !== null ? (
                <span
                  className="pointer-events-none absolute bottom-0 top-0 z-[3] flex justify-center"
                  style={{ left: todayPosition }}
                >
                  <span className="absolute inset-y-0 w-px bg-primary/70" />
                  <span className="absolute top-0.5 -translate-x-1/2 rounded-full bg-primary px-1.5 py-px text-[9px] leading-[1.3] font-medium tracking-wide text-primary-foreground uppercase">
                    Today
                  </span>
                </span>
              ) : null}
              <span className="sr-only">
                Showing {range.startDate} to {range.endDate}
              </span>
            </>
          ) : (
            <div className="flex h-full items-center px-4 text-xs text-muted-foreground">
              Add an event to establish the date range
            </div>
          )}
        </div>

        {orderedLayers.map((layer, layerIndex) => {
          const layerEvents = previewEvents.filter(
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
                readOnly={readOnly}
                isDragging={draggingLayerId === layer.id}
                isDropTarget={
                  draggingLayerId !== null && draggingLayerId !== layer.id
                }
                onStartDrag={() => setDraggingLayerId(layer.id)}
                onDrop={handleLayerDrop}
                onCancelDrag={() => setDraggingLayerId(null)}
                onCreateEvent={onCreateEvent}
                onEditLayer={onEditLayer}
                onMoveLayer={onMoveLayer}
                onFrameLayer={() => {
                  if (!contentRange || layerEvents.length === 0) return
                  const starts = layerEvents.map((event) => event.startDate)
                  const ends = layerEvents.map(
                    (event) => event.endDate ?? event.startDate,
                  )
                  onViewRangeChange(
                    frameViewRange(
                      starts.reduce((a, b) => (a < b ? a : b)),
                      ends.reduce((a, b) => (a > b ? a : b)),
                      contentRange,
                    ),
                  )
                }}
              />
              <LayerLane
                events={layerEvents}
                layer={layer}
                range={range}
                ticks={ticks}
                width={width}
                todayPosition={todayPosition}
                matchedEventIds={matchedEventIds}
                isSearchActive={isSearchActive}
                readOnly={readOnly}
                drag={drag}
                dragHandlers={dragHandlers}
                onBeginEventDrag={beginEventDrag}
                onCreateEvent={onCreateEvent}
                onEventClick={handleEventClick}
                onPan={panByRef}
              />
            </Fragment>
          )
        })}
      </section>
    </TooltipProvider>
  )
}

/** Drag anywhere on empty canvas to scroll the viewport sideways. */
function startPan(
  pointerEvent: React.PointerEvent<HTMLElement>,
  width: number,
  panByRef: React.RefObject<(deltaRatio: number) => void>,
) {
  if (width <= 0) return

  const surface = pointerEvent.currentTarget
  const pointerId = pointerEvent.pointerId
  let lastX = pointerEvent.clientX
  surface.setPointerCapture(pointerId)

  const onMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return
    panByRef.current((lastX - moveEvent.clientX) / width)
    lastX = moveEvent.clientX
  }
  const onEnd = (endEvent: PointerEvent) => {
    if (endEvent.pointerId !== pointerId) return
    surface.removeEventListener('pointermove', onMove)
    surface.removeEventListener('pointerup', onEnd)
    surface.removeEventListener('pointercancel', onEnd)
  }

  surface.addEventListener('pointermove', onMove)
  surface.addEventListener('pointerup', onEnd)
  surface.addEventListener('pointercancel', onEnd)
}

interface LayerSummaryProps {
  layer: TimelineLayer
  layerIndex: number
  layerCount: number
  eventCount: number
  duration: string | null
  readOnly: boolean
  isDragging: boolean
  isDropTarget: boolean
  onStartDrag: () => void
  onDrop: (layerId: string) => void
  onCancelDrag: () => void
  onCreateEvent: (layerId: string) => void
  onEditLayer: (layerId: string) => void
  onMoveLayer: (layerId: string, direction: LayerMoveDirection) => void
  onFrameLayer: () => void
}

function LayerSummary({
  layer,
  layerIndex,
  layerCount,
  eventCount,
  duration,
  readOnly,
  isDragging,
  isDropTarget,
  onStartDrag,
  onDrop,
  onCancelDrag,
  onCreateEvent,
  onEditLayer,
  onMoveLayer,
  onFrameLayer,
}: LayerSummaryProps) {
  return (
    <div
      data-layer-row={layer.id}
      className={`flex min-h-24 items-start gap-2 border-b bg-background p-4 transition-colors md:border-r ${isDragging ? 'opacity-50' : ''} ${isDropTarget ? 'hover:bg-accent/60' : ''}`}
      onPointerUp={() => {
        if (isDropTarget) onDrop(layer.id)
      }}
    >
      {readOnly ? null : (
        <button
          type="button"
          aria-label={`Reorder ${layer.title}, or use the arrow keys`}
          className="-ml-1 mt-0.5 flex shrink-0 cursor-grab touch-none items-center rounded-sm p-0.5 text-muted-foreground/50 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
          onPointerDown={(pointerEvent) => {
            if (pointerEvent.button !== 0) return
            onStartDrag()
          }}
          onPointerUp={onCancelDrag}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === 'ArrowUp') {
              keyEvent.preventDefault()
              onMoveLayer(layer.id, 'up')
            }
            if (keyEvent.key === 'ArrowDown') {
              keyEvent.preventDefault()
              onMoveLayer(layer.id, 'down')
            }
          }}
        >
          <IconGripVertical className="size-3.5" />
        </button>
      )}
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
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                disabled={eventCount === 0}
                onSelect={onFrameLayer}
              >
                <IconZoomScan />
                Zoom to layer
              </DropdownMenuItem>
              {readOnly ? null : (
                <>
                  <DropdownMenuSeparator />
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
                </>
              )}
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
  range: TimelineDateRange | null
  /** The same ticks the axis renders, so the gridlines line up across layers. */
  ticks: ReadonlyArray<TimelineTick>
  width: number
  todayPosition: number | null
  matchedEventIds: ReadonlySet<string>
  isSearchActive: boolean
  readOnly: boolean
  drag: EventDrag | null
  dragHandlers: {
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
  }
  onBeginEventDrag: (
    pointerEvent: React.PointerEvent<HTMLElement>,
    event: TimelineEvent,
    mode: EventDragMode,
  ) => void
  onCreateEvent: (layerId: string) => void
  onEventClick: (eventId: string) => void
  onPan: React.RefObject<(deltaRatio: number) => void>
}

function LayerLane({
  events,
  layer,
  range,
  ticks,
  width,
  todayPosition,
  matchedEventIds,
  isSearchActive,
  readOnly,
  drag,
  dragHandlers,
  onBeginEventDrag,
  onCreateEvent,
  onEventClick,
  onPan,
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
        ? layoutTimelineEventCards(events, range, width, { gap: 6 })
        : { cards: [], aboveRowCount: 0, belowRowCount: 0 },
    [events, range, width],
  )
  const metrics = calculateLaneMetrics(cardLayout)
  const { lineTop, anchorY, height: laneHeight } = metrics

  const dimmed = (eventId: string) =>
    isSearchActive && !matchedEventIds.has(eventId)

  return (
    <div
      className={`relative overflow-hidden border-b bg-card ${range && !readOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ minHeight: laneHeight }}
      aria-label={`${layer.title} events`}
      onPointerDown={(pointerEvent) => {
        if (!range || pointerEvent.button !== 0) return
        if (pointerEvent.target !== pointerEvent.currentTarget) return
        startPan(pointerEvent, width, onPan)
      }}
      {...dragHandlers}
    >
      {/* Every lane draws the axis ticks at the same positions, so each tick
          reads as one line running down through all the layers. */}
      {range
        ? ticks.map((tick) => (
            <span
              key={`${tick.date}-${tick.position}`}
              className={`pointer-events-none absolute inset-y-0 w-px bg-border ${tick.unit === 'year' ? 'opacity-60' : 'opacity-30'}`}
              style={{ left: tick.position }}
              aria-hidden="true"
            />
          ))
        : null}

      {todayPosition !== null ? (
        <span
          className="pointer-events-none absolute inset-y-0 z-0 w-px bg-primary/40"
          style={{ left: todayPosition }}
          aria-hidden="true"
        />
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
                {/* Gaps are derived from the events around them, so they are
                    presentation only: the same information already reaches
                    assistive tech through each event's own label. */}
                <div
                  className="absolute"
                  style={{
                    left: layout.left,
                    top: lineTop,
                    width: layout.width,
                    height: LINE_HEIGHT,
                  }}
                  aria-hidden="true"
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
        const isDragged = drag?.eventId === event.id && drag.moved
        const canResize = !readOnly && layout.width >= MINIMUM_RESIZE_BAR_WIDTH

        return (
          <Tooltip key={event.id}>
            <TooltipTrigger asChild>
              {/* The card below carries this event's accessible name and focus;
                  the bar is the pointer-precise duplicate of it. */}
              <div
                className={`absolute z-[1] transition-opacity ${isDragged ? 'z-20' : ''} ${dimmed(event.id) ? 'opacity-20' : ''} ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
                style={{
                  left: layout.left,
                  top: lineTop,
                  width: layout.width,
                  height: LINE_HEIGHT,
                }}
                aria-hidden="true"
                onPointerDown={(pointerEvent) =>
                  onBeginEventDrag(pointerEvent, event, 'move')
                }
                onClick={() => onEventClick(event.id)}
              >
                <span
                  className="absolute inset-x-0 top-1/2 block h-[3px] -translate-y-1/2 rounded-full"
                  style={{
                    backgroundColor: event.color,
                    opacity: eventOpacity,
                  }}
                />
                {canResize ? (
                  <>
                    <span
                      className="absolute inset-y-0 left-0 cursor-ew-resize"
                      style={{ width: RESIZE_HANDLE_WIDTH }}
                      onPointerDown={(pointerEvent) =>
                        onBeginEventDrag(pointerEvent, event, 'resize-start')
                      }
                    />
                    <span
                      className="absolute inset-y-0 right-0 cursor-ew-resize"
                      style={{ width: RESIZE_HANDLE_WIDTH }}
                      onPointerDown={(pointerEvent) =>
                        onBeginEventDrag(pointerEvent, event, 'resize-end')
                      }
                    />
                  </>
                ) : null}
              </div>
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
        const isDragged = drag?.eventId === event.id && drag.moved

        const cardTop = calculateCardTop(card, metrics)
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
              className={`pointer-events-none absolute z-0 w-0 border-l border-border/80 ${dimmed(event.id) ? 'opacity-20' : ''}`}
              style={{
                left: card.anchorX,
                top: connectorTop,
                height: connectorHeight,
              }}
              aria-hidden="true"
            />
            <span
              className={`pointer-events-none absolute z-[11] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card ${dimmed(event.id) ? 'opacity-20' : ''}`}
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
                  data-event-card={event.id}
                  className={`group/card absolute z-[2] overflow-hidden border bg-background/95 px-2 py-1 text-left shadow-xs outline-none transition-[border-color,box-shadow,transform,opacity] hover:-translate-y-px hover:border-foreground/25 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/60 ${dimmed(event.id) ? 'opacity-20' : ''} ${isDragged ? 'z-20 shadow-md' : ''} ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
                  style={{
                    left: card.left,
                    top: cardTop,
                    width: card.width,
                    height: CARD_HEIGHT,
                  }}
                  onPointerDown={(pointerEvent) =>
                    onBeginEventDrag(pointerEvent, event, 'move')
                  }
                  onClick={() => onEventClick(event.id)}
                  aria-label={`${event.title}, ${durationLabel}, ${dateLabel}, in ${layer.title}`}
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
                <span className="text-background/70">
                  {isDragged
                    ? `${dateLabel} · ${formatDragOffset(drag.offsetDays)}`
                    : dateLabel}
                </span>
              </TooltipContent>
            </Tooltip>
          </Fragment>
        )
      })}

      {events.length === 0 && !readOnly ? (
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
