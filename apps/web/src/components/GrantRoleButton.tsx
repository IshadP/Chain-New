"use client";

import { useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { CheckCircle } from 'lucide-react';

interface GrantRoleButtonProps {
  walletAddress: `0x${string}`;
  role: 'distributor' | 'retailer';
  isAlreadyGranted: boolean;
  onRoleGranted: (walletAddress: string) => void; // Callback to notify parent of success
}

export function GrantRoleButton({ walletAddress, role, isAlreadyGranted, onRoleGranted }: GrantRoleButtonProps) {
  const { toast } = useToast();
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleGrantRole = () => {
    const functionName = role === 'distributor' ? 'grantDistributorRole' : 'grantRetailerRole';
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainArtifact.abi,
      functionName,
      args: [walletAddress],
    });
  };

  // Effect to handle transaction confirmation and errors
  useEffect(() => {
    if (isConfirmed) {
      toast({
        title: "Role Granted Successfully!",
        description: `Wallet ${walletAddress.slice(0, 10)}... now has the ${role} role on-chain.`,
      });
      // Call the callback to update the parent component's state
      onRoleGranted(walletAddress);
    }
    if (error) {
      toast({
        title: "Contract Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [isConfirmed, error, toast, role, walletAddress, onRoleGranted]);

  if (isAlreadyGranted) {
    return (
      <Button variant="outline" disabled className="bg-green-50 hover:bg-green-50 text-green-700">
        <CheckCircle className="mr-2 h-4 w-4" />
        Granted
      </Button>
    );
  }

  const isLoading = isPending || isConfirming;

  return (
    <Button onClick={handleGrantRole} disabled={isLoading}>
      {isLoading ? 'Processing...' : 'Grant Role'}
    </Button>
  );
}
