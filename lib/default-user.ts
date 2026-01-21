import { prisma } from '@/lib/db'

const DEFAULT_USER_EMAIL = 'default@minimal-web.local'

/**
 * Gets or creates a default user for single-user mode
 */
export async function getDefaultUserId(): Promise<string> {
  let user = await prisma.user.findUnique({
    where: { email: DEFAULT_USER_EMAIL },
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEFAULT_USER_EMAIL,
        name: 'Default User',
      },
    })
  }

  return user.id
}
