// src/lib/db/queries.ts
// Database query functions for user and organization profiles

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { createOrgPK, createUserPK } from './keys'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)

const USERS_TABLE = process.env.USERS_TABLE_NAME || 'zenith-users'

export interface UserProfile {
  userId: string
  email: string
  name?: string
  organizationId?: string
  organizationName?: string
  role?: string
  createdAt?: string
  updatedAt?: string
}

export interface OrganizationProfile {
  organizationId: string
  name: string
  currency?: string
  createdAt?: string
  updatedAt?: string
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const pk = createUserPK(userId)
  console.log(`[getUserProfile] Fetching user from "${USERS_TABLE}" with PK: "${pk}", SK: "PROFILE"`)

  try {
    const response = await ddbDocClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: {
          PK: pk,
          SK: 'PROFILE',
        },
      })
    )

    if (!response.Item) {
      console.warn(`[getUserProfile] No user record found for PK: "${pk}"`)
      return null
    }

    const item = response.Item
    const profile = {
      userId: item.user_id || item.userId,
      email: item.email,
      name: item.name || [item.first_name, item.last_name].filter(Boolean).join(' ') || undefined,
      organizationId: item.organization_id || item.organizationId,
      organizationName: item.organization_name || item.organizationName,
      role: item.role_title || item.role,
      createdAt: item.created_at || item.createdAt,
      updatedAt: item.updated_at || item.updatedAt,
    }
    console.log(`[getUserProfile] Found user: email="${profile.email}", name="${profile.name}", orgId="${profile.organizationId}", role="${profile.role}"`)
    return profile
  } catch (error) {
    console.error('[getUserProfile] Error fetching user profile:', error)
    return null
  }
}

export async function getOrganizationProfile(
  organizationId: string
): Promise<OrganizationProfile | null> {
  const ORGANIZATIONS_TABLE = process.env.ORGANIZATIONS_TABLE_NAME || 'zenith-organizations'
  try {
    const response = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE,
        Key: {
          PK: createOrgPK(organizationId),
          SK: 'PROFILE',
        },
      })
    )

    if (!response.Item) {
      return null
    }

    const item = response.Item
    return {
      organizationId: item.organization_id || item.organizationId || organizationId,
      name: item.name,
      currency: item.default_currency || item.currency,
      createdAt: item.created_at || item.createdAt,
      updatedAt: item.updated_at || item.updatedAt,
    }
  } catch (error) {
    console.error('Error fetching organization profile:', error)
    return null
  }
}
