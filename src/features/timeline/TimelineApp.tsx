import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useDebouncer } from '@tanstack/react-pacer/debouncer'
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCopy,
  IconDeviceFloppy,
  IconFileImport,
  IconJson,
  IconDots,
  IconKeyboard,
  IconLayersIntersect,
  IconMinus,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconShare,
  IconTimeline,
  IconTrash,
  IconX,
  IconZoomReset,
} from '@tabler/icons-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { ButtonGroup } from '#/components/ui/button-group'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { ThemeToggle } from '#/components/theme-toggle'
import { TimelineCanvas } from '#/features/timeline/TimelineCanvas'
import {
  ConfirmDeleteDialog,
  EventDialog,
  EventImportDialog,
  LayerDialog,
  ShareDialog,
  ShortcutsDialog,
  TimelineImportDialog,
  TimelineNameDialog,
} from '#/features/timeline/TimelineDialogs'
import type {
  EventFormValues,
  LayerFormValues,
  TimelineFormValues,
} from '#/features/timeline/TimelineDialogs'
import {
  ZOOM_STEP,
  calculateDateRange,
  isFittedToContent,
  panViewRange,
  zoomViewRange,
} from '#/features/timeline/layout'
import type { TimelineDateRange } from '#/features/timeline/layout'
import type { EventDates } from '#/features/timeline/drag'
import {
  createChatGptEventUrl,
  importEventsFromJson,
} from '#/features/timeline/eventImport'
import type { TimelineRecord } from '#/features/timeline/model'
import {
  DEFAULT_LAYER_COLOR,
  addEvent,
  addLayer,
  createTimeline,
  deleteEvent,
  deleteLayer,
  duplicateEvent,
  moveLayer,
  reorderLayers,
  selectTimelineAfterDeletion,
  updateEvent,
  updateLayer,
  updateTimelineTitle,
} from '#/features/timeline/operations'
import {
  EMPTY_TIMELINE_HISTORY,
  canRedo,
  canUndo,
  describeRedo,
  describeUndo,
  recordHistoryEntry,
  redoHistory,
  undoHistory,
} from '#/features/timeline/history'
import type { TimelineHistory } from '#/features/timeline/history'
import { getTimelineCollection } from '#/features/timeline/storage'
import { downloadTimelineExport } from '#/features/timeline/timelineExport'
import {
  downloadTimelinePng,
  downloadTimelineSvg,
} from '#/features/timeline/timelineImage'
import { importTimelineFromJson } from '#/features/timeline/timelineImport'
import { searchTimeline } from '#/features/timeline/search'
import { useTimelineShortcuts } from '#/features/timeline/shortcuts'
import {
  evaluateBackup,
  forgetBackup,
  readBackupLog,
  recordBackup,
  writeBackupLog,
} from '#/features/timeline/backup'
import type { BackupLog } from '#/features/timeline/backup'
import {
  createTimelineFromTemplate,
  timelineTemplates,
} from '#/features/timeline/templates'
import type { TimelineTemplate } from '#/features/timeline/templates'

interface TimelineAppProps {
  activeTimelineId?: string
  onSelectTimeline: (timelineId: string | undefined, replace?: boolean) => void
  /** A timeline decoded from a share link, shown read-only until saved. */
  sharedTimeline?: TimelineRecord
  onDismissShared?: () => void
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
  sharedTimeline,
  onDismissShared,
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
  const storedTimeline = timelines.find(
    (timeline) => timeline.id === activeTimelineId,
  )
  const activeTimeline = sharedTimeline ?? storedTimeline
  const isSharedView = sharedTimeline !== undefined

  const [createTimelineOpen, setCreateTimelineOpen] = useState(false)
  const [timelineImportOpen, setTimelineImportOpen] = useState(false)
  const [layerDialog, setLayerDialog] = useState<LayerDialogState>(null)
  const [eventDialog, setEventDialog] = useState<EventDialogState>(null)
  const [eventImportOpen, setEventImportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent | null>(null)
  const [storageError, setStorageError] = useState<string>()
  const [history, setHistory] = useState<TimelineHistory>(
    EMPTY_TIMELINE_HISTORY,
  )
  const [backupLog, setBackupLog] = useState<BackupLog>({})
  const [backupDismissed, setBackupDismissed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewRange, setViewRange] = useState<TimelineDateRange | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setBackupLog(readBackupLog(globalThis.localStorage))
  }, [])

  // No timeline in the URL means the home screen, so the only correction here
  // is dropping an id that no longer resolves to a stored timeline.
  useEffect(() => {
    if (isSharedView || query.isLoading) return
    if (activeTimelineId && !storedTimeline) onSelectTimeline(undefined, true)
  }, [
    activeTimelineId,
    isSharedView,
    onSelectTimeline,
    query.isLoading,
    storedTimeline,
  ])

  // Switching timelines resets the viewport and the search; both describe a
  // position within one timeline and mean nothing in another.
  useEffect(() => {
    setViewRange(null)
    setSearchQuery('')
    setBackupDismissed(false)
  }, [activeTimeline?.id])

  const contentRange = useMemo(
    () => (activeTimeline ? calculateDateRange(activeTimeline.events) : null),
    [activeTimeline],
  )
  const effectiveRange = viewRange ?? contentRange
  const isFitted =
    !viewRange || !contentRange || isFittedToContent(viewRange, contentRange)

  const search = useMemo(
    () =>
      activeTimeline
        ? searchTimeline(activeTimeline, searchQuery)
        : {
            matchedEventIds: new Set<string>(),
            matchCount: 0,
            isActive: false,
          },
    [activeTimeline, searchQuery],
  )

  // A viewport clamped to yesterday's content can fall outside today's; letting
  // it drift out of bounds would strand the reader on an empty stretch.
  useEffect(() => {
    if (!viewRange || !contentRange) return
    if (
      viewRange.startMs >= contentRange.startMs &&
      viewRange.endMs <= contentRange.endMs
    ) {
      return
    }
    setViewRange(null)
  }, [contentRange, viewRange])

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

  const writeTimeline = (timeline: TimelineRecord, message?: string) => {
    const transaction = collection.has(timeline.id)
      ? collection.update(timeline.id, (draft) => {
          Object.assign(draft, timeline)
        })
      : collection.insert(timeline)
    watchPersistence(transaction, message)
  }

  /** Applies an edit to the open timeline and remembers how to walk back out of it. */
  const persistTimeline = (
    timeline: TimelineRecord,
    label: string,
    message?: string,
  ) => {
    if (isSharedView) return

    setHistory((current) =>
      recordHistoryEntry(current, {
        label,
        timelineId: timeline.id,
        before: storedTimeline,
        after: timeline,
      }),
    )
    writeTimeline(timeline, message)
  }

  /**
   * Adds a timeline that did not exist before. The absent `before` is what
   * tells undo to remove it again rather than restore some earlier state.
   */
  const addTimeline = (
    timeline: TimelineRecord,
    label: string,
    message: string,
  ) => {
    setHistory((current) =>
      recordHistoryEntry(current, {
        label,
        timelineId: timeline.id,
        after: timeline,
      }),
    )
    writeTimeline(timeline, message)
    onSelectTimeline(timeline.id)
  }

  const applyHistoryStep = (direction: 'undo' | 'redo') => {
    const step =
      direction === 'undo' ? undoHistory(history) : redoHistory(history)
    if (!step) return

    setHistory(step.history)

    if (step.state) {
      writeTimeline(step.state)
      onSelectTimeline(step.state.id)
    } else {
      watchPersistence(collection.delete(step.entry.timelineId))
    }

    toast.success(
      `${direction === 'undo' ? 'Undid' : 'Redid'} ${step.entry.label.toLocaleLowerCase()}`,
    )
  }

  const handleCreateTimeline = ({ title }: TimelineFormValues) => {
    addTimeline(createTimeline(title), 'Create timeline', 'Timeline created')
  }

  const handleUseTemplate = (template: TimelineTemplate) => {
    addTimeline(
      createTimelineFromTemplate(template),
      'Create timeline',
      `Started from ${template.title}`,
    )
  }

  const handleTimelineImport = (json: string) => {
    addTimeline(
      importTimelineFromJson(json, {
        existingIds: timelines.map((candidate) => candidate.id),
      }),
      'Import timeline',
      'Timeline imported',
    )
  }

  const handleSaveSharedCopy = () => {
    if (!sharedTimeline) return
    addTimeline(
      importTimelineFromJson(JSON.stringify(sharedTimeline), {
        existingIds: timelines.map((candidate) => candidate.id),
      }),
      'Save shared timeline',
      'Saved to this browser',
    )
    onDismissShared?.()
  }

  const handleDuplicateTimeline = () => {
    if (!storedTimeline) return
    const now = new Date().toISOString()
    addTimeline(
      {
        ...storedTimeline,
        id: crypto.randomUUID(),
        title: `${storedTimeline.title} copy`,
        createdAt: now,
        updatedAt: now,
      },
      'Duplicate timeline',
      'Timeline duplicated',
    )
  }

  const handleRenameTimeline = (title: string) => {
    if (!storedTimeline || title.trim() === storedTimeline.title) return
    persistTimeline(
      updateTimelineTitle(storedTimeline, title),
      'Rename timeline',
    )
  }

  const handleLayerSubmit = (values: LayerFormValues) => {
    if (!storedTimeline || !layerDialog) return
    const input = {
      title: values.title,
      color: values.color,
      subtitle: values.subtitle || undefined,
      description: values.description || undefined,
    }
    const isNew = layerDialog.mode === 'new'
    const next = isNew
      ? addLayer(storedTimeline, input)
      : updateLayer(storedTimeline, layerDialog.layerId, input)
    persistTimeline(
      next,
      isNew ? 'Add layer' : 'Edit layer',
      isNew ? 'Layer added' : undefined,
    )
  }

  const handleEventSubmit = (values: EventFormValues) => {
    if (!storedTimeline || !eventDialog) return
    const input = {
      title: values.title,
      color: values.color,
      layerId: values.layerId,
      startDate: values.startDate,
      subtitle: values.subtitle || undefined,
      description: values.description || undefined,
      endDate: values.endDate || undefined,
    }
    const isNew = eventDialog.mode === 'new'
    const next = isNew
      ? addEvent(storedTimeline, input)
      : updateEvent(storedTimeline, eventDialog.eventId, input)
    persistTimeline(
      next,
      isNew ? 'Add event' : 'Edit event',
      isNew ? 'Event added' : undefined,
    )
  }

  /**
   * Dragging can land an event on top of a neighbour, which the model forbids.
   * The drag is simply refused and the canvas snaps back, so a slip never
   * silently rewrites the dates of two events.
   */
  const handleChangeEventDates = (eventId: string, dates: EventDates) => {
    if (!storedTimeline) return

    try {
      persistTimeline(updateEvent(storedTimeline, eventId, dates), 'Move event')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'That change would overlap another event.',
      )
    }
  }

  /**
   * Recovery from an overlap: give the event a lane of its own. The layer and
   * the event move in a single commit so undo treats them as one step and the
   * event never sees a store that lacks its new layer.
   */
  const handleMoveEventToNewLayer = (values: EventFormValues) => {
    if (!storedTimeline || !eventDialog) return

    const layerTitle = `Layer ${storedTimeline.layers.length + 1}`
    const withLayer = addLayer(storedTimeline, {
      title: layerTitle,
      color: DEFAULT_LAYER_COLOR,
    })
    const layerId = withLayer.layers[withLayer.layers.length - 1].id
    const input = {
      title: values.title,
      color: values.color,
      layerId,
      startDate: values.startDate,
      subtitle: values.subtitle || undefined,
      description: values.description || undefined,
      endDate: values.endDate || undefined,
    }

    try {
      const next =
        eventDialog.mode === 'new'
          ? addEvent(withLayer, input)
          : updateEvent(withLayer, eventDialog.eventId, input)
      persistTimeline(
        next,
        'Move event to a new layer',
        `Moved to ${layerTitle}`,
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'The event could not be moved.',
      )
    }
  }

  const handleDuplicateEvent = () => {
    if (!storedTimeline || eventDialog?.mode !== 'edit') return
    const copyId = crypto.randomUUID()
    persistTimeline(
      duplicateEvent(storedTimeline, eventDialog.eventId, { id: copyId }),
      'Duplicate event',
      'Event duplicated',
    )
    setEventDialog({ mode: 'edit', eventId: copyId })
  }

  const handleEventImport = (json: string) => {
    if (!storedTimeline) return
    const eventCountBeforeImport = storedTimeline.events.length
    const next = importEventsFromJson(storedTimeline, json)
    const importedCount = next.events.length - eventCountBeforeImport
    persistTimeline(
      next,
      'Import events',
      `${importedCount} ${importedCount === 1 ? 'event' : 'events'} imported`,
    )
  }

  const handleMoveLayer = (layerId: string, direction: 'up' | 'down') => {
    if (!storedTimeline) return
    persistTimeline(
      moveLayer(storedTimeline, layerId, direction),
      'Reorder layers',
    )
  }

  const handleReorderLayers = (orderedLayerIds: Array<string>) => {
    if (!storedTimeline) return
    persistTimeline(
      reorderLayers(storedTimeline, orderedLayerIds),
      'Reorder layers',
    )
  }

  const markExported = (timelineId: string) => {
    setBackupLog((current) => {
      const next = recordBackup(current, timelineId)
      writeBackupLog(globalThis.localStorage, next)
      return next
    })
  }

  const handleExport = () => {
    if (!activeTimeline) return
    downloadTimelineExport(activeTimeline)
    markExported(activeTimeline.id)
    toast.success('Timeline exported')
  }

  const handleExportImage = async (format: 'svg' | 'png') => {
    if (!activeTimeline) return

    const options = {
      range: effectiveRange,
      theme: document.documentElement.classList.contains('dark')
        ? ('dark' as const)
        : ('light' as const),
    }

    try {
      if (format === 'svg') downloadTimelineSvg(activeTimeline, options)
      else await downloadTimelinePng(activeTimeline, options)
      toast.success(`Timeline exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'The image could not be created.',
      )
    }
  }

  // The brand link owns the navigation itself; this only clears the shared
  // timeline, which lives outside the router in the URL fragment.
  const handleNavigateHome = useCallback(() => {
    if (isSharedView) onDismissShared?.()
  }, [isSharedView, onDismissShared])

  const handleDelete = () => {
    if (!deleteIntent) return

    if (deleteIntent.kind === 'timeline') {
      const doomed = timelines.find(
        (timeline) => timeline.id === deleteIntent.id,
      )
      const nextSelection = selectTimelineAfterDeletion(
        timelines,
        deleteIntent.id,
        activeTimelineId,
      )
      if (doomed) {
        setHistory((current) =>
          recordHistoryEntry(current, {
            label: 'Delete timeline',
            timelineId: doomed.id,
            before: doomed,
          }),
        )
      }
      watchPersistence(collection.delete(deleteIntent.id), 'Timeline deleted')
      setBackupLog((current) => {
        const next = forgetBackup(current, deleteIntent.id)
        writeBackupLog(globalThis.localStorage, next)
        return next
      })
      onSelectTimeline(nextSelection)
      return
    }

    if (!storedTimeline) return
    const next =
      deleteIntent.kind === 'layer'
        ? deleteLayer(storedTimeline, deleteIntent.id)
        : deleteEvent(storedTimeline, deleteIntent.id)
    persistTimeline(
      next,
      deleteIntent.kind === 'layer' ? 'Delete layer' : 'Delete event',
      deleteIntent.kind === 'layer'
        ? 'Layer deleted — press ⌘Z to undo'
        : 'Event deleted — press ⌘Z to undo',
    )
  }

  const zoomBy = useCallback(
    (factor: number) => {
      if (!contentRange) return
      setViewRange((current) =>
        zoomViewRange(current ?? contentRange, contentRange, factor),
      )
    },
    [contentRange],
  )

  const panBy = useCallback(
    (deltaRatio: number) => {
      if (!contentRange) return
      setViewRange((current) =>
        panViewRange(current ?? contentRange, contentRange, deltaRatio),
      )
    },
    [contentRange],
  )

  const firstLayerId = useMemo(() => {
    if (!activeTimeline) return undefined
    return [...activeTimeline.layers].sort(
      (left, right) => left.order - right.order,
    )[0]?.id
  }, [activeTimeline])

  useTimelineShortcuts(
    {
      onNewEvent: () => {
        if (firstLayerId && !isSharedView) {
          setEventDialog({ mode: 'new', layerId: firstLayerId })
        }
      },
      onNewLayer: () => {
        if (storedTimeline) setLayerDialog({ mode: 'new' })
      },
      onUndo: () => applyHistoryStep('undo'),
      onRedo: () => applyHistoryStep('redo'),
      onZoomIn: () => zoomBy(1 / ZOOM_STEP),
      onZoomOut: () => zoomBy(ZOOM_STEP),
      onZoomFit: () => setViewRange(null),
      onPanLeft: () => panBy(-0.2),
      onPanRight: () => panBy(0.2),
      onSearch: () => searchInputRef.current?.focus(),
      onExport: handleExport,
      onHelp: () => setShortcutsOpen(true),
    },
    // Deliberately not gated on having a timeline open: undoing the creation of
    // the only timeline lands on the empty state, and redo has to still work
    // from there. Every handler above already guards itself.
    true,
  )

  if (query.isLoading && !isSharedView) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Loading timelines…</p>
      </main>
    )
  }

  if (query.isError && !isSharedView) {
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
    storedTimeline && layerDialog?.mode === 'edit'
      ? storedTimeline.layers.find((layer) => layer.id === layerDialog.layerId)
      : undefined
  const selectedEvent =
    storedTimeline && eventDialog?.mode === 'edit'
      ? storedTimeline.events.find((event) => event.id === eventDialog.eventId)
      : undefined
  const defaultEventLayer =
    eventDialog?.mode === 'new' ? eventDialog.layerId : undefined
  const backup =
    storedTimeline && !isSharedView
      ? evaluateBackup(storedTimeline, backupLog)
      : null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <TimelineBrand onNavigateHome={handleNavigateHome} />
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {timelines.length > 0 && !isSharedView ? (
              <Select
                value={storedTimeline?.id ?? ''}
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
            {isSharedView ? (
              <Button type="button" size="sm" onClick={handleSaveSharedCopy}>
                <IconDeviceFloppy />
                Save a copy
              </Button>
            ) : (
              <>
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
              </>
            )}
            <ThemeToggle />
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
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                    <IconShare />
                    Share a link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleExport}>
                    <IconJson />
                    Export JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void handleExportImage('png')}
                  >
                    <IconPhoto />
                    Export PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void handleExportImage('svg')}
                  >
                    <IconPhoto />
                    Export SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.print()}>
                    <IconPrinter />
                    Print
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                    <IconKeyboard />
                    Keyboard shortcuts
                  </DropdownMenuItem>
                  {storedTimeline && !isSharedView ? (
                    <>
                      <DropdownMenuItem onSelect={handleDuplicateTimeline}>
                        <IconCopy />
                        Duplicate timeline
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setDeleteIntent({
                            kind: 'timeline',
                            id: storedTimeline.id,
                            title: storedTimeline.title,
                          })
                        }
                      >
                        <IconTrash />
                        Delete timeline
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
        {isSharedView ? (
          <Alert className="mb-6 print:hidden">
            <IconShare />
            <AlertTitle>You are viewing a shared timeline</AlertTitle>
            <AlertDescription>
              <p>
                This timeline came from a link and is read-only. Nothing has
                been added to this browser yet.
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleSaveSharedCopy}>
                  <IconDeviceFloppy />
                  Save a copy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onDismissShared}
                >
                  Close
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {storageError ? (
          <Alert variant="destructive" className="mb-6 print:hidden">
            <IconAlertTriangle />
            <AlertTitle>Changes are not being saved</AlertTitle>
            <AlertDescription>{storageError}</AlertDescription>
          </Alert>
        ) : null}

        {backup?.shouldRemind && !backupDismissed ? (
          <Alert className="mb-6 print:hidden">
            <IconDeviceFloppy />
            <AlertTitle>Keep a backup of this timeline</AlertTitle>
            <AlertDescription>
              <p>
                {backup.message} Browsers can clear local storage without
                warning, and there is no copy anywhere else.
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleExport}>
                  <IconJson />
                  Export now
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setBackupDismissed(true)}
                >
                  Not now
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {activeTimeline ? (
          <TimelineWorkspace
            key={activeTimeline.id}
            timeline={activeTimeline}
            readOnly={isSharedView}
            range={effectiveRange}
            contentRange={contentRange}
            isFitted={isFitted}
            history={history}
            search={search}
            searchQuery={searchQuery}
            searchInputRef={searchInputRef}
            onSearchQueryChange={setSearchQuery}
            onViewRangeChange={setViewRange}
            onZoomIn={() => zoomBy(1 / ZOOM_STEP)}
            onZoomOut={() => zoomBy(ZOOM_STEP)}
            onZoomFit={() => setViewRange(null)}
            onUndo={() => applyHistoryStep('undo')}
            onRedo={() => applyHistoryStep('redo')}
            onRename={handleRenameTimeline}
            onAddLayer={() => setLayerDialog({ mode: 'new' })}
            onCreateEvent={(layerId) =>
              setEventDialog({ mode: 'new', layerId })
            }
            onEditEvent={(eventId) => setEventDialog({ mode: 'edit', eventId })}
            onEditLayer={(layerId) => setLayerDialog({ mode: 'edit', layerId })}
            onImportEvents={() => setEventImportOpen(true)}
            onMoveLayer={handleMoveLayer}
            onReorderLayers={handleReorderLayers}
            onChangeEventDates={handleChangeEventDates}
          />
        ) : (
          <EmptyState
            timelines={timelines}
            onOpenTimeline={(timelineId) => onSelectTimeline(timelineId)}
            onCreate={() => setCreateTimelineOpen(true)}
            onImport={() => setTimelineImportOpen(true)}
            onUseTemplate={handleUseTemplate}
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
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      {activeTimeline ? (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          timeline={activeTimeline}
        />
      ) : null}
      {storedTimeline && !isSharedView ? (
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
                      eventCount: storedTimeline.events.filter(
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
            layers={[...storedTimeline.layers].sort(
              (left, right) => left.order - right.order,
            )}
            defaultLayerId={defaultEventLayer}
            onSubmit={handleEventSubmit}
            onDuplicate={selectedEvent ? handleDuplicateEvent : undefined}
            onMoveToNewLayer={handleMoveEventToNewLayer}
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
            chatGptUrl={createChatGptEventUrl(storedTimeline)}
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
  readOnly: boolean
  range: TimelineDateRange | null
  contentRange: TimelineDateRange | null
  isFitted: boolean
  history: TimelineHistory
  search: {
    matchedEventIds: ReadonlySet<string>
    matchCount: number
    isActive: boolean
  }
  searchQuery: string
  searchInputRef: React.RefObject<HTMLInputElement | null>
  onSearchQueryChange: (query: string) => void
  onViewRangeChange: (range: TimelineDateRange | null) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  onUndo: () => void
  onRedo: () => void
  onRename: (title: string) => void
  onAddLayer: () => void
  onCreateEvent: (layerId: string) => void
  onEditEvent: (eventId: string) => void
  onEditLayer: (layerId: string) => void
  onImportEvents: () => void
  onMoveLayer: (layerId: string, direction: 'up' | 'down') => void
  onReorderLayers: (orderedLayerIds: Array<string>) => void
  onChangeEventDates: (eventId: string, dates: EventDates) => void
}

function TimelineWorkspace({
  timeline,
  readOnly,
  range,
  contentRange,
  isFitted,
  history,
  search,
  searchQuery,
  searchInputRef,
  onSearchQueryChange,
  onViewRangeChange,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onUndo,
  onRedo,
  onRename,
  onAddLayer,
  onCreateEvent,
  onEditEvent,
  onEditLayer,
  onImportEvents,
  onMoveLayer,
  onReorderLayers,
  onChangeEventDates,
}: TimelineWorkspaceProps) {
  const firstLayer = [...timeline.layers]
    .sort((left, right) => left.order - right.order)
    .at(0)

  return (
    <TooltipProvider>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            {readOnly ? 'Shared timeline' : 'Browser-local timeline'}
          </p>
          {readOnly ? (
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {timeline.title}
            </h1>
          ) : (
            <TimelineTitleInput title={timeline.title} onRename={onRename} />
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {timeline.layers.length}{' '}
            {timeline.layers.length === 1 ? 'layer' : 'layers'} ·{' '}
            {timeline.events.length}{' '}
            {timeline.events.length === 1 ? 'event' : 'events'}
            {contentRange
              ? ` · ${contentRange.startDate} — ${contentRange.endDate}`
              : ''}
            {range && !isFitted
              ? ` · showing ${range.startDate} — ${range.endDate}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {readOnly ? null : (
            <ButtonGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Undo"
                    disabled={!canUndo(history)}
                    onClick={onUndo}
                  >
                    <IconArrowBackUp />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {describeUndo(history)
                    ? `Undo ${describeUndo(history)?.toLocaleLowerCase()}`
                    : 'Nothing to undo'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Redo"
                    disabled={!canRedo(history)}
                    onClick={onRedo}
                  >
                    <IconArrowForwardUp />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {describeRedo(history)
                    ? `Redo ${describeRedo(history)?.toLocaleLowerCase()}`
                    : 'Nothing to redo'}
                </TooltipContent>
              </Tooltip>
            </ButtonGroup>
          )}
          <ButtonGroup>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Zoom out"
              disabled={!contentRange || isFitted}
              onClick={onZoomOut}
            >
              <IconMinus />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Zoom in"
              disabled={!contentRange}
              onClick={onZoomIn}
            >
              <IconPlus />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Fit the whole timeline"
              disabled={isFitted}
              onClick={onZoomFit}
            >
              <IconZoomReset />
            </Button>
          </ButtonGroup>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  onSearchQueryChange('')
                  event.currentTarget.blur()
                }
              }}
              placeholder="Search events"
              aria-label="Search events"
              className="w-40 pl-8 lg:w-52"
            />
            {search.isActive ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => onSearchQueryChange('')}
              >
                <IconX className="size-3.5" />
              </button>
            ) : null}
          </div>
          {readOnly ? null : (
            <>
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
            </>
          )}
        </div>
      </div>
      {search.isActive ? (
        <p className="mb-2 text-xs text-muted-foreground print:hidden">
          {search.matchCount}{' '}
          {search.matchCount === 1 ? 'event matches' : 'events match'} “
          {searchQuery.trim()}”. Others are dimmed.
        </p>
      ) : null}
      <TimelineCanvas
        timeline={timeline}
        range={range}
        contentRange={contentRange}
        matchedEventIds={search.matchedEventIds}
        isSearchActive={search.isActive}
        readOnly={readOnly}
        onViewRangeChange={onViewRangeChange}
        onCreateEvent={onCreateEvent}
        onEditEvent={onEditEvent}
        onEditLayer={onEditLayer}
        onMoveLayer={onMoveLayer}
        onReorderLayers={onReorderLayers}
        onChangeEventDates={onChangeEventDates}
      />
      <p className="mt-4 text-[11px] leading-4 text-muted-foreground print:hidden">
        {readOnly
          ? 'Drag the canvas to pan and use ⌘-scroll to zoom.'
          : 'Drag an event to move it, or its edges to change its length. Drag the canvas to pan, ⌘-scroll to zoom, and press ? for shortcuts.'}
      </p>
    </TooltipProvider>
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
    <div className="timeline-title-shell group/title relative -ml-2 inline-flex max-w-full items-center">
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

function TimelineBrand({ onNavigateHome }: { onNavigateHome: () => void }) {
  return (
    <Link
      to="/"
      search={{}}
      onClick={onNavigateHome}
      aria-label="tlmkr.com home"
      className="tlmkr-brand flex shrink-0 items-center gap-2 rounded-sm text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <IconTimeline aria-hidden="true" className="tlmkr-brand-icon size-4" />
      <span className="tlmkr-wordmark hidden sm:inline-flex" aria-hidden="true">
        {Array.from('tlmkr.com').map((character, index) => (
          <span
            key={`${character}-${index}`}
            className="tlmkr-letter"
            style={{ animationDelay: `${index * 32}ms` }}
          >
            {character}
          </span>
        ))}
        <span className="tlmkr-rail">
          <span className="tlmkr-playhead" />
        </span>
      </span>
    </Link>
  )
}

function EmptyState({
  timelines,
  onOpenTimeline,
  onCreate,
  onImport,
  onUseTemplate,
}: {
  timelines: Array<TimelineRecord>
  onOpenTimeline: (timelineId: string) => void
  onCreate: () => void
  onImport: () => void
  onUseTemplate: (template: TimelineTemplate) => void
}) {
  const hasTimelines = timelines.length > 0

  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-2xl flex-col items-center justify-center text-center">
      <div className="mb-5 flex size-11 items-center justify-center border bg-card">
        <IconTimeline className="size-5" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        {hasTimelines ? 'Open a timeline' : 'Create your first timeline'}
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

      {hasTimelines ? (
        <>
          <p className="mt-10 mb-3 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Your timelines
          </p>
          <div className="grid w-full gap-2 sm:grid-cols-2">
            {timelines.map((timeline) => (
              <button
                key={timeline.id}
                type="button"
                className="border bg-card p-4 text-left outline-none transition-colors hover:border-foreground/25 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => onOpenTimeline(timeline.id)}
              >
                <span className="block text-sm font-medium">
                  {timeline.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {timeline.layers.length}{' '}
                  {timeline.layers.length === 1 ? 'layer' : 'layers'} ·{' '}
                  {timeline.events.length}{' '}
                  {timeline.events.length === 1 ? 'event' : 'events'}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <p className="mt-10 mb-3 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
        {hasTimelines ? 'Start from a template' : 'Or start from a template'}
      </p>
      <div className="grid w-full gap-2 sm:grid-cols-3">
        {timelineTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="border bg-card p-4 text-left outline-none transition-colors hover:border-foreground/25 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => onUseTemplate(template)}
          >
            <span className="flex items-center gap-1.5">
              {template.layers.map((layer) => (
                <span
                  key={layer.title}
                  className="size-2 rounded-full"
                  style={{ backgroundColor: layer.color }}
                  aria-hidden="true"
                />
              ))}
            </span>
            <span className="mt-2 block text-sm font-medium">
              {template.title}
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {template.description}
            </span>
          </button>
        ))}
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
  if (!intent) return 'This can be undone with ⌘Z.'
  if (intent.kind === 'timeline') {
    return 'This removes the timeline and all of its layers and events from this browser. You can undo it with ⌘Z until you reload the page.'
  }
  if (intent.kind === 'layer') {
    const eventLabel = intent.eventCount === 1 ? 'event' : 'events'
    return `This also removes ${intent.eventCount} ${eventLabel} in the layer. You can undo it with ⌘Z.`
  }
  return 'This removes the event from this browser. You can undo it with ⌘Z.'
}
