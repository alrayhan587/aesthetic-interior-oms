import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import 'dotenv/config'

const globalForPrisma = global as unknown as {
    prisma: PrismaClient
}

console.log('[DEBUG lib/prisma.ts] Loading DATABASE_URL:', process.env.DATABASE_URL ? '***' : 'undefined');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma


export default prisma