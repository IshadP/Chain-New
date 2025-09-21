"use client";

import React from "react";
import { useAccount, useReadContract } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../lib/deployment.json';

export function ConnectedWalletInfo() {
  const { address, isConnected } = useAccount();

  const { data: isManufacturer } = useReadContract({
    address: deployment.address as `0x${string}`,
    abi: SupplyChainArtifact.abi,
    functionName: 'isManufacturer',
    args: [address!],
    query: {
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
          {isManufacturer ? (
            <Badge variant="secondary">Yes</Badge>
          ) : (
            <Badge variant="destructive">No</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}