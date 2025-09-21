"use client";

import React, { useEffect, useCallback } from "react";
import { useReadContract } from 'wagmi';
import { Badge } from "@/components/ui/badge";
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../lib/deployment.json';
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
import { RefreshCw } from "lucide-react";

interface OnChainRoleCheckerProps {
  address: `0x${string}`;
}

export function OnChainRoleChecker({ address }: OnChainRoleCheckerProps) {
  const { data: isDistributor, isLoading: isLoadingDistributor, refetch: refetchDistributor } = useReadContract({
    address: deployment.address as `0x${string}`,
    abi: SupplyChainArtifact.abi,
    functionName: 'isDistributor',
    args: [address],
  });

  const { data: isRetailer, isLoading: isLoadingRetailer, refetch: refetchRetailer } = useReadContract({
    address: deployment.address as `0x${string}`,
    abi: SupplyChainArtifact.abi,
    functionName: 'isRetailer',
    args: [address],
  });

  const handleRefresh = useCallback(() => {
    console.log(`Manually refreshing roles for ${address}...`);
    refetchDistributor();
    refetchRetailer();
  }, [refetchDistributor, refetchRetailer, address]);

  // Log the results whenever the data changes
  useEffect(() => {
    console.log(`On-chain status for ${address}: Distributor=${isDistributor}, Retailer=${isRetailer}`);
  }, [isDistributor, isRetailer, address]);

  const isLoading = isLoadingDistributor || isLoadingRetailer;

  return (
    <div className="flex items-center space-x-2">
      {isLoading ? (
        <Skeleton className="h-6 w-20" />
      ) : isDistributor ? (
        <Badge variant="secondary">Distributor</Badge>
      ) : isRetailer ? (
        <Badge variant="secondary">Retailer</Badge>
      ) : (
        <Badge variant="destructive">None</Badge>
      )}
      <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
}