import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldOff, Loader2 } from 'lucide-react';
import SupplyChainArtifact from '../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../lib/deployment.json';

interface GrantRoleButtonProps {
  walletAddress: `0x${string}`;
  role: 'distributor' | 'retailer';
  isAlreadyGranted: boolean;
  onRoleGranted: () => void;
  onRoleRevoked: () => void;
}

const abi = SupplyChainArtifact.abi;
const contractAddress = deployment.address as `0x${string}`;

export function GrantRoleButton({ 
  walletAddress, 
  role, 
  isAlreadyGranted, 
  onRoleGranted,
  onRoleRevoked 
}: GrantRoleButtonProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  // Handle successful transaction
  React.useEffect(() => {
    if (isSuccess && hash) {
      setIsProcessing(false);
      
      if (isAlreadyGranted) {
        // Role was revoked
        toast({
          title: 'Role Revoked!',
          description: `${role} role has been revoked for ${walletAddress.slice(0, 8)}...`,
        });
        onRoleRevoked();
      } else {
        // Role was granted
        toast({
          title: 'Role Granted!',
          description: `${role} role has been granted to ${walletAddress.slice(0, 8)}...`,
        });
        onRoleGranted();
      }
    }
  }, [isSuccess, hash, isAlreadyGranted, role, walletAddress, onRoleGranted, onRoleRevoked, toast]);

  const handleGrantRole = () => {
    setIsProcessing(true);
    
    try {
      const functionName = role === 'distributor' ? 'grantDistributorRole' : 'grantRetailerRole';
      
      writeContract({
        address: contractAddress,
        abi: abi,
        functionName,
        args: [walletAddress],
      });
    } catch (error) {
      console.error('Error granting role:', error);
      toast({
        title: 'Error',
        description: 'Failed to grant role. Please try again.',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  const handleRevokeRole = () => {
    setIsProcessing(true);
    
    try {
      const functionName = role === 'distributor' ? 'revokeDistributorRole' : 'revokeRetailerRole';
      
      writeContract({
        address: contractAddress,
        abi: abi,
        functionName,
        args: [walletAddress],
      });
    } catch (error) {
      console.error('Error revoking role:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke role. Please try again.',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  const isLoading = isPending || isConfirming || isProcessing;

  if (isAlreadyGranted) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleRevokeRole}
        disabled={isLoading}
        className="text-red-600 border-red-200 hover:bg-red-50"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <ShieldOff className="h-4 w-4 mr-2" />
        )}
        {isLoading ? 'Revoking...' : 'Revoke Role'}
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleGrantRole}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Shield className="h-4 w-4 mr-2" />
      )}
      {isLoading ? 'Granting...' : 'Grant Role'}
    </Button>
  );
}