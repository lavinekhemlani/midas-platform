/**
 * Tests for Supabase Loader Transaction Support
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SupabaseLoader } from './supabase-loader'
import { db } from '../../db'
import type { NormalizedEntityMap } from '../types/normalized'

// Mock the db module
vi.mock('../../db', () => ({
  db: {
    transaction: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
  eq: vi.fn(),
  and: vi.fn(),
}))

describe('SupabaseLoader Transaction Support', () => {
  let loader: SupabaseLoader

  beforeEach(() => {
    loader = new SupabaseLoader()
    vi.clearAllMocks()
  })

  describe('bulkUpsert - Transactional Mode (Default)', () => {
    it('should use transaction for bulk upsert by default', async () => {
      const mockTransaction = vi.fn(async (callback) => {
        // Simulate transaction context
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return callback(tx)
      })

      ;(db.transaction as any) = mockTransaction

      const entities: NormalizedEntityMap['Customer'][] = [
        {
          id: '1',
          sourceId: 'qb-1',
          syncToken: '1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 1',
          active: true,
          balance: 100,
          currency: 'USD',
        },
        {
          id: '2',
          sourceId: 'qb-2',
          syncToken: '2',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 2',
          active: true,
          balance: 200,
          currency: 'USD',
        },
      ]

      const result = await loader.bulkUpsert('org-123', 'Customer', entities)

      expect(mockTransaction).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        success: 2,
        failed: 0,
      })
    })

    it('should rollback all operations if one fails', async () => {
      const mockTransaction = vi.fn(async (callback) => {
        throw new Error('Transaction failed: Duplicate key violation')
      })

      ;(db.transaction as any) = mockTransaction

      const entities: NormalizedEntityMap['Customer'][] = [
        {
          id: '1',
          sourceId: 'qb-1',
          syncToken: '1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 1',
          active: true,
          balance: 100,
          currency: 'USD',
        },
        {
          id: '2',
          sourceId: 'qb-2',
          syncToken: '2',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 2',
          active: true,
          balance: 200,
          currency: 'USD',
        },
      ]

      const result = await loader.bulkUpsert('org-123', 'Customer', entities)

      expect(mockTransaction).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        success: 0,
        failed: 2,
        errors: [
          {
            entityId: 'transaction',
            error: 'Transaction failed: Duplicate key violation',
          },
        ],
      })
    })

    it('should handle empty entity array', async () => {
      const mockTransaction = vi.fn(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return callback(tx)
      })

      ;(db.transaction as any) = mockTransaction

      const result = await loader.bulkUpsert('org-123', 'Customer', [])

      expect(result).toEqual({
        success: 0,
        failed: 0,
      })
    })
  })

  describe('bulkUpsert - Partial Mode', () => {
    it('should continue on errors when allowPartial is true', async () => {
      let callCount = 0
      const mockUpsert = vi.fn(async () => {
        callCount++
        if (callCount === 2) {
          throw new Error('Failed to upsert entity 2')
        }
      })

      // Mock the upsert method
      loader.upsert = mockUpsert

      const entities: NormalizedEntityMap['Customer'][] = [
        {
          id: '1',
          sourceId: 'qb-1',
          syncToken: '1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 1',
          active: true,
          balance: 100,
          currency: 'USD',
        },
        {
          id: '2',
          sourceId: 'qb-2',
          syncToken: '2',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 2',
          active: true,
          balance: 200,
          currency: 'USD',
        },
        {
          id: '3',
          sourceId: 'qb-3',
          syncToken: '3',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 3',
          active: true,
          balance: 300,
          currency: 'USD',
        },
      ]

      const result = await loader.bulkUpsert('org-123', 'Customer', entities)

      expect(mockUpsert).toHaveBeenCalledTimes(3)
      expect(result).toEqual({
        success: 2,
        failed: 1,
        errors: [
          {
            entityId: '2',
            error: 'Failed to upsert entity 2',
          },
        ],
      })
    })

    it('should return all errors in partial mode', async () => {
      const mockUpsert = vi.fn(async (orgId, entityType, entity) => {
        if (entity.id === '1' || entity.id === '3') {
          throw new Error(`Failed to upsert entity ${entity.id}`)
        }
      })

      loader.upsert = mockUpsert

      const entities: NormalizedEntityMap['Customer'][] = [
        {
          id: '1',
          sourceId: 'qb-1',
          syncToken: '1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 1',
          active: true,
          balance: 100,
          currency: 'USD',
        },
        {
          id: '2',
          sourceId: 'qb-2',
          syncToken: '2',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 2',
          active: true,
          balance: 200,
          currency: 'USD',
        },
        {
          id: '3',
          sourceId: 'qb-3',
          syncToken: '3',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 3',
          active: true,
          balance: 300,
          currency: 'USD',
        },
      ]

      const result = await loader.bulkUpsert('org-123', 'Customer', entities)

      expect(result).toEqual({
        success: 1,
        failed: 2,
        errors: [
          {
            entityId: '1',
            error: 'Failed to upsert entity 1',
          },
          {
            entityId: '3',
            error: 'Failed to upsert entity 3',
          },
        ],
      })
    })

    it('should succeed with all entities in partial mode when no errors', async () => {
      const mockUpsert = vi.fn(async () => {
        // All succeed
      })

      loader.upsert = mockUpsert

      const entities: NormalizedEntityMap['Customer'][] = [
        {
          id: '1',
          sourceId: 'qb-1',
          syncToken: '1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 1',
          active: true,
          balance: 100,
          currency: 'USD',
        },
        {
          id: '2',
          sourceId: 'qb-2',
          syncToken: '2',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'customer',
          displayName: 'Test Customer 2',
          active: true,
          balance: 200,
          currency: 'USD',
        },
      ]

      const result = await loader.bulkUpsert('org-123', 'Customer', entities)

      expect(result).toEqual({
        success: 2,
        failed: 0,
      })
    })
  })

  describe('bulkUpsert - Generic Entities', () => {
    it('should handle generic entities in transactional mode', async () => {
      const mockTransaction = vi.fn(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return callback(tx)
      })

      ;(db.transaction as any) = mockTransaction

      const entities: NormalizedEntityMap['TaxCode'][] = [
        {
          id: '1',
          sourceId: 'qb-1',
          syncToken: '1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'tax_code',
          name: 'Tax Code 1',
          active: true,
          taxable: true,
          isTaxGroup: false,
        },
      ]

      const result = await loader.bulkUpsert('org-123', 'TaxCode', entities)

      expect(mockTransaction).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        success: 1,
        failed: 0,
      })
    })
  })

  describe('bulkUpsert - Mixed Entity Types', () => {
    it('should handle invoices in transactional mode', async () => {
      const mockTransaction = vi.fn(async (callback) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return callback(tx)
      })

      ;(db.transaction as any) = mockTransaction

      const entities: NormalizedEntityMap['Invoice'][] = [
        {
          id: '1',
          sourceId: 'qb-1',
          syncToken: '1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          source: 'quickbooks',
          type: 'invoice',
          invoiceNumber: 'INV-001',
          customerId: null,
          customerName: 'Test Customer',
          date: '2025-01-01',
          total: 1000,
          balance: 500,
          status: 'partial',
          currency: 'USD',
          subtotal: 1000,
          tax: 0,
          lineItems: [],
        },
      ]

      const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

      expect(mockTransaction).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        success: 1,
        failed: 0,
      })
    })
  })
})
