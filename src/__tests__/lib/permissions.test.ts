import { describe, it, expect } from 'vitest'
import { checkGroupAdmin, checkCanEditGroup } from '@/lib/permissions'

describe('checkGroupAdmin', () => {
  it('returns true when user is ADMIN of the group', () => {
    expect(checkGroupAdmin({ memberRole: 'ADMIN', orgAdminRole: null })).toBe(true)
  })

  it('returns true when user is org admin (ADMIN of default group)', () => {
    expect(checkGroupAdmin({ memberRole: 'MEMBER', orgAdminRole: 'ADMIN' })).toBe(true)
  })

  it('returns true when user is org admin even if not a member of the group', () => {
    expect(checkGroupAdmin({ memberRole: null, orgAdminRole: 'ADMIN' })).toBe(true)
  })

  it('returns false when user is regular member', () => {
    expect(checkGroupAdmin({ memberRole: 'MEMBER', orgAdminRole: 'MEMBER' })).toBe(false)
  })

  it('returns false when user has no membership', () => {
    expect(checkGroupAdmin({ memberRole: null, orgAdminRole: null })).toBe(false)
  })
})

describe('checkCanEditGroup', () => {
  it('returns false for the default group (cannot be edited)', () => {
    expect(checkCanEditGroup({ isDefault: true, isAdmin: true })).toBe(false)
  })

  it('returns true for non-default group when user is admin', () => {
    expect(checkCanEditGroup({ isDefault: false, isAdmin: true })).toBe(true)
  })

  it('returns false for non-default group when user is not admin', () => {
    expect(checkCanEditGroup({ isDefault: false, isAdmin: false })).toBe(false)
  })
})
