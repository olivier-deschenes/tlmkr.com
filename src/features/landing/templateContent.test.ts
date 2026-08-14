import { describe, expect, test } from 'bun:test'

import { templateCopy } from './templateContent'
import { timelineTemplates } from '#/features/timeline/templates'

describe('template landing copy', () => {
  test.each(timelineTemplates.map((template) => [template.id]))(
    'the %s template has landing copy',
    (id) => {
      expect(templateCopy[id]).toBeDefined()
    },
  )

  test('has no copy for a template that no longer exists', () => {
    const templateIds = new Set(
      timelineTemplates.map((template) => template.id),
    )

    expect(
      Object.keys(templateCopy).filter((id) => !templateIds.has(id)),
    ).toEqual([])
  })

  test.each(Object.entries(templateCopy))(
    'the %s meta description fits in a search result',
    (_id, copy) => {
      // Google truncates somewhere near 160 characters, so anything longer is
      // written for a reader who will never see the end of it.
      expect(copy.metaDescription.length).toBeLessThanOrEqual(160)
    },
  )
})
