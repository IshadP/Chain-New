// FILE: apps/web/src/components/WalletProvider.tsx

'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { hardhat } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';

/**
 * Configuration for connecting to a remote Hardhat node.
 * 
 * IMPORTANT: Replace HARDHAT_RPC_URL with your Lenovo's actual IP address.
 * 
 * To find your Lenovo's IP:
 * 1. On Windows: Run `ipconfig` in Command Prompt
 * 2. Look for the network adapter connected to your mobile hotspot
 * 3. Find the IPv4 Address (e.g., 192.168.43.100)
 * 
 * Then set in your .env.local:
 * NEXT_PUBLIC_HARDHAT_RPC_URL=http://192.168.43.100:8545
 */
const HARDHAT_RPC_URL = process.env.NEXT_PUBLIC_HARDHAT_RPC_URL || 'http://localhost:8545';

console.log('🔗 Connecting to Hardhat node at:', HARDHAT_RPC_URL);

/**
 * Custom Hardhat chain configuration for remote connection
 */
const customHardhat = {
  ...hardhat,
  rpcUrls: {
    default: {
      http: [HARDHAT_RPC_URL],
    },
    public: {
      http: [HARDHAT_RPC_URL],
    },
  },
};

/**
 * Wagmi configuration with remote RPC endpoint
 */
const config = createConfig({
  chains: [customHardhat],
  connectors: [
    injected(),
  ],
  transports: {
    [hardhat.id]: http(HARDHAT_RPC_URL),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Add retry logic for unreliable network
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Cache for longer to reduce network calls
      staleTime: 10000, // 10 seconds
    },
  },
});

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