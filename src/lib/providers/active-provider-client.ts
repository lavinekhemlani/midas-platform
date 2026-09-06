// src/lib/providers/active-provider-client.ts
import { apiClient } from '@/lib/apiClient';
import { ProviderID } from './index';

/**
 * Client-side function to get the active provider for the current user
 * This makes an API call instead of directly accessing the database
 */
export async function getActiveProvider(): Promise<ProviderID | null> {
  try {
    const response = await apiClient('/api/providers/active');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch active provider: ${response.status}`);
    }
    
    const data = await response.json();
    return data.activeProvider || null;
  } catch (error) {
    console.error('Error getting active provider:', error);
    return null;
  }
}
