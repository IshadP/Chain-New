// FILE: apps/web/src/components/ConnectWallet.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

/**
 * A UI component for connecting and disconnecting a user's wallet.
 * It now handles hydration errors by delaying the rendering of the
 * connected state until the component has mounted on the client.
 */
export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // --- FIX ---
  // We use a state variable to track if the component has mounted on the client.
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  // --- END FIX ---

  // If the component has not yet mounted on the client, render a placeholder
  // to prevent a hydration mismatch.
  if (!isClient) {
    return <Skeleton className="h-10 w-32" />;
  }

  // If the wallet is connected, display the user's address and a disconnect button.
  if (isConnected) {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm font-medium text-gray-700">
          {`${address?.slice(0, 6)}...${address?.slice(-4)}`}
        </p>
        <Button variant="outline" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }

  // If not connected, display a button to connect the wallet.
  return (
    <Button
      onClick={() => connect({ connector: connectors[0] })}
    >
      Connect Wallet
    </Button>
  );
}