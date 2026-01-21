/**
 * Abstract interface for email service providers
 * Supports multiple email services (Resend, Mailgun, etc.)
 */
export interface EmailService {
  /**
   * Generate a unique email address for a publication
   * @param publicationName Name of the publication (used for email alias)
   * @returns The generated email address
   */
  generateEmailAddress(publicationName: string): Promise<string>

  /**
   * Delete an email address
   * @param email The email address to delete
   */
  deleteEmailAddress(email: string): Promise<void>

  /**
   * Verify webhook signature for security
   * @param payload Raw webhook payload
   * @param signature Signature from webhook headers
   * @returns True if signature is valid
   */
  verifyWebhook(payload: any, signature: string): boolean
}

/**
 * Get the email service instance based on environment configuration
 */
export function getEmailService(): EmailService | null {
  const provider = process.env.EMAIL_PROVIDER || 'resend'
  const apiKey = process.env.RESEND_API_KEY
  const domain = process.env.RESEND_DOMAIN

  if (!apiKey || !domain) {
    console.warn('Email service not configured. Set RESEND_API_KEY and RESEND_DOMAIN.')
    return null
  }

  if (provider === 'resend') {
    // Dynamic import to avoid loading if not used
    const { ResendEmailService } = require('./resend')
    return new ResendEmailService()
  }

  throw new Error(`Unsupported email provider: ${provider}`)
}
