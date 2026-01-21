import { NextRequest } from 'next/server'
import { handleResendInbound } from '@/lib/handlers/resend-inbound'

/**
 * Webhook endpoint to receive emails from email service (Resend, Mailgun, etc.)
 * 
 * POST /api/webhooks/email
 */
export async function POST(request: NextRequest) {
  return handleResendInbound(request)
}
