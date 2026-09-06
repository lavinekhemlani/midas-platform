// src/lib/providers/active-provider.ts
import { getUserOrganizationId, getConnectedProviders } from './database';
import { ProviderID } from './index';

/**
 * Determines the active provider for an organization
 * Returns the first connected provider found in the organization's providers map
 */
export async function getActiveProvider(organizationId: string): Promise<ProviderID | null> {
  try {
    const connectedProviders = await getConnectedProviders(organizationId);
    
    // Return the first connected provider
    const providerIds = Object.keys(connectedProviders) as ProviderID[];
    return providerIds.length > 0 ? providerIds[0] : null;
  } catch (error) {
    console.error('Error getting active provider:', error);
    return null;
  }
}

/**
 * Gets the active provider for a user by looking up their organization
 */
export async function getActiveProviderForUser(userId: string): Promise<ProviderID | null> {
  try {
    const organizationId = await getUserOrganizationId(userId);
    if (!organizationId) {
      return null;
    }

    return await getActiveProvider(organizationId);
  } catch (error) {
    console.error('Error getting active provider for user:', error);
    return null;
  }
}
