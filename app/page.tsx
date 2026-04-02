'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'

const ROTATING_LINES = [
  'Precision Planning for Every Space',
  'Elegant Workflow from Lead to Delivery',
  'Seamless Team Coordination, End to End',
]

export default function Home() {
  const [activeLine, setActiveLine] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveLine((prev) => (prev + 1) % ROTATING_LINES.length)
    }, 2800)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 dark:opacity-14"
        style={{ backgroundImage: `url('/checkbackground.jpg')` }}
      />
      <div className="absolute inset-0 z-0 bg-background/82 dark:bg-background/88" />
      <motion.div
        className="pointer-events-none absolute -right-24 -top-24 z-0 h-72 w-72 rounded-full border border-foreground/10"
        animate={{ scale: [1, 1.08, 1], rotate: [0, 8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 sm:px-6">
        <motion.main
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="w-full rounded-3xl border border-foreground/10 bg-background/85 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.12)] backdrop-blur-sm md:p-10"
        >
          <div className="mb-8 flex items-start justify-between gap-4 border-b border-foreground/10 pb-6">
            <div>
              <img
                src="/aesthetic-icon.png"
                alt="Aesthetic Interior Logo"
                className="mb-4 h-14 w-14 rounded-xl border border-foreground/10 bg-background/60 p-2 shadow-sm"
              />
              <p className="text-xs tracking-[0.3em] text-foreground/65">AESTHETIC INTERIOR</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-wide sm:text-4xl">
                Operations Management Software <span className="text-foreground/50 font-bold text-xs border border-foreground/25 bg-background px-2 py-1 rounded-4xl  ">•V1.2.0</span> 
              </h1>
            </div>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_0.9fr] md:gap-8">
            <section>
              <p className="mb-4 text-sm leading-relaxed text-foreground/75 sm:text-base">
                A focused opening workspace for our interior operations team. This software helps us
                manage leads, assign responsibilities, track follow-ups, and keep delivery flow clear.
              </p>
              <div className="relative mb-5 min-h-8 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={ROTATING_LINES[activeLine]}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35 }}
                    className="text-sm font-medium tracking-wide text-foreground/85"
                  >
                    {ROTATING_LINES[activeLine]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <p className="text-xs tracking-[0.18em] text-foreground/50">
                COMPANY INTRO • SOFTWARE PURPOSE • QUICK ACTION
              </p>
            </section>

            <section className="rounded-2xl border border-foreground/10 bg-background/70 p-4 sm:p-5">
              <p className="mb-3 text-xs tracking-[0.22em] text-foreground/55">WHAT THIS SYSTEM COVERS</p>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li>Lead intake and qualification workflow</li>
                <li>Team assignment by department</li>
                <li>Follow-up, visit, and progress tracking</li>
              </ul>
            </section>
          </div>

          <div className="mt-8 border-t border-foreground/10 pt-6">
            <p className="mb-4 text-xs tracking-[0.2em] text-foreground/55">ENTER WORKSPACE</p>
            <div className="flex flex-wrap items-center gap-3">
              <SignedOut>
                <SignInButton forceRedirectUrl="/onboarding">
                  <Button className="h-10 border border-foreground/25 bg-foreground text-background hover:bg-foreground/90">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton forceRedirectUrl="/onboarding">
                  <Button variant="outline" className="h-10 border-foreground/25 bg-transparent hover:bg-foreground/5">
                    Sign Up
                  </Button>
                </SignUpButton>
              </SignedOut>

              <SignedIn>
                <Button asChild className="h-10 border border-foreground/25 bg-foreground text-background hover:bg-foreground/90">
                  <Link href="/onboarding">
                    Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </SignedIn>
            </div>
          </div>
        </motion.main>
      </div>
    </div>
  )
}
