"use client";

import React, { useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../lib/deployment.json';

interface GrantRoleButtonProps {
  addressToGrant: `0x${string}`;
  roleToGrant: 'Distributor' | 'Retailer';
}

export function GrantRoleButton({ addressToGrant, roleToGrant }: GrantRoleButtonProps) {
  const { address: connectedAddress } = useAccount();
  const { toast } = useToast();
  
  // Check if the connected user is the manufacturer
  const { data: isCallerManufacturer } = useReadContract({
    address: deployment.address as `0x${string}`,
    abi: SupplyChainArtifact.abi,
    functionName: 'isManufacturer',
    args: [connectedAddress!],
    query: {
      enabled: !!connectedAddress,
    }
  });

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleGrantRole = () => {
    if (!isCallerManufacturer) {
      toast({ title: "Permission Denied", description: "Only the on-chain manufacturer can grant roles.", variant: "destructive" });
      return;
    }
    
    const functionName = roleToGrant === 'Distributor' ? 'grantDistributorRole' : 'grantRetailerRole';
    
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainArtifact.abi,
      functionName: functionName,
      args: [addressToGrant],
    });
  };

  useEffect(() => {
    if (isConfirmed) {
      toast({ title: "✅ Success", description: `${roleToGrant} role granted on-chain.` });
    }
    if (error) {
      toast({ title: "Transaction Failed", description: error.message, variant: "destructive" });
    }
  }, [isConfirmed, error, toast, roleToGrant]);

  return (
    <Button size="sm" onClick={handleGrantRole} disabled={isPending || isConfirming || !isCallerManufacturer}>
      {isPending ? 'Confirm...' : isConfirming ? 'Granting...' : `Grant ${roleToGrant}`}
    </Button>
  );
}