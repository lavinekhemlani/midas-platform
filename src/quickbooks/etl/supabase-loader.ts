/**
 * Supabase Loader for QuickBooks ETL
 * Implements the Loader interface using Drizzle ORM
 */

import { db, eq, and } from '../../db'
import {
  qbCustomers,
  qbVendors,
  qbAccounts,
  qbItems,
  qbInvoices,
  qbBills,
  qbPayments,
  qbEntities,
} from '../../db/schema'
import type { Loader, BulkResult } from './loader'
import type { QBEntityType } from '../types/entities'
import type { NormalizedEntityMap } from '../types/normalized'

// Entity types that have dedicated tables
const TYPED_ENTITIES = [
  'Customer',
  'Vendor',
  'Account',
  'Item',
  'Invoice',
  'Bill',
  'Payment',
] as const
type TypedEntity = (typeof TYPED_ENTITIES)[number]

function isTypedEntity(type: QBEntityType): type is TypedEntity {
  return TYPED_ENTITIES.includes(type as TypedEntity)
}

/**
 * Supabase Loader using Drizzle ORM
 */
export class SupabaseLoader implements Loader {
  async upsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entity: NormalizedEntityMap[T]
  ): Promise<void> {
    if (isTypedEntity(entityType)) {
      // TypeScript can't narrow generics through type guards, so we use explicit assertions
      await this.upsertTyped(organizationId, entityType, entity as any)
    } else {
      await this.upsertGeneric(organizationId, entityType, entity)
    }
  }

  async delete(organizationId: string, entityType: QBEntityType, entityId: string): Promise<void> {
    if (isTypedEntity(entityType)) {
      await this.deleteTyped(organizationId, entityType, entityId)
    } else {
      await db
        .delete(qbEntities)
        .where(
          and(
            eq(qbEntities.organizationId, organizationId),
            eq(qbEntities.entityType, entityType),
            eq(qbEntities.qbId, entityId)
          )
        )
    }
  }

  async bulkUpsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entities: NormalizedEntityMap[T][]
  ): Promise<BulkResult> {
    let success = 0
    let failed = 0
    const errors: Array<{ entityId: string; error: string }> = []

    for (const entity of entities) {
      try {
        await this.upsert(organizationId, entityType, entity)
        success++
      } catch (err) {
        failed++
        errors.push({
          entityId: entity.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return { success, failed, errors: errors.length > 0 ? errors : undefined }
  }

  // Typed entity handlers
  private async upsertTyped<T extends TypedEntity>(
    organizationId: string,
    entityType: T,
    entity: NormalizedEntityMap[T]
  ): Promise<void> {
    switch (entityType) {
      case 'Customer':
        await this.upsertCustomer(organizationId, entity as NormalizedEntityMap['Customer'])
        break
      case 'Vendor':
        await this.upsertVendor(organizationId, entity as NormalizedEntityMap['Vendor'])
        break
      case 'Account':
        await this.upsertAccount(organizationId, entity as NormalizedEntityMap['Account'])
        break
      case 'Item':
        await this.upsertItem(organizationId, entity as NormalizedEntityMap['Item'])
        break
      case 'Invoice':
        await this.upsertInvoice(organizationId, entity as NormalizedEntityMap['Invoice'])
        break
      case 'Bill':
        await this.upsertBill(organizationId, entity as NormalizedEntityMap['Bill'])
        break
      case 'Payment':
        await this.upsertPayment(organizationId, entity as NormalizedEntityMap['Payment'])
        break
    }
  }

  private async deleteTyped(
    organizationId: string,
    entityType: TypedEntity,
    entityId: string
  ): Promise<void> {
    const tableMap = {
      Customer: qbCustomers,
      Vendor: qbVendors,
      Account: qbAccounts,
      Item: qbItems,
      Invoice: qbInvoices,
      Bill: qbBills,
      Payment: qbPayments,
    } as const

    const table = tableMap[entityType]
    await db
      .delete(table)
      .where(and(eq(table.organizationId, organizationId), eq(table.qbId, entityId)))
  }

  // Individual typed upserts
  private async upsertCustomer(orgId: string, e: NormalizedEntityMap['Customer']) {
    await db
      .insert(qbCustomers)
      .values({
        organizationId: orgId,
        qbId: e.id,
        syncToken: e.syncToken,
        displayName: e.displayName,
        companyName: e.companyName ?? null,
        email: e.email ?? null,
        phone: e.phone ?? null,
        balance: e.balance?.toString() ?? '0',
        isActive: e.active,
        rawData: e,
      })
      .onConflictDoUpdate({
        target: [qbCustomers.organizationId, qbCustomers.qbId],
        set: {
          syncToken: e.syncToken,
          displayName: e.displayName,
          companyName: e.companyName ?? null,
          email: e.email ?? null,
          phone: e.phone ?? null,
          balance: e.balance?.toString() ?? '0',
          isActive: e.active,
          rawData: e,
          updatedAt: new Date(),
        },
      })
  }

  private async upsertVendor(orgId: string, e: NormalizedEntityMap['Vendor']) {
    await db
      .insert(qbVendors)
      .values({
        organizationId: orgId,
        qbId: e.id,
        syncToken: e.syncToken,
        displayName: e.displayName,
        companyName: e.companyName ?? null,
        email: e.email ?? null,
        phone: e.phone ?? null,
        balance: e.balance?.toString() ?? '0',
        isActive: e.active,
        rawData: e,
      })
      .onConflictDoUpdate({
        target: [qbVendors.organizationId, qbVendors.qbId],
        set: {
          syncToken: e.syncToken,
          displayName: e.displayName,
          companyName: e.companyName ?? null,
          email: e.email ?? null,
          phone: e.phone ?? null,
          balance: e.balance?.toString() ?? '0',
          isActive: e.active,
          rawData: e,
          updatedAt: new Date(),
        },
      })
  }

  private async upsertAccount(orgId: string, e: NormalizedEntityMap['Account']) {
    await db
      .insert(qbAccounts)
      .values({
        organizationId: orgId,
        qbId: e.id,
        syncToken: e.syncToken,
        name: e.name,
        accountType: e.accountType,
        accountSubType: e.accountSubType ?? null,
        currentBalance: e.balance?.toString() ?? '0',
        isActive: e.active,
        rawData: e,
      })
      .onConflictDoUpdate({
        target: [qbAccounts.organizationId, qbAccounts.qbId],
        set: {
          syncToken: e.syncToken,
          name: e.name,
          accountType: e.accountType,
          accountSubType: e.accountSubType ?? null,
          currentBalance: e.balance?.toString() ?? '0',
          isActive: e.active,
          rawData: e,
          updatedAt: new Date(),
        },
      })
  }

  private async upsertItem(orgId: string, e: NormalizedEntityMap['Item']) {
    await db
      .insert(qbItems)
      .values({
        organizationId: orgId,
        qbId: e.id,
        syncToken: e.syncToken,
        name: e.name,
        sku: e.sku ?? null,
        itemType: e.itemType,
        unitPrice: e.unitPrice?.toString() ?? '0',
        purchaseCost: e.purchaseCost?.toString() ?? '0',
        quantityOnHand: e.quantityOnHand?.toString() ?? '0',
        isActive: e.active,
        rawData: e,
      })
      .onConflictDoUpdate({
        target: [qbItems.organizationId, qbItems.qbId],
        set: {
          syncToken: e.syncToken,
          name: e.name,
          sku: e.sku ?? null,
          itemType: e.itemType,
          unitPrice: e.unitPrice?.toString() ?? '0',
          purchaseCost: e.purchaseCost?.toString() ?? '0',
          quantityOnHand: e.quantityOnHand?.toString() ?? '0',
          isActive: e.active,
          rawData: e,
          updatedAt: new Date(),
        },
      })
  }

  private async upsertInvoice(orgId: string, e: NormalizedEntityMap['Invoice']) {
    await db
      .insert(qbInvoices)
      .values({
        organizationId: orgId,
        qbId: e.id,
        syncToken: e.syncToken,
        docNumber: e.invoiceNumber ?? null,
        txnDate: e.date,
        dueDate: e.dueDate ?? null,
        customerName: e.customerName ?? null,
        totalAmount: e.total.toString(),
        balance: e.balance.toString(),
        status: e.status as
          | 'draft'
          | 'pending'
          | 'sent'
          | 'partial'
          | 'paid'
          | 'overdue'
          | 'voided',
        rawData: e,
      })
      .onConflictDoUpdate({
        target: [qbInvoices.organizationId, qbInvoices.qbId],
        set: {
          syncToken: e.syncToken,
          docNumber: e.invoiceNumber ?? null,
          txnDate: e.date,
          dueDate: e.dueDate ?? null,
          customerName: e.customerName ?? null,
          totalAmount: e.total.toString(),
          balance: e.balance.toString(),
          status: e.status as
            | 'draft'
            | 'pending'
            | 'sent'
            | 'partial'
            | 'paid'
            | 'overdue'
            | 'voided',
          rawData: e,
          updatedAt: new Date(),
        },
      })
  }

  private async upsertBill(orgId: string, e: NormalizedEntityMap['Bill']) {
    await db
      .insert(qbBills)
      .values({
        organizationId: orgId,
        qbId: e.id,
        syncToken: e.syncToken,
        docNumber: e.billNumber ?? null,
        txnDate: e.date,
        dueDate: e.dueDate ?? null,
        vendorName: e.vendorName ?? null,
        totalAmount: e.total.toString(),
        balance: e.balance.toString(),
        status: e.status as 'unpaid' | 'partial' | 'paid' | 'overdue',
        rawData: e,
      })
      .onConflictDoUpdate({
        target: [qbBills.organizationId, qbBills.qbId],
        set: {
          syncToken: e.syncToken,
          docNumber: e.billNumber ?? null,
          txnDate: e.date,
          dueDate: e.dueDate ?? null,
          vendorName: e.vendorName ?? null,
          totalAmount: e.total.toString(),
          balance: e.balance.toString(),
          status: e.status as 'unpaid' | 'partial' | 'paid' | 'overdue',
          rawData: e,
          updatedAt: new Date(),
        },
      })
  }

  private async upsertPayment(orgId: string, e: NormalizedEntityMap['Payment']) {
    await db
      .insert(qbPayments)
      .values({
        organizationId: orgId,
        qbId: e.id,
        syncToken: e.syncToken,
        txnDate: e.date,
        customerName: e.customerName ?? null,
        totalAmount: e.amount.toString(),
        rawData: e,
      })
      .onConflictDoUpdate({
        target: [qbPayments.organizationId, qbPayments.qbId],
        set: {
          syncToken: e.syncToken,
          txnDate: e.date,
          customerName: e.customerName ?? null,
          totalAmount: e.amount.toString(),
          rawData: e,
          updatedAt: new Date(),
        },
      })
  }

  // Generic entity upsert for non-typed entities
  private async upsertGeneric<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entity: NormalizedEntityMap[T]
  ): Promise<void> {
    await db
      .insert(qbEntities)
      .values({
        organizationId,
        entityType,
        qbId: entity.id,
        syncToken: entity.syncToken,
        data: entity,
      })
      .onConflictDoUpdate({
        target: [qbEntities.organizationId, qbEntities.entityType, qbEntities.qbId],
        set: {
          syncToken: entity.syncToken,
          data: entity,
          updatedAt: new Date(),
        },
      })
  }
}
