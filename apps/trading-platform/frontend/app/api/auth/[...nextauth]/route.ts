import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token, user }) {
      if (session.user) {
        (session.user as any).id = (user as any).id
        (session.user as any).role = (user as any).role
        (session.user as any).subscriptionTier = (user as any).subscriptionTier
      }
      return session
    },
    async jwt({ token, user, account }) {
      if (user) {
        (token as any).id = (user as any).id
        (token as any).role = (user as any).role
        (token as any).subscriptionTier = (user as any).subscriptionTier
      }
      return token
    }
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  session: {
    strategy: 'jwt'
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST } 