import { NextRequest } from 'next/server'
import { handleResendInbound } from '@/lib/handlers/resend-inbound'

export async function POST(request: NextRequest) {
  return handleResendInbound(request)
}
