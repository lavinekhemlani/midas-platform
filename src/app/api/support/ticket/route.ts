// src/app/api/support/ticket/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(dynamoClient)

const SUPPORT_TABLE_NAME = process.env.SUPPORT_TICKETS_TABLE_NAME
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

interface TicketData {
  subject: string
  category: string
  message: string
  userEmail: string
  userId?: string
  timestamp: string
}

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const tokenVerifier = new TokenVerifier()
    let userId: string | null = null

    try {
      const verificationResult = await TokenVerifier.verify(request)
      userId = verificationResult.userId
    } catch (error) {
      // Allow unauthenticated submissions but log it
      console.log('Unauthenticated support ticket submission')
    }

    const body: TicketData = await request.json()

    // Validate required fields
    if (!body.subject || !body.category || !body.message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate ticket ID
    const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Store ticket in DynamoDB (if table exists)
    try {
      if (SUPPORT_TABLE_NAME && process.env.AWS_REGION) {
        const ticketData = {
          PK: ticketId,
          SK: 'TICKET',
          subject: body.subject,
          category: body.category,
          message: body.message,
          userEmail: body.userEmail || 'not-provided',
          userId: userId || body.userId || 'anonymous',
          status: 'open',
          createdAt: new Date().toISOString(),
          timestamp: body.timestamp,
        }

        await ddbDocClient.send(
          new PutCommand({
            TableName: SUPPORT_TABLE_NAME,
            Item: ticketData,
          })
        )
      }
    } catch (dbError) {
      console.error('Failed to store ticket in database:', dbError)
      // Continue even if DB storage fails
    }

    // Send Slack notification
    try {
      if (SLACK_WEBHOOK_URL) {
        // Create Slack message with rich formatting
        const slackMessage = {
          text: `New Support Ticket: ${ticketId}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `New Support Ticket`,
                emoji: true,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Ticket ID:*\n\`${ticketId}\``,
                },
                {
                  type: 'mrkdwn',
                  text: `*Category:*\n${body.category}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Submitted:*\n<!date^${Math.floor(Date.now() / 1000)}^{date_short} {time}|${new Date().toLocaleString()}>`,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Subject:* ${body.subject}`,
              },
            },
            {
              type: 'divider',
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Message:*\n\`\`\`${body.message}\`\`\``,
              },
            },
            {
              type: 'divider',
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*User Email:*\n${body.userEmail || 'Not provided'}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*User ID:*\n${userId || body.userId || 'Anonymous'}`,
                },
              ],
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Reply via Email',
                    emoji: true,
                  },
                  url:
                    body.userEmail && body.userEmail !== 'Not provided'
                      ? `mailto:${body.userEmail}?subject=Re: Support Ticket ${ticketId}`
                      : undefined,
                  action_id: 'reply_email',
                  style: 'primary',
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View in Dashboard',
                    emoji: true,
                  },
                  url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.zenithos.com'}/admin/tickets/${ticketId}`,
                  action_id: 'view_ticket',
                },
              ],
            },
          ],
        }

        const response = await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(slackMessage),
        })

        if (!response.ok) {
          console.error('Slack webhook error:', await response.text())
        } else {
          console.log('Slack notification sent successfully for ticket:', ticketId)
        }
      }
    } catch (slackError) {
      console.error('Failed to send Slack notification:', slackError)
      // Continue even if Slack notification fails - ticket is still created
    }

    return NextResponse.json({
      success: true,
      ticketId,
      message: 'Support ticket submitted successfully',
    })
  } catch (error) {
    console.error('Error processing support ticket:', error)
    return NextResponse.json({ error: 'Failed to submit support ticket' }, { status: 500 })
  }
}
