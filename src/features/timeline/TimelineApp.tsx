import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { useDebouncer } from '@tanstack/react-pacer/debouncer'
import {
  IconAlertTriangle,
  IconFileImport,
  IconJson,
  IconDots,
  IconLayersIntersect,
  IconPencil,
  IconPlus,
  IconTimeline,
  IconTrash,
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Input } from '#/components/ui/input'
import { TimelineCanvas } from '#/features/timeline/TimelineCanvas'
import {
  ConfirmDeleteDialog,
  EventDialog,
  EventImportDialog,
  LayerDialog,
  TimelineImportDialog,
  TimelineNameDialog,
} from '#/features/timeline/TimelineDialogs'
import type {
  EventFormValues,
  LayerFormValues,
  TimelineFormValues,
} from '#/features/timeline/TimelineDialogs'
import { calculateDateRange } from '#/features/timeline/layout'
import {
  createChatGptEventUrl,
  importEventsFromJson,
} from '#/features/timeline/eventImport'
import type { TimelineRecord } from '#/features/timeline/model'
import {
  addEvent,
  addLayer,
  createTimeline,
  deleteEvent,
  deleteLayer,
  duplicateEvent,
  moveLayer,
  selectTimelineAfterDeletion,
  updateEvent,
  updateLayer,
  updateTimelineTitle,
} from '#/features/timeline/operations'
import { getTimelineCollection } from '#/features/timeline/storage'
import { downloadTimelineExport } from '#/features/timeline/timelineExport'
import { importTimelineFromJson } from '#/features/timeline/timelineImport'

interface TimelineAppProps {
  activeTimelineId?: string
  onSelectTimeline: (timelineId: string | undefined, replace?: boolean) => void
}

type LayerDialogState =
  { mode: 'new' } | { mode: 'edit'; layerId: string } | null

type EventDialogState =
  { mode: 'new'; layerId: string } | { mode: 'edit'; eventId: string } | null

type DeleteIntent =
  | { kind: 'timeline'; id: string; title: string }
  | { kind: 'layer'; id: string; title: string; eventCount: number }
  | { kind: 'event'; id: string; title: string }

export function TimelineApp({
  activeTimelineId,
  onSelectTimeline,
}: TimelineAppProps) {
  const [collection] = useState(() => getTimelineCollection())
  const query = useLiveQuery(
    (builder) => builder.from({ timeline: collection }),
    [collection],
  )
  const timelines = useMemo(
    () =>
      [...query.data].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [query.data],
  )
  const activeTimeline = timelines.find(
    (timeline) => timeline.id === activeTimelineId,
  )

  const [createTimelineOpen, setCreateTimelineOpen] = useState(false)
  const [timelineImportOpen, setTimelineImportOpen] = useState(false)
  const [layerDialog, setLayerDialog] = useState<LayerDialogState>(null)
  const [eventDialog, setEventDialog] = useState<EventDialogState>(null)
  const [eventImportOpen, setEventImportOpen] = useState(false)
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null)
  const [storageError, setStorageError] = useState<string>()

  useEffect(() => {
    if (query.isLoading) return
    if (timelines.length === 0) {
      if (activeTimelineId) onSelectTimeline(undefined, true)
      return
    }
    if (!activeTimeline) onSelectTimeline(timelines[0].id, true)
  }, [
    activeTimeline,
    activeTimelineId,
    onSelectTimeline,
    query.isLoading,
    timelines,
  ])

  const watchPersistence = (
    transaction: { isPersisted: { promise: Promise<unknown> } },
    successMessage?: string,
  ) => {
    void transaction.isPersisted.promise
      .then(() => {
        setStorageError(undefined)
        if (successMessage) toast.success(successMessage)
      })
      .catch(() => {
        setStorageError(
          'Your change could not be saved in this browser. Check storage permissions or free some space, then try again.',
        )
      })
  }

  const persistTimeline = (timeline: TimelineRecord, message?: string) => {
    const transaction = collection.update(timeline.id, (draft) => {
      Object.assign(draft, timeline)
    })
    watchPersistence(transaction, message)
  }

  const handleCreateTimeline = ({ title }: TimelineFormValues) => {
    const timeline = createTimeline(title)
    watchPersistence(collection.insert(timeline), 'Timeline created')
    onSelectTimeline(timeline.id)
  }

  const handleTimelineImport = (json: string) => {
    const timeline = importTimelineFromJson(json, {
      existingIds: timelines.map((candidate) => candidate.id),
    })
    watchPersistence(collection.insert(timeline), 'Timeline imported')
    onSelectTimeline(timeline.id)
  }

  const handleRenameTimeline = (title: string) => {
    if (!activeTimeline || title.trim() === activeTimeline.title) return
    persistTimeline(updateTimelineTitle(activeTimeline, title))
  }

  const handleLayerSubmit = (values: LayerFormValues) => {
    if (!activeTimeline || !layerDialog) return
    const input = {
      title: values.title,
      color: values.color,
      subtitle: values.subtitle || undefined,
      description: values.description || undefined,
    }
    const next =
      layerDialog.mode === 'new'
        ? addLayer(activeTimeline, input)
        : updateLayer(activeTimeline, layerDialog.layerId, input)
    persistTimeline(
      next,
      layerDialog.mode === 'new' ? 'Layer added' : undefined,
    )
  }

  const handleEventSubmit = (values: EventFormValues) => {
    if (!activeTimeline || !eventDialog) return
    const input = {
      title: values.title,
      color: values.color,
      layerId: values.layerId,
      startDate: values.startDate,
      subtitle: values.subtitle || undefined,
      description: values.description || undefined,
      endDate: values.endDate || undefined,
    }
    const next =
      eventDialog.mode === 'new'
        ? addEvent(activeTimeline, input)
        : updateEvent(activeTimeline, eventDialog.eventId, input)
    persistTimeline(
      next,
      eventDialog.mode === 'new' ? 'Event added' : undefined,
    )
  }

  const handleDuplicateEvent = () => {
    if (!activeTimeline || eventDialog?.mode !== 'edit') return
    const copyId = crypto.randomUUID()
    const next = duplicateEvent(activeTimeline, eventDialog.eventId, {
      id: copyId,
    })
    persistTimeline(next, 'Event duplicated')
    setEventDialog({ mode: 'edit', eventId: copyId })
  }

  const handleEventImport = (json: string) => {
    if (!activeTimeline) return
    const eventCountBeforeImport = activeTimeline.events.length
    const next = importEventsFromJson(activeTimeline, json)
    const importedCount = next.events.length - eventCountBeforeImport
    persistTimeline(
      next,
      `${importedCount} ${importedCount === 1 ? 'event' : 'events'} imported`,
    )
  }

  const handleMoveLayer = (layerId: string, direction: 'up' | 'down') => {
    if (!activeTimeline) return
    persistTimeline(moveLayer(activeTimeline, layerId, direction))
  }

  const handleExport = () => {
    if (!activeTimeline) return
    downloadTimelineExport(activeTimeline)
    toast.success('Timeline exported')
  }

  const handleDelete = () => {
    if (!deleteIntent) return

    if (deleteIntent.kind === 'timeline') {
      const nextSelection = selectTimelineAfterDeletion(
        timelines,
        deleteIntent.id,
        activeTimelineId,
      )
      watchPersistence(collection.delete(deleteIntent.id), 'Timeline deleted')
      onSelectTimeline(nextSelection)
      return
    }

    if (!activeTimeline) return
    const next =
      deleteIntent.kind === 'layer'
        ? deleteLayer(activeTimeline, deleteIntent.id)
        : deleteEvent(activeTimeline, deleteIntent.id)
    persistTimeline(
      next,
      deleteIntent.kind === 'layer' ? 'Layer deleted' : 'Event deleted',
    )
  }

  if (query.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Loading timelines…</p>
      </main>
    )
  }

  if (query.isError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Alert variant="destructive">
          <IconAlertTriangle />
          <AlertTitle>Timelines could not be loaded</AlertTitle>
          <AlertDescription>
            Browser storage is unavailable. Enable local storage for this site
            and reload the page.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const selectedLayer =
    activeTimeline && layerDialog?.mode === 'edit'
      ? activeTimeline.layers.find((layer) => layer.id === layerDialog.layerId)
      : undefined
  const selectedEvent =
    activeTimeline && eventDialog?.mode === 'edit'
      ? activeTimeline.events.find((event) => event.id === eventDialog.eventId)
      : undefined
  const defaultEventLayer =
    eventDialog?.mode === 'new' ? eventDialog.layerId : undefined

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <a
            href="/"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <IconTimeline className="size-4" />
            <span className="hidden sm:inline">Timeline Maker</span>
          </a>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {timelines.length > 0 ? (
              <Select
                value={activeTimelineId}
                onValueChange={(timelineId) => onSelectTimeline(timelineId)}
              >
                <SelectTrigger
                  className="w-[min(52vw,260px)]"
                  aria-label="Current timeline"
                >
                  <SelectValue placeholder="Choose a timeline" />
                </SelectTrigger>
                <SelectContent align="end">
                  {timelines.map((timeline) => (
                    <SelectItem key={timeline.id} value={timeline.id}>
                      {timeline.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTimelineImportOpen(true)}
            >
              <IconFileImport />
              <span className="hidden sm:inline">Import timeline</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateTimelineOpen(true)}
            >
              <IconPlus />
              <span className="hidden sm:inline">New timeline</span>
              <span className="sm:hidden">New</span>
            </Button>
            {activeTimeline ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Timeline actions"
                  >
                    <IconDots />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onSelect={handleExport}>
                    <IconJson />
                    Export timeline
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() =>
                      setDeleteIntent({
                        kind: 'timeline',
                        id: activeTimeline.id,
                        title: activeTimeline.title,
                      })
                    }
                  >
                    <IconTrash />
                    Delete timeline
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6">
        {storageError ? (
          <Alert variant="destructive" className="mb-6">
            <IconAlertTriangle />
            <AlertTitle>Changes are not being saved</AlertTitle>
            <AlertDescription>{storageError}</AlertDescription>
          </Alert>
        ) : null}

        {activeTimeline ? (
          <TimelineWorkspace
            key={activeTimeline.id}
            timeline={activeTimeline}
            onRename={handleRenameTimeline}
            onAddLayer={() => setLayerDialog({ mode: 'new' })}
            onCreateEvent={(layerId) =>
              setEventDialog({ mode: 'new', layerId })
            }
            onEditEvent={(eventId) => setEventDialog({ mode: 'edit', eventId })}
            onEditLayer={(layerId) => setLayerDialog({ mode: 'edit', layerId })}
            onImportEvents={() => setEventImportOpen(true)}
            onMoveLayer={handleMoveLayer}
          />
        ) : (
          <EmptyState
            onCreate={() => setCreateTimelineOpen(true)}
            onImport={() => setTimelineImportOpen(true)}
          />
        )}
      </main>

      <TimelineNameDialog
        open={createTimelineOpen}
        onOpenChange={setCreateTimelineOpen}
        title="New timeline"
        description="Create a blank timeline with one layer to get started."
        submitLabel="Create timeline"
        onSubmit={handleCreateTimeline}
      />
      <TimelineImportDialog
        open={timelineImportOpen}
        onOpenChange={setTimelineImportOpen}
        onSubmit={handleTimelineImport}
      />
      {activeTimeline ? (
        <>
          <LayerDialog
            open={layerDialog !== null}
            onOpenChange={(open) => {
              if (!open) setLayerDialog(null)
            }}
            layer={selectedLayer}
            onSubmit={handleLayerSubmit}
            onRequestDelete={
              selectedLayer
                ? () =>
                    setDeleteIntent({
                      kind: 'layer',
                      id: selectedLayer.id,
                      title: selectedLayer.title,
                      eventCount: activeTimeline.events.filter(
                        (event) => event.layerId === selectedLayer.id,
                      ).length,
                    })
                : undefined
            }
          />
          <EventDialog
            open={eventDialog !== null}
            onOpenChange={(open) => {
              if (!open) setEventDialog(null)
            }}
            event={selectedEvent}
            layers={[...activeTimeline.layers].sort(
              (left, right) => left.order - right.order,
            )}
            defaultLayerId={defaultEventLayer}
            onSubmit={handleEventSubmit}
            onDuplicate={selectedEvent ? handleDuplicateEvent : undefined}
            onRequestDelete={
              selectedEvent
                ? () =>
                    setDeleteIntent({
                      kind: 'event',
                      id: selectedEvent.id,
                      title: selectedEvent.title,
                    })
                : undefined
            }
          />
          <EventImportDialog
            open={eventImportOpen}
            onOpenChange={setEventImportOpen}
            chatGptUrl={createChatGptEventUrl(activeTimeline)}
            onSubmit={handleEventImport}
          />
        </>
      ) : null}
      <ConfirmDeleteDialog
        open={deleteIntent !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIntent(null)
        }}
        title={deleteDialogTitle(deleteIntent)}
        description={deleteDialogDescription(deleteIntent)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

interface TimelineWorkspaceProps {
  timeline: TimelineRecord
  onRename: (title: string) => void
  onAddLayer: () => void
  onCreateEvent: (layerId: string) => void
  onEditEvent: (eventId: string) => void
  onEditLayer: (layerId: string) => void
  onImportEvents: () => void
  onMoveLayer: (layerId: string, direction: 'up' | 'down') => void
}

function TimelineWorkspace({
  timeline,
  onRename,
  onAddLayer,
  onCreateEvent,
  onEditEvent,
  onEditLayer,
  onImportEvents,
  onMoveLayer,
}: TimelineWorkspaceProps) {
  const range = calculateDateRange(timeline.events)
  const firstLayer = [...timeline.layers]
    .sort((left, right) => left.order - right.order)
    .at(0)

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Browser-local timeline
          </p>
          <TimelineTitleInput title={timeline.title} onRename={onRename} />
          <p className="mt-2 text-xs text-muted-foreground">
            {timeline.layers.length}{' '}
            {timeline.layers.length === 1 ? 'layer' : 'layers'} ·{' '}
            {timeline.events.length}{' '}
            {timeline.events.length === 1 ? 'event' : 'events'}
            {range ? ` · ${range.startDate} — ${range.endDate}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onAddLayer}>
            <IconLayersIntersect />
            Add layer
          </Button>
          <Button type="button" variant="outline" onClick={onImportEvents}>
            <IconJson />
            Import JSON
          </Button>
          <Button
            type="button"
            disabled={!firstLayer}
            onClick={() => {
              if (firstLayer) onCreateEvent(firstLayer.id)
            }}
          >
            <IconPlus />
            Add event
          </Button>
        </div>
      </div>
      <TimelineCanvas
        timeline={timeline}
        onCreateEvent={onCreateEvent}
        onEditEvent={onEditEvent}
        onEditLayer={onEditLayer}
        onMoveLayer={onMoveLayer}
      />
      <p className="mt-4 text-[11px] leading-4 text-muted-foreground">
        The full event range is fitted to the available width. Labels may be
        widened for readability; the colored bars preserve the exact dates.
      </p>
    </>
  )
}

function TimelineTitleInput({
  title,
  onRename,
}: {
  title: string
  onRename: (title: string) => void
}) {
  const [draftTitle, setDraftTitle] = useState(title)
  const renameDebouncer = useDebouncer(onRename, {
    wait: 500,
    onUnmount: (debouncer) => debouncer.flush(),
  })

  useEffect(() => {
    setDraftTitle(title)
  }, [title])

  return (
    <div className="group/title relative -ml-2 inline-flex max-w-full items-center">
      <h1 className="min-w-0">
        <Input
          aria-label="Timeline title"
          autoComplete="off"
          className="h-auto w-auto min-w-40 max-w-full border-0 border-b border-transparent bg-transparent px-2 py-1 pr-8 text-2xl font-semibold tracking-tight shadow-none hover:border-input focus-visible:border-ring focus-visible:bg-transparent focus-visible:ring-0 sm:text-3xl md:text-3xl dark:bg-transparent"
          size={Math.min(Math.max(draftTitle.length, 12), 60)}
          value={draftTitle}
          onBlur={() => {
            const nextTitle = draftTitle.trim()
            if (!nextTitle) {
              renameDebouncer.cancel()
              setDraftTitle(title)
              return
            }
            setDraftTitle(nextTitle)
            renameDebouncer.maybeExecute(nextTitle)
            renameDebouncer.flush()
          }}
          onChange={(event) => {
            const nextTitle = event.target.value
            setDraftTitle(nextTitle)
            if (!nextTitle.trim()) {
              renameDebouncer.cancel()
              return
            }
            renameDebouncer.maybeExecute(nextTitle)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              renameDebouncer.cancel()
              setDraftTitle(title)
            }
          }}
        />
      </h1>
      <IconPencil className="pointer-events-none absolute right-2 size-4 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-70 group-focus-within/title:opacity-70" />
    </div>
  )
}

function EmptyState({
  onCreate,
  onImport,
}: {
  onCreate: () => void
  onImport: () => void
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-md flex-col items-center justify-center text-center">
      <div className="mb-5 flex size-11 items-center justify-center border bg-card">
        <IconTimeline className="size-5" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        Create your first timeline
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Organize events into clear layers and see days or years in one fitted
        view. Your work stays in this browser.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={onCreate}>
          <IconPlus />
          New timeline
        </Button>
        <Button type="button" variant="outline" onClick={onImport}>
          <IconFileImport />
          Import timeline
        </Button>
      </div>
    </div>
  )
}

function deleteDialogTitle(intent: DeleteIntent | null): string {
  if (!intent) return 'Delete item?'
  if (intent.kind === 'timeline') return `Delete “${intent.title}”?`
  if (intent.kind === 'layer') return `Delete layer “${intent.title}”?`
  return `Delete event “${intent.title}”?`
}

function deleteDialogDescription(intent: DeleteIntent | null): string {
  if (!intent) return 'This action cannot be undone.'
  if (intent.kind === 'timeline') {
    return 'This removes the timeline and all of its layers and events from this browser. This action cannot be undone.'
  }
  if (intent.kind === 'layer') {
    const eventLabel = intent.eventCount === 1 ? 'event' : 'events'
    return `This also removes ${intent.eventCount} ${eventLabel} in the layer. This action cannot be undone.`
  }
  return 'This removes the event from this browser. This action cannot be undone.'
}
