import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { IconMoon, IconSun } from '@tabler/icons-react'

import { Button } from '#/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // The server cannot know the visitor's theme, so the icon is only accurate
  // once next-themes has read the stored preference on the client.
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative"
    >
      <IconSun className="transition-all duration-200 rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
      <IconMoon className="absolute transition-all duration-200 rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
