// FILE: apps/web/src/components/GrantRoleButton.tsx

"use client";

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { SupplyChainABI } from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";

interface GrantRoleButtonProps {
  walletAddress: `0x${string}`;
  role: 'distributor' | 'retailer';
  isAlreadyGranted: boolean; // We'll use this later to disable the button if role is granted
}

/**
 * A client component button that allows the manufacturer (admin)
 * to grant an on-chain role to a specific user.
 */
export function GrantRoleButton({ walletAddress, role, isAlreadyGranted }: GrantRoleButtonProps) {
  const { toast } = useToast();
  const { data: hash, writeContract, isPending } = useWriteContract();

  const functionName = role === 'distributor' ? 'grantDistributorRole' : 'grantRetailerRole';

  const handleGrantRole = () => {
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainABI,
      functionName,
      args: [walletAddress],
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  
  if (isConfirmed) {
    // In a real app, you might want to automatically refresh the user list after this.
    // For now, a toast notification is sufficient.
    toast({ title: "Success!", description: `Role of ${role} granted to ${walletAddress.slice(0, 6)}...`});
  }
  
  if (isAlreadyGranted) {
      return <Button disabled variant="outline">Role Granted</Button>
  }

  return (
    <Button onClick={handleGrantRole} disabled={isPending || isConfirming}>
      {isPending ? 'Confirm...' : isConfirming ? 'Granting...' : `Grant ${role} Role`}
    </Button>
  );
}