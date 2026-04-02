import { describe, it, expect } from 'vitest'
import {
  baseEmailHtml,
  newEventEmailContent,
  eventUpdateEmailContent,
  eventReminderEmailContent,
  rsvpMilestoneEmailContent,
} from '@/lib/notifications/templates'

const orgDefaults = {
  orgName: 'Test Org',
  orgLogo: null,
  primaryColor: '#003262',
  accentColor: '#16a0ac',
}

describe('baseEmailHtml', () => {
  it('wraps content in branded dark-themed layout', () => {
    const html = baseEmailHtml({
      ...orgDefaults,
      preheader: 'Test preheader',
      content: '<p>Hello world</p>',
    })
    expect(html).toContain('Test Org')
    expect(html).toContain('Hello world')
    expect(html).toContain('#0f0f1a')
    expect(html).toContain('#16a0ac')
    expect(html).toContain('Test preheader')
  })

  it('includes org logo when provided', () => {
    const html = baseEmailHtml({
      ...orgDefaults,
      orgLogo: 'https://example.com/logo.png',
      preheader: '',
      content: '<p>Test</p>',
    })
    expect(html).toContain('https://example.com/logo.png')
  })
})

describe('newEventEmailContent', () => {
  it('returns subject and content with event details', () => {
    const result = newEventEmailContent({
      title: 'Board Game Night',
      dateTime: new Date('2026-04-15T19:00:00'),
      placeName: 'My Place',
      estimatedCost: 10,
      eventUrl: 'https://app.com/events/123',
      creatorName: 'Alice',
    })
    expect(result.subject).toContain('Board Game Night')
    expect(result.content).toContain('Board Game Night')
    expect(result.content).toContain('My Place')
    expect(result.content).toContain('$10')
    expect(result.content).toContain('https://app.com/events/123')
    expect(result.content).toContain('Alice')
  })
})

describe('eventUpdateEmailContent', () => {
  it('lists what changed', () => {
    const result = eventUpdateEmailContent({
      title: 'Park Hangout',
      changes: ['Time changed', 'Location changed'],
      eventUrl: 'https://app.com/events/456',
    })
    expect(result.subject).toContain('updated')
    expect(result.content).toContain('Time changed')
    expect(result.content).toContain('Location changed')
  })
})

describe('eventReminderEmailContent', () => {
  it('includes tomorrow reminder details', () => {
    const result = eventReminderEmailContent({
      title: 'Hiking Trip',
      dateTime: new Date('2026-04-15T09:00:00'),
      placeName: 'Trailhead',
      eventUrl: 'https://app.com/events/789',
    })
    expect(result.subject).toContain('Tomorrow')
    expect(result.content).toContain('Hiking Trip')
    expect(result.content).toContain('Trailhead')
  })
})

describe('rsvpMilestoneEmailContent', () => {
  it('shows the milestone count', () => {
    const result = rsvpMilestoneEmailContent({
      title: 'Game Night',
      count: 10,
      eventUrl: 'https://app.com/events/101',
    })
    expect(result.subject).toContain('10')
    expect(result.content).toContain('10')
    expect(result.content).toContain('Game Night')
  })
})
