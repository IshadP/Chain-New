// FILE: apps/web/src/components/WalletProvider.tsx

'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { hardhat } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';

/**
 * This configuration sets up the connection to the blockchain.
 * We are configuring it for the local Hardhat network, which is the default for development.
 * The `injected` connector is used for browser wallets like MetaMask.
 */
const config = createConfig({
  chains: [hardhat],
  connectors: [
    injected(),
  ],
  transports: {
    [hardhat.id]: http(),
  },
});

const queryClient = new QueryClient();

/**
 * This WalletProvider component wraps the entire application.
 * It makes all the Wagmi hooks for wallet interaction available to any component.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}