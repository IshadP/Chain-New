import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Helper to convert UUID to bytes16 format for smart contract
function uuidToBytes16(uuid: string): `0x${string}` {
  return `0x${uuid.replace(/-/g, '')}`;
}

interface ReceiveModalProps {
  batchId: string;
}

export function ReceiveModal({ batchId }: ReceiveModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { address: actorAddress } = useAccount(); // Get the receiver's wallet

  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleReceive = () => {
    // Convert UUID batch ID to bytes16 format
    const batchIdBytes = uuidToBytes16(batchId);
    
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainArtifact.abi,
      functionName: 'receiveBatch',
      args: [batchIdBytes],
    });
  };
  
  useEffect(() => {
    if (isConfirmed && actorAddress) {
      const processReceipt = async () => {
        try {
          toast({ title: "On-Chain Success", description: "Batch has been received." });
          
          // Update off-chain inventory state
          const receiveResponse = await fetch('/api/inventory/receive', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchId }),
          });

          if (!receiveResponse.ok) {
            const error = await receiveResponse.json();
            throw new Error(error.error || 'Failed to update database');
          }

          toast({ title: "Off-Chain Success", description: "Database updated."});
          
          // Log the history event (if you have this API)
          try {
            await fetch('/api/history/add', {
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                batch_id: batchId, 
                event_type: 'Received', 
                actor_wallet: actorAddress,
                notes: 'Batch ownership confirmed by recipient.', 
                tx_hash: hash,
              }),
            });
            toast({ title: "History Logged!", description: 'Receipt event recorded.' });
          } catch (historyError) {
            console.warn('Failed to log history:', historyError);
            // Don't fail the entire process if history logging fails
          }
          
          router.refresh();

        } catch(error) {
          toast({ 
            title: "Post-Receipt Failed", 
            description: `CRITICAL: On-chain receipt succeeded but off-chain updates failed. Error: ${error instanceof Error ? error.message : 'Unknown'}`, 
            variant: "destructive", 
            duration: 15000 
          });
        }
      };
      processReceipt();
    }
    if (contractError) { 
      toast({ title: "Contract Error", description: contractError.message, variant: "destructive" }); 
    }
  }, [isConfirmed, contractError, batchId, toast, router, actorAddress, hash]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary">Receive</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Receipt</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to take ownership of batch: {batchId.slice(0, 12)}... This action will be recorded on the blockchain.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReceive} disabled={isPending || isConfirming}>
            {isPending ? 'Confirm...' : isConfirming ? 'Receiving...' : 'Confirm and Receive'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}