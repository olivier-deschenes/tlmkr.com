import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { IconDeviceLaptop, IconMoon, IconSun } from '@tabler/icons-react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

const themes = [
  { value: 'light', label: 'Light', icon: IconSun },
  { value: 'dark', label: 'Dark', icon: IconMoon },
  { value: 'system', label: 'System', icon: IconDeviceLaptop },
] as const

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // The server cannot know the visitor's theme, so the icon is only accurate
  // once next-themes has read the stored preference on the client.
  useEffect(() => setMounted(true), [])

  const Icon = mounted && resolvedTheme === 'dark' ? IconMoon : IconSun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Change color theme"
        >
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {themes.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => setTheme(option.value)}
            data-active={mounted && theme === option.value}
            className="data-[active=true]:font-medium"
          >
            <option.icon />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
