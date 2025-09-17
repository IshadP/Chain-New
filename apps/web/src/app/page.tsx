'use client'

import { Button } from "@/components/ui/button";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-slate-50">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          SupChain
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          Experience unparalleled transparency, traceability, and trust with our blockchain-powered platform. Track your products from origin to consumer with an immutable and secure ledger.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          {/* The SignUpButton component from Clerk wraps our shadcn Button.
            mode="modal" tells Clerk to open the sign-up flow in a modal.
          */}
          <SignUpButton mode="modal">
            <Button size="lg">Get Started</Button>
          </SignUpButton>
          
          {/* The SignInButton component from Clerk wraps our shadcn Button.
            mode="modal" tells Clerk to open the sign-in flow in a modal.
          */}
          <SignInButton mode="modal">
            <Button size="lg" variant="outline">
              Sign In
            </Button>
          </SignInButton>
        </div>
      </div>
    </main>
  );
}