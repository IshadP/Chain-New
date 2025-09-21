"use client";

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

/**
 * This component manages the session synchronization between Clerk and the wallet.
 * Its sole purpose is to ensure that if a user disconnects their wallet while
 * they have an active Clerk session, they are automatically signed out.
 * This prevents a state mismatch where the app is authenticated off-chain
 * but has no on-chain identity.
 */
export function WalletSessionManager() {
  const { isConnected, isConnecting } = useAccount();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();

  useEffect(() => {
    // We don't want to run this logic while the wallet is in the initial connection process.
    if (isConnecting) {
      return;
    }

    // The core logic: If a Clerk session exists but the wallet is disconnected,
    // it means the user manually disconnected from MetaMask or another wallet provider.
    // To maintain a consistent and secure state, we log the user out of the application.
    if (isSignedIn && !isConnected) {
      // The signOut function from Clerk handles the session termination.
      // The callback function redirects the user to the home page after sign-out is complete.
      signOut(() => router.push('/'));
    }
  }, [isConnected, isSignedIn, isConnecting, signOut, router]);

  // This component is a "logic component" and does not render any visible UI.
  return null;
}
