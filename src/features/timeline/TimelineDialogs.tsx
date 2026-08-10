import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import {
  IconBrandOpenai,
  IconCopy,
  IconExternalLink,
  IconJson,
  IconTrash,
} from '@tabler/icons-react'
import { z } from 'zod'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import type { TimelineEvent, TimelineLayer } from '#/features/timeline/model'

const titleSchema = z.string().trim().min(1, 'A title is required.')
const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'Choose a valid color.')
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

const timelineFormSchema = z.object({ title: titleSchema })
const layerFormSchema = z.object({
  title: titleSchema,
  subtitle: z.string(),
  description: z.string(),
  color: colorSchema,
})
const eventFormSchema = z
  .object({
    title: titleSchema,
    subtitle: z.string(),
    description: z.string(),
    color: colorSchema,
    layerId: z.string().uuid('Choose a layer.'),
    startDate: z.string().regex(isoDatePattern, 'Choose a start date.'),
    endDate: z
      .string()
      .refine(
        (value) => value === '' || isoDatePattern.test(value),
        'Choose a valid end date.',
      ),
  })
  .superRefine((value, context) => {
    if (value.endDate && value.endDate < value.startDate) {
      context.addIssue({
        code: 'custom',
        message: 'End date must be on or after the start date.',
        path: ['endDate'],
      })
    }
  })

const eventImportFormSchema = z.object({
  json: z.string().trim().min(1, 'Paste JSON or choose a JSON file.'),
})

export interface TimelineFormValues {
  title: string
}

export interface LayerFormValues {
  title: string
  subtitle: string
  description: string
  color: string
}

export interface EventFormValues {
  title: string
  subtitle: string
  description: string
  color: string
  layerId: string
  startDate: string
  endDate: string
}

interface EventImportFormValues {
  json: string
}

interface TimelineNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  submitLabel: string
  initialTitle?: string
  onSubmit: (values: TimelineFormValues) => void
}

export function TimelineNameDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialTitle = '',
  onSubmit,
}: TimelineNameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <TimelineNameForm
          key={initialTitle}
          title={title}
          description={description}
          submitLabel={submitLabel}
          initialTitle={initialTitle}
          onCancel={() => onOpenChange(false)}
          onSubmit={(values) => {
            onSubmit(values)
            onOpenChange(false)
          }}
        />
      ) : null}
    </Dialog>
  )
}

function TimelineNameForm({
  title,
  description,
  submitLabel,
  initialTitle = '',
  onCancel,
  onSubmit,
}: Omit<TimelineNameDialogProps, 'open' | 'onOpenChange'> & {
  onCancel: () => void
}) {
  const form = useForm({
    defaultValues: { title: initialTitle } satisfies TimelineFormValues,
    validators: { onSubmit: timelineFormSchema },
    onSubmit: ({ value }) => onSubmit({ title: value.title.trim() }),
  })

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field name="title">
            {(field) => {
              const invalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={invalid}
                    autoComplete="off"
                    autoFocus
                  />
                  {invalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </DialogClose>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {submitLabel}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

interface LayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layer?: TimelineLayer
  onSubmit: (values: LayerFormValues) => void
  onRequestDelete?: () => void
}

export function LayerDialog({
  open,
  onOpenChange,
  layer,
  onSubmit,
  onRequestDelete,
}: LayerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <LayerForm
          key={layer?.id ?? 'new-layer'}
          layer={layer}
          onCancel={() => onOpenChange(false)}
          onRequestDelete={onRequestDelete}
          onSubmit={(values) => {
            onSubmit(values)
            onOpenChange(false)
          }}
        />
      ) : null}
    </Dialog>
  )
}

function LayerForm({
  layer,
  onCancel,
  onSubmit,
  onRequestDelete,
}: Omit<LayerDialogProps, 'open' | 'onOpenChange'> & { onCancel: () => void }) {
  const form = useForm({
    defaultValues: {
      title: layer?.title ?? '',
      subtitle: layer?.subtitle ?? '',
      description: layer?.description ?? '',
      color: layer?.color ?? '#64748b',
    } satisfies LayerFormValues,
    validators: { onSubmit: layerFormSchema },
    onSubmit: ({ value }) =>
      onSubmit({
        title: value.title.trim(),
        subtitle: value.subtitle.trim(),
        description: value.description.trim(),
        color: value.color,
      }),
  })

  return (
    <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{layer ? 'Edit layer' : 'New layer'}</DialogTitle>
        <DialogDescription>
          Layers keep related events together in a horizontal lane.
        </DialogDescription>
      </DialogHeader>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field name="title">
            {(field) => <TextFormField field={field} label="Title" autoFocus />}
          </form.Field>
          <form.Field name="subtitle">
            {(field) => <TextFormField field={field} label="Subtitle" />}
          </form.Field>
          <form.Field name="description">
            {(field) => <TextareaFormField field={field} label="Description" />}
          </form.Field>
          <form.Field name="color">
            {(field) => <ColorFormField field={field} />}
          </form.Field>
        </FieldGroup>
        <DialogFooter className="sm:justify-between">
          <div>
            {layer && onRequestDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onCancel()
                  onRequestDelete()
                }}
              >
                <IconTrash />
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">
              {layer ? 'Save changes' : 'Add layer'}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: TimelineEvent
  layers: Array<TimelineLayer>
  defaultLayerId?: string
  onSubmit: (values: EventFormValues) => void
  onDuplicate?: () => void
  onRequestDelete?: () => void
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  layers,
  defaultLayerId,
  onSubmit,
  onDuplicate,
  onRequestDelete,
}: EventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <EventForm
          key={event?.id ?? `new-event-${defaultLayerId ?? ''}`}
          event={event}
          layers={layers}
          defaultLayerId={defaultLayerId}
          onCancel={() => onOpenChange(false)}
          onDuplicate={onDuplicate}
          onRequestDelete={onRequestDelete}
          onSubmit={(values) => {
            onSubmit(values)
            onOpenChange(false)
          }}
        />
      ) : null}
    </Dialog>
  )
}

interface EventImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatGptUrl: string
  onSubmit: (json: string) => void
}

export function EventImportDialog({
  open,
  onOpenChange,
  chatGptUrl,
  onSubmit,
}: EventImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <EventImportForm
          chatGptUrl={chatGptUrl}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  )
}

function EventImportForm({
  chatGptUrl,
  onCancel,
  onSubmit,
}: Pick<EventImportDialogProps, 'chatGptUrl' | 'onSubmit'> & {
  onCancel: () => void
}) {
  const [importError, setImportError] = useState<string>()
  const form = useForm({
    defaultValues: { json: '' } satisfies EventImportFormValues,
    validators: { onSubmit: eventImportFormSchema },
    onSubmit: ({ value }) => {
      try {
        onSubmit(value.json)
        onCancel()
      } catch (error) {
        setImportError(
          error instanceof Error
            ? error.message
            : 'The events could not be imported.',
        )
      }
    },
  })

  return (
    <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Import events from JSON</DialogTitle>
        <DialogDescription>
          Add multiple events to this timeline. Existing events will not be
          changed.
        </DialogDescription>
      </DialogHeader>
      <Alert>
        <IconBrandOpenai />
        <AlertTitle>Generate the JSON with ChatGPT</AlertTitle>
        <AlertDescription>
          <p>
            Open a prepared chat that knows the required format and this
            timeline&apos;s layer names, then describe the events you want.
          </p>
          <Button asChild type="button" size="sm" variant="outline">
            <a href={chatGptUrl} target="_blank" rel="noreferrer">
              Open ChatGPT
              <IconExternalLink />
            </a>
          </Button>
        </AlertDescription>
      </Alert>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault()
          setImportError(undefined)
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="event-import-file">JSON file</FieldLabel>
            <Input
              id="event-import-file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                setImportError(undefined)
                void file
                  .text()
                  .then((json) => form.setFieldValue('json', json))
                  .catch(() =>
                    setImportError('The selected file could not be read.'),
                  )
              }}
            />
          </Field>
          <form.Field name="json">
            {(field) => {
              const invalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>JSON</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      setImportError(undefined)
                      field.handleChange(event.target.value)
                    }}
                    aria-invalid={invalid || importError !== undefined}
                    placeholder={'{\n  "events": [\n    { ... }\n  ]\n}'}
                    rows={13}
                    className="resize-y font-mono text-xs"
                    autoFocus
                  />
                  {invalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>
          {importError ? (
            <Alert variant="destructive">
              <IconJson />
              <AlertTitle>Check the JSON</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit">
            <IconJson />
            Import events
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function EventForm({
  event,
  layers,
  defaultLayerId,
  onCancel,
  onSubmit,
  onDuplicate,
  onRequestDelete,
}: Omit<EventDialogProps, 'open' | 'onOpenChange'> & { onCancel: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const initialLayerId = event
    ? event.layerId
    : defaultLayerId || layers[0]?.id || ''
  const form = useForm({
    defaultValues: {
      title: event?.title ?? '',
      subtitle: event?.subtitle ?? '',
      description: event?.description ?? '',
      color: event?.color ?? '#2563eb',
      layerId: initialLayerId,
      startDate: event?.startDate ?? today,
      endDate: event?.endDate ?? '',
    } satisfies EventFormValues,
    validators: { onSubmit: eventFormSchema },
    onSubmit: ({ value }) =>
      onSubmit({
        title: value.title.trim(),
        subtitle: value.subtitle.trim(),
        description: value.description.trim(),
        color: value.color,
        layerId: value.layerId,
        startDate: value.startDate,
        endDate: value.endDate,
      }),
  })

  return (
    <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{event ? 'Edit event' : 'New event'}</DialogTitle>
        <DialogDescription>
          Add a single date or an optional end date for a span.
        </DialogDescription>
      </DialogHeader>
      <form
        className="contents"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field name="title">
            {(field) => <TextFormField field={field} label="Title" autoFocus />}
          </form.Field>
          <form.Field name="subtitle">
            {(field) => <TextFormField field={field} label="Subtitle" />}
          </form.Field>
          <form.Field name="description">
            {(field) => <TextareaFormField field={field} label="Description" />}
          </form.Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <form.Field name="layerId">
              {(field) => {
                const invalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={invalid}>
                    <FieldLabel htmlFor="event-layer">Layer</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger
                        id="event-layer"
                        className="w-full"
                        aria-invalid={invalid}
                      >
                        <SelectValue placeholder="Choose a layer" />
                      </SelectTrigger>
                      <SelectContent>
                        {layers.map((layer) => (
                          <SelectItem key={layer.id} value={layer.id}>
                            {layer.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {invalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>
            <form.Field name="color">
              {(field) => <ColorFormField field={field} />}
            </form.Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <form.Field name="startDate">
              {(field) => <DateFormField field={field} label="Start date" />}
            </form.Field>
            <form.Field name="endDate">
              {(field) => (
                <DateFormField field={field} label="End date" optional />
              )}
            </form.Field>
          </div>
        </FieldGroup>
        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            {event && onRequestDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onCancel()
                  onRequestDelete()
                }}
              >
                <IconTrash />
                Delete
              </Button>
            ) : null}
            {event && onDuplicate ? (
              <Button type="button" variant="outline" onClick={onDuplicate}>
                <IconCopy />
                Duplicate
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">
              {event ? 'Save changes' : 'Add event'}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  actionLabel?: string
  onConfirm: () => void
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = 'Delete',
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface StringFieldController {
  name: string
  state: {
    value: string
    meta: {
      errors: Array<{ message?: string } | undefined>
      isTouched: boolean
      isValid: boolean
    }
  }
  handleBlur: () => void
  handleChange: (value: string) => void
}

function TextFormField({
  field,
  label,
  autoFocus,
}: {
  field: StringFieldController
  label: string
  autoFocus?: boolean
}) {
  const invalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
    </Field>
  )
}

function TextareaFormField({
  field,
  label,
}: {
  field: StringFieldController
  label: string
}) {
  const invalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Textarea
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        rows={4}
        className="resize-y"
      />
      {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
    </Field>
  )
}

function ColorFormField({ field }: { field: StringFieldController }) {
  const invalid = field.state.meta.isTouched && !field.state.meta.isValid
  const isValidHex = /^#[0-9a-f]{6}$/i.test(field.state.value)

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={`${field.name}-hex`}>Color</FieldLabel>
      <div className="flex items-center gap-3">
        <Input
          id={`${field.name}-picker`}
          type="color"
          value={isValidHex ? field.state.value : '#000000'}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          aria-invalid={invalid}
          aria-label="Color picker"
          className="h-8 w-14 p-1"
        />
        <Input
          id={`${field.name}-hex`}
          name={field.name}
          type="text"
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(event) => {
            const value = event.target.value
            field.handleChange(
              value && !value.startsWith('#') ? `#${value}` : value,
            )
          }}
          aria-invalid={invalid}
          aria-label="Hex color"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={7}
          placeholder="#2563EB"
          className="w-28 font-mono uppercase"
        />
      </div>
      {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
    </Field>
  )
}

function DateFormField({
  field,
  label,
  optional,
}: {
  field: StringFieldController
  label: string
  optional?: boolean
}) {
  const invalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">Optional</span>
        ) : null}
      </FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        type="date"
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        required={!optional}
      />
      {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
    </Field>
  )
}
