import { relations } from 'drizzle-orm/relations'
import {
  organizations,
  organizationMembers,
  roles,
  users,
  auditLogs,
  qbAccounts,
  providerConnections,
  qbBills,
  qbVendors,
  qbEntities,
  qbCustomers,
  qbInvoices,
  qbItems,
  qbPayments,
  syncJobs,
  syncCursors,
} from './schema'

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  role: one(roles, {
    fields: [organizationMembers.roleId],
    references: [roles.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}))

export const organizationsRelations = relations(organizations, ({ many }) => ({
  organizationMembers: many(organizationMembers),
  auditLogs: many(auditLogs),
  qbAccounts: many(qbAccounts),
  providerConnections: many(providerConnections),
  qbBills: many(qbBills),
  qbEntities: many(qbEntities),
  qbInvoices: many(qbInvoices),
  qbItems: many(qbItems),
  qbPayments: many(qbPayments),
  qbCustomers: many(qbCustomers),
  qbVendors: many(qbVendors),
  syncJobs: many(syncJobs),
  syncCursors: many(syncCursors),
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  organizationMembers: many(organizationMembers),
}))

export const usersRelations = relations(users, ({ many }) => ({
  organizationMembers: many(organizationMembers),
  auditLogs: many(auditLogs),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}))

export const qbAccountsRelations = relations(qbAccounts, ({ one }) => ({
  organization: one(organizations, {
    fields: [qbAccounts.organizationId],
    references: [organizations.id],
  }),
}))

export const providerConnectionsRelations = relations(providerConnections, ({ one }) => ({
  organization: one(organizations, {
    fields: [providerConnections.organizationId],
    references: [organizations.id],
  }),
}))

export const qbBillsRelations = relations(qbBills, ({ one }) => ({
  organization: one(organizations, {
    fields: [qbBills.organizationId],
    references: [organizations.id],
  }),
  qbVendor: one(qbVendors, {
    fields: [qbBills.vendorId],
    references: [qbVendors.id],
  }),
}))

export const qbVendorsRelations = relations(qbVendors, ({ one, many }) => ({
  qbBills: many(qbBills),
  organization: one(organizations, {
    fields: [qbVendors.organizationId],
    references: [organizations.id],
  }),
}))

export const qbEntitiesRelations = relations(qbEntities, ({ one }) => ({
  organization: one(organizations, {
    fields: [qbEntities.organizationId],
    references: [organizations.id],
  }),
}))

export const qbInvoicesRelations = relations(qbInvoices, ({ one }) => ({
  qbCustomer: one(qbCustomers, {
    fields: [qbInvoices.customerId],
    references: [qbCustomers.id],
  }),
  organization: one(organizations, {
    fields: [qbInvoices.organizationId],
    references: [organizations.id],
  }),
}))

export const qbCustomersRelations = relations(qbCustomers, ({ one, many }) => ({
  qbInvoices: many(qbInvoices),
  qbPayments: many(qbPayments),
  organization: one(organizations, {
    fields: [qbCustomers.organizationId],
    references: [organizations.id],
  }),
}))

export const qbItemsRelations = relations(qbItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [qbItems.organizationId],
    references: [organizations.id],
  }),
}))

export const qbPaymentsRelations = relations(qbPayments, ({ one }) => ({
  qbCustomer: one(qbCustomers, {
    fields: [qbPayments.customerId],
    references: [qbCustomers.id],
  }),
  organization: one(organizations, {
    fields: [qbPayments.organizationId],
    references: [organizations.id],
  }),
}))

export const syncJobsRelations = relations(syncJobs, ({ one }) => ({
  organization: one(organizations, {
    fields: [syncJobs.organizationId],
    references: [organizations.id],
  }),
}))

export const syncCursorsRelations = relations(syncCursors, ({ one }) => ({
  organization: one(organizations, {
    fields: [syncCursors.organizationId],
    references: [organizations.id],
  }),
}))
