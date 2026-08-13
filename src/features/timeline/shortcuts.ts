import { useEffect, useRef } from 'react'

export interface ShortcutDefinition {
  keys: Array<string>
  description: string
  group: 'Editing' | 'View' | 'General'
}

/** Documented once so the help dialog can never drift from the handler. */
export const shortcutDefinitions: ReadonlyArray<ShortcutDefinition> = [
  { keys: ['N'], description: 'New event', group: 'Editing' },
  { keys: ['L'], description: 'New layer', group: 'Editing' },
  { keys: ['Mod', 'Z'], description: 'Undo', group: 'Editing' },
  { keys: ['Mod', '⇧', 'Z'], description: 'Redo', group: 'Editing' },
  { keys: ['+'], description: 'Zoom in', group: 'View' },
  { keys: ['−'], description: 'Zoom out', group: 'View' },
  { keys: ['0'], description: 'Fit the whole timeline', group: 'View' },
  { keys: ['←', '→'], description: 'Pan left and right', group: 'View' },
  { keys: ['/'], description: 'Search events', group: 'General' },
  { keys: ['Mod', 'E'], description: 'Export JSON', group: 'General' },
  { keys: ['?'], description: 'Show this list', group: 'General' },
]

export interface ShortcutHandlers {
  onNewEvent?: () => void
  onNewLayer?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomFit?: () => void
  onPanLeft?: () => void
  onPanRight?: () => void
  onSearch?: () => void
  onExport?: () => void
  onHelp?: () => void
}

/**
 * True while the keystroke belongs to something else: a text field, a
 * contenteditable, or an open dialog whose own controls take precedence.
 */
function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"],[role="alertdialog"]') !== null
}

export function useTimelineShortcuts(
  handlers: ShortcutHandlers,
  enabled = true,
): void {
  // Callers rebuild the handler object every render; reading it through a ref
  // keeps one listener attached for the lifetime of the editor.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      const modifier = keyEvent.metaKey || keyEvent.ctrlKey

      if (modifier && keyEvent.key.toLowerCase() === 'z') {
        // Let the browser undo typing inside a field rather than the timeline.
        if (isTypingContext(keyEvent.target)) return
        keyEvent.preventDefault()
        if (keyEvent.shiftKey) handlersRef.current.onRedo?.()
        else handlersRef.current.onUndo?.()
        return
      }

      if (modifier && keyEvent.key.toLowerCase() === 'e') {
        if (isTypingContext(keyEvent.target)) return
        keyEvent.preventDefault()
        handlersRef.current.onExport?.()
        return
      }

      if (modifier || keyEvent.altKey) return
      if (isTypingContext(keyEvent.target)) return
      if (isDialogOpen()) return

      switch (keyEvent.key) {
        case 'n':
        case 'N':
          keyEvent.preventDefault()
          handlersRef.current.onNewEvent?.()
          break
        case 'l':
        case 'L':
          keyEvent.preventDefault()
          handlersRef.current.onNewLayer?.()
          break
        case '+':
        case '=':
          keyEvent.preventDefault()
          handlersRef.current.onZoomIn?.()
          break
        case '-':
        case '_':
          keyEvent.preventDefault()
          handlersRef.current.onZoomOut?.()
          break
        case '0':
          keyEvent.preventDefault()
          handlersRef.current.onZoomFit?.()
          break
        case 'ArrowLeft':
          keyEvent.preventDefault()
          handlersRef.current.onPanLeft?.()
          break
        case 'ArrowRight':
          keyEvent.preventDefault()
          handlersRef.current.onPanRight?.()
          break
        case '/':
          keyEvent.preventDefault()
          handlersRef.current.onSearch?.()
          break
        case '?':
          keyEvent.preventDefault()
          handlersRef.current.onHelp?.()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
