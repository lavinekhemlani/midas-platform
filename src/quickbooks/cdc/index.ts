/**
 * CDC (Change Data Capture) Module - Polling Based
 *
 * Simple CDC implementation using DynamoDB for change timestamps.
 * No Redis required - clients poll for changes.
 *
 * How it works:
 * 1. Webhook receives change notification from QuickBooks
 * 2. We update `lastChangeAt` timestamp in DynamoDB (per entity type)
 * 3. Client polls /api/quickbooks/changes to get latest timestamps
 * 4. Client compares with local timestamps and refetches if changed
 */

export {
  getChangeTimestamps,
  updateChangeTimestamp,
  updateChangeTimestamps,
  type ChangeTimestamps,
} from './timestamps'
