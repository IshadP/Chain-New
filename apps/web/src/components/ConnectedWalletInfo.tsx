"use client";

import React from "react";
// Import isLoading from useReadContract
import { useAccount, useReadContract } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading state
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';

export function ConnectedWalletInfo() {
  const { address, isConnected } = useAccount();

  // Destructure isLoading as isRoleLoading
  const { 
    data: isManufacturer, 
    isLoading: isRoleLoading 
  } = useReadContract({
    address: deployment.address as `0x${string}`,
    abi: SupplyChainArtifact.abi,
    functionName: 'isManufacturer',
    // Safely cast 'address' as required by wagmi, relying on 'enabled' to prevent call when undefined
    args: [address as `0x${string}`],
    query: {
      // Query is only enabled when a valid address is present
      enabled: !!address,
    },
  });

  if (!isConnected || !address) {
    return (
      <Card className="bg-destructive text-destructive-foreground">
        <CardHeader>
          <CardTitle>Wallet Not Connected</CardTitle>
          <CardDescription className="text-destructive-foreground/80">
            Please connect your wallet to manage on-chain roles.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  // Helper to determine the role badge content
  const renderRoleStatus = () => {
    if (isRoleLoading) {
      return <Skeleton className="h-5 w-20 inline-block align-middle" />;
    }
    
    if (isManufacturer) {
      return <Badge variant="secondary">Yes</Badge>;
    }
    
    return <Badge variant="destructive">No</Badge>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Connected Wallet</CardTitle>
        <CardDescription>
          This is the account you are currently interacting with the blockchain from.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="font-mono text-sm break-all">
          <strong>Address:</strong> {address}
        </div>
        <div>
          <strong>On-Chain Manufacturer Status:</strong>{' '}
          {renderRoleStatus()}
        </div>
      </CardContent>
    </Card>
  );
}