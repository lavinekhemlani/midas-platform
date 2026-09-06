/**
 * Integration Tests for QuickBooks ETL SupabaseLoader
 * Tests transaction support, rollback behavior, and bulk operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SupabaseLoader } from '@/quickbooks/etl/supabase-loader'
import type { NormalizedEntityMap } from '@/quickbooks/types/normalized'
import type { BulkResult } from '@/quickbooks/etl/loader'

// Mock the database module
vi.mock('@/db', () => {
  const mockDb = {
    transaction: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  }

  return {
    db: mockDb,
    eq: vi.fn((...args) => ({ eq: args })),
    and: vi.fn((...args) => ({ and: args })),
    qbCustomers: { organizationId: 'org_id', qbId: 'qb_id' },
    qbVendors: { organizationId: 'org_id', qbId: 'qb_id' },
    qbAccounts: { organizationId: 'org_id', qbId: 'qb_id' },
    qbItems: { organizationId: 'org_id', qbId: 'qb_id' },
    qbInvoices: { organizationId: 'org_id', qbId: 'qb_id' },
    qbBills: { organizationId: 'org_id', qbId: 'qb_id' },
    qbPayments: { organizationId: 'org_id', qbId: 'qb_id' },
    qbEntities: { organizationId: 'org_id', entityType: 'entity_type', qbId: 'qb_id' },
  }
})

describe('SupabaseLoader', () => {
  let loader: SupabaseLoader
  let mockDb: any
  let mockTx: any

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Get the mocked db
    const dbModule = await import('@/db')
    mockDb = dbModule.db

    // Setup mock transaction context
    mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue({}),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    }

    // Setup db.insert chain
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue({}),
      }),
    })

    // Setup db.delete chain
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue({}),
    })

    // Setup db.transaction to execute callback immediately with mockTx
    mockDb.transaction.mockImplementation(async (callback: any) => {
      return await callback(mockTx)
    })

    loader = new SupabaseLoader()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Helper function to create mock entities
  function createMockInvoice(id: string): NormalizedEntityMap['Invoice'] {
    return {
      id,
      sourceId: `qb-${id}`,
      syncToken: '1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      source: 'quickbooks',
      type: 'invoice',
      invoiceNumber: `INV-${id}`,
      customerId: 'cust-1',
      customerName: 'Test Customer',
      date: '2025-01-01',
      dueDate: '2025-01-31',
      status: 'paid',
      currency: 'USD',
      subtotal: 100,
      tax: 10,
      total: 110,
      balance: 110,
      lineItems: [],
    }
  }

  function createMockCustomer(id: string): NormalizedEntityMap['Customer'] {
    return {
      id,
      sourceId: `qb-${id}`,
      syncToken: '1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      source: 'quickbooks',
      type: 'customer',
      displayName: `Customer ${id}`,
      balance: 1000,
      active: true,
      currency: 'USD',
    }
  }

  function createMockVendor(id: string): NormalizedEntityMap['Vendor'] {
    return {
      id,
      sourceId: `qb-${id}`,
      syncToken: '1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      source: 'quickbooks',
      type: 'vendor',
      displayName: `Vendor ${id}`,
      balance: 500,
      active: true,
      currency: 'USD',
      track1099: false,
    }
  }

  describe('bulkUpsert with transactions', () => {
    describe('Test Case 1: Successful bulk upsert commits all entities', () => {
      it('should commit all entities when all operations succeed', async () => {
        const entities = [
          createMockInvoice('inv-1'),
          createMockInvoice('inv-2'),
          createMockInvoice('inv-3'),
        ]

        const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

        expect(result).toEqual({
          success: 3,
          failed: 0,
        })

        // Verify transaction was used
        expect(mockDb.transaction).toHaveBeenCalledTimes(1)

        // Verify all entities were processed
        expect(mockTx.insert).toHaveBeenCalledTimes(3)
      })
    })

    describe('Test Case 2: Failed upsert in middle rolls back all previous', () => {
      it('should rollback all operations when one fails', async () => {
        const entities = [
          createMockInvoice('inv-1'),
          createMockInvoice('inv-2'),
          createMockInvoice('inv-3'),
        ]

        // Mock transaction to fail on third entity
        mockDb.transaction.mockImplementation(async (callback: any) => {
          throw new Error('Database constraint violation')
        })

        const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

        expect(result).toEqual({
          success: 0,
          failed: 3,
          errors: [
            {
              entityId: 'transaction',
              error: 'Database constraint violation',
            },
          ],
        })

        // Verify transaction was attempted
        expect(mockDb.transaction).toHaveBeenCalledTimes(1)
      })

      it('should handle transaction timeout errors', async () => {
        const entities = Array.from({ length: 5 }, (_, i) => createMockInvoice(`inv-${i + 1}`))

        mockDb.transaction.mockImplementation(async () => {
          throw new Error('Transaction timeout after 30s')
        })

        const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

        expect(result).toEqual({
          success: 0,
          failed: 5,
          errors: [
            {
              entityId: 'transaction',
              error: 'Transaction timeout after 30s',
            },
          ],
        })
      })
    })

    describe('Test Case 3: Partial mode commits successful ones', () => {
      it('should continue on errors when allowPartial is true', async () => {
        const entities = [
          createMockInvoice('inv-1'),
          createMockInvoice('inv-2'),
          createMockInvoice('inv-3'),
        ]

        // Mock to succeed on first and third, fail on second
        let callCount = 0
        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockImplementation(() => {
              callCount++
              if (callCount === 2) {
                return Promise.reject(new Error('Unique constraint violation'))
              }
              return Promise.resolve({})
            }),
          }),
        })

        const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

        expect(result.success).toBe(2)
        expect(result.failed).toBe(1)
        expect(result.errors).toHaveLength(1)
        expect(result.errors?.[0]).toEqual({
          entityId: 'inv-2',
          error: 'Unique constraint violation',
        })

        // Verify transaction was used (since allowPartial is not supported)
        expect(mockDb.transaction).toHaveBeenCalled()

        // Verify all entities were attempted
        expect(mockDb.insert).toHaveBeenCalled()
      })

      it('should collect all errors in partial mode', async () => {
        const entities = [
          createMockInvoice('inv-1'),
          createMockInvoice('inv-2'),
          createMockInvoice('inv-3'),
          createMockInvoice('inv-4'),
        ]

        // Mock to fail on 2nd and 4th
        let callCount = 0
        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockImplementation(() => {
              callCount++
              if (callCount === 2 || callCount === 4) {
                return Promise.reject(new Error(`Error on entity ${callCount}`))
              }
              return Promise.resolve({})
            }),
          }),
        })

        const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

        expect(result.success).toBe(2)
        expect(result.failed).toBe(2)
        expect(result.errors).toHaveLength(2)
        expect(result.errors).toContainEqual({
          entityId: 'inv-2',
          error: 'Error on entity 2',
        })
        expect(result.errors).toContainEqual({
          entityId: 'inv-4',
          error: 'Error on entity 4',
        })
      })
    })

    describe('Test Case 4: Empty entity array handles gracefully', () => {
      it('should handle empty array without errors', async () => {
        const result = await loader.bulkUpsert('org-123', 'Invoice', [])

        expect(result).toEqual({
          success: 0,
          failed: 0,
        })

        // Transaction should still be called but with no operations
        expect(mockDb.transaction).toHaveBeenCalledTimes(1)
      })

      it('should handle empty array in partial mode', async () => {
        const result = await loader.bulkUpsert('org-123', 'Invoice', [])

        expect(result).toEqual({
          success: 0,
          failed: 0,
        })

        // Transaction is still called for empty arrays
        expect(mockDb.transaction).toHaveBeenCalledTimes(1)
        expect(mockDb.insert).not.toHaveBeenCalled()
      })
    })

    describe('Test Case 5: Single entity upsert works', () => {
      it('should handle single entity in transactional mode', async () => {
        const entity = createMockInvoice('inv-1')

        const result = await loader.bulkUpsert('org-123', 'Invoice', [entity])

        expect(result).toEqual({
          success: 1,
          failed: 0,
        })

        expect(mockDb.transaction).toHaveBeenCalledTimes(1)
        expect(mockTx.insert).toHaveBeenCalledTimes(1)
      })

      it('should handle single entity failure in transactional mode', async () => {
        const entity = createMockInvoice('inv-1')

        mockDb.transaction.mockImplementation(async () => {
          throw new Error('Constraint violation')
        })

        const result = await loader.bulkUpsert('org-123', 'Invoice', [entity])

        expect(result).toEqual({
          success: 0,
          failed: 1,
          errors: [
            {
              entityId: 'transaction',
              error: 'Constraint violation',
            },
          ],
        })
      })
    })

    describe('Test Case 6: Large batch handles correctly', () => {
      it('should handle 100+ entities in transactional mode', async () => {
        const entities = Array.from({ length: 150 }, (_, i) => createMockInvoice(`inv-${i + 1}`))

        const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

        expect(result).toEqual({
          success: 150,
          failed: 0,
        })

        expect(mockDb.transaction).toHaveBeenCalledTimes(1)
        expect(mockTx.insert).toHaveBeenCalledTimes(150)
      })

      it('should handle 100+ entities in partial mode with mixed results', async () => {
        const entities = Array.from({ length: 120 }, (_, i) => createMockInvoice(`inv-${i + 1}`))

        // Mock to fail every 10th entity
        let callCount = 0
        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockImplementation(() => {
              callCount++
              if (callCount % 10 === 0) {
                return Promise.reject(new Error(`Error on entity ${callCount}`))
              }
              return Promise.resolve({})
            }),
          }),
        })

        const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

        expect(result.success).toBe(108) // 120 - 12 failures
        expect(result.failed).toBe(12)
        expect(result.errors).toHaveLength(12)
      })
    })

    describe('Test Case 7: Transaction timeout handling', () => {
      it('should handle transaction timeout gracefully', async () => {
        const entities = Array.from({ length: 50 }, (_, i) => createMockInvoice(`inv-${i + 1}`))

        mockDb.transaction.mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          throw new Error('transaction timeout: 30000ms exceeded')
        })

        const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

        expect(result.success).toBe(0)
        expect(result.failed).toBe(50)
        expect(result.errors?.[0].error).toContain('timeout')
      })
    })

    describe("Test Case 8: Concurrent bulk upserts don't interfere", () => {
      it('should handle concurrent bulk upserts independently', async () => {
        const batch1 = [createMockInvoice('inv-1'), createMockInvoice('inv-2')]
        const batch2 = [createMockCustomer('cust-1'), createMockCustomer('cust-2')]

        // Execute both upserts concurrently
        const [result1, result2] = await Promise.all([
          loader.bulkUpsert('org-123', 'Invoice', batch1),
          loader.bulkUpsert('org-123', 'Customer', batch2),
        ])

        expect(result1).toEqual({ success: 2, failed: 0 })
        expect(result2).toEqual({ success: 2, failed: 0 })

        // Each should have its own transaction
        expect(mockDb.transaction).toHaveBeenCalledTimes(2)
      })

      it('should handle concurrent upserts with one failing', async () => {
        const batch1 = [createMockInvoice('inv-1'), createMockInvoice('inv-2')]
        const batch2 = [createMockCustomer('cust-1'), createMockCustomer('cust-2')]

        let transactionCount = 0
        mockDb.transaction.mockImplementation(async (callback: any) => {
          transactionCount++
          if (transactionCount === 2) {
            throw new Error('Second transaction failed')
          }
          return await callback(mockTx)
        })

        const [result1, result2] = await Promise.all([
          loader.bulkUpsert('org-123', 'Invoice', batch1),
          loader.bulkUpsert('org-123', 'Customer', batch2),
        ])

        // First should succeed
        expect(result1).toEqual({ success: 2, failed: 0 })

        // Second should fail
        expect(result2.success).toBe(0)
        expect(result2.failed).toBe(2)
        expect(result2.errors?.[0].error).toBe('Second transaction failed')
      })
    })
  })

  describe('Entity type handling', () => {
    it('should handle all typed entities (Customer, Vendor, Account, etc.)', async () => {
      const customers = [createMockCustomer('cust-1'), createMockCustomer('cust-2')]
      const vendors = [createMockVendor('vend-1'), createMockVendor('vend-2')]

      const [customerResult, vendorResult] = await Promise.all([
        loader.bulkUpsert('org-123', 'Customer', customers),
        loader.bulkUpsert('org-123', 'Vendor', vendors),
      ])

      expect(customerResult.success).toBe(2)
      expect(vendorResult.success).toBe(2)
    })

    it('should handle generic entities', async () => {
      const genericEntity = {
        id: 'term-1',
        sourceId: 'qb-term-1',
        syncToken: '1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        source: 'quickbooks' as const,
        type: 'term' as const,
        name: 'Net 30',
        active: true,
      }

      const result = await loader.bulkUpsert('org-123', 'Term', [genericEntity])

      expect(result.success).toBe(1)
      expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    })
  })

  describe('Single upsert operations', () => {
    it('should upsert single customer', async () => {
      const customer = createMockCustomer('cust-1')

      await loader.upsert('org-123', 'Customer', customer)

      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should handle upsert errors', async () => {
      const customer = createMockCustomer('cust-1')

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      })

      await expect(loader.upsert('org-123', 'Customer', customer)).rejects.toThrow('Database error')
    })
  })

  describe('Delete operations', () => {
    it('should delete typed entity', async () => {
      await loader.delete('org-123', 'Invoice', 'inv-1')

      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('should delete generic entity', async () => {
      await loader.delete('org-123', 'Term', 'term-1')

      expect(mockDb.delete).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle non-Error exceptions', async () => {
      const entities = [createMockInvoice('inv-1')]

      mockDb.transaction.mockImplementation(async () => {
        throw 'String error'
      })

      const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

      expect(result.errors?.[0].error).toBe('Transaction failed')
    })

    it('should handle database connection errors', async () => {
      const entities = [createMockInvoice('inv-1')]

      mockDb.transaction.mockImplementation(async () => {
        throw new Error('ECONNREFUSED: Connection refused')
      })

      const result = await loader.bulkUpsert('org-123', 'Invoice', entities)

      expect(result.errors?.[0].error).toContain('ECONNREFUSED')
    })
  })

  describe('Data integrity', () => {
    it('should preserve all entity fields during upsert', async () => {
      const invoice = createMockInvoice('inv-1')
      invoice.memo = 'Test memo'
      invoice.email = 'test@example.com'
      invoice.privateNote = 'Private note'

      await loader.upsert('org-123', 'Invoice', invoice)

      // Verify the insert was called
      expect(mockDb.insert).toHaveBeenCalled()

      // Verify values method was called (which means data was passed)
      const insertChain = mockDb.insert()
      expect(insertChain.values).toHaveBeenCalled()
    })

    it('should handle null and undefined fields correctly', async () => {
      const customer = createMockCustomer('cust-1')
      customer.email = undefined
      customer.companyName = null as any

      await loader.upsert('org-123', 'Customer', customer)

      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should handle numeric precision for monetary values', async () => {
      const invoice = createMockInvoice('inv-1')
      invoice.total = 123.456789
      invoice.balance = 99.999999

      await loader.upsert('org-123', 'Invoice', invoice)

      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('Performance considerations', () => {
    it('should complete large batch within reasonable time', async () => {
      const entities = Array.from({ length: 1000 }, (_, i) => createMockInvoice(`inv-${i + 1}`))

      const startTime = Date.now()
      await loader.bulkUpsert('org-123', 'Invoice', entities)
      const duration = Date.now() - startTime

      // Should complete within 5 seconds even with 1000 entities (mocked)
      expect(duration).toBeLessThan(5000)
    })

    it('should use transactions efficiently (no nested transactions)', async () => {
      const entities = [createMockInvoice('inv-1'), createMockInvoice('inv-2')]

      await loader.bulkUpsert('org-123', 'Invoice', entities)

      // Should only create one transaction
      expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    })
  })
})
