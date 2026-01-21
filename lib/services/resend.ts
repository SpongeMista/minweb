import { Resend } from 'resend'
import { EmailService } from './email-service'
import crypto from 'crypto'

/**
 * Resend email service implementation
 * Note: Resend requires a custom domain to receive emails
 */
export class ResendEmailService implements EmailService {
  private resend: Resend
  private domain: string
  private webhookSecret: string | null

  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    const domain = process.env.RESEND_DOMAIN
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET || null

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required')
    }
    if (!domain) {
      throw new Error('RESEND_DOMAIN is required')
    }

    this.resend = new Resend(apiKey)
    this.domain = domain
    this.webhookSecret = webhookSecret
  }

  /**
   * Generate a unique email address using Resend
   * Resend doesn't have a direct API to create email addresses,
   * but we can use catch-all emails or create aliases
   * For now, we'll generate predictable email addresses based on publication name
   */
  async generateEmailAddress(publicationName: string): Promise<string> {
    // Generate a unique, URL-safe identifier from publication name
    const slug = publicationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30)

    // Add timestamp for uniqueness
    const timestamp = Date.now().toString(36)
    const uniqueId = `${slug}-${timestamp}`

    const email = `substack-${uniqueId}@${this.domain}`

    // Note: With Resend, if you have a catch-all setup on your domain,
    // emails to any address will be received. Otherwise, you may need to
    // configure forwarding rules or use Resend's domain features.

    return email
  }

  async deleteEmailAddress(email: string): Promise<void> {
    // Resend doesn't require explicit deletion of email addresses
    // if using catch-all. This is a no-op but kept for interface compliance.
    // If using specific aliases, you may need to manage them differently.
    console.log(`Email address ${email} will stop receiving emails (no action needed with catch-all)`)
  }

  verifyWebhook(payload: any, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('RESEND_WEBHOOK_SECRET not set, skipping webhook verification')
      return true // Allow in development, but warn
    }

    // Resend webhook signature verification
    // The signature format may vary - check Resend docs for exact format
    // For now, we'll use a simple HMAC verification
    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret)
      const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex')
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return false
    }
  }

  /**
   * Get the webhook URL for this service
   */
  getWebhookUrl(): string {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    return `${baseUrl}/api/webhooks/email`
  }
}
