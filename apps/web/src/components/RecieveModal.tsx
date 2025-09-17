// FILE: apps/web/src/components/RecieveModal.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { SupplyChainABI } from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";

/**
 * A modal component for a user to confirm they have received a batch.
 */
export function RecieveModal({ batchId }: { batchId: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { address: actorAddress } = useAccount();
  const { data: hash, writeContract, isPending } = useWriteContract();

  const handleReceive = () => {
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainABI,
      functionName: 'receiveBatch',
      args: [BigInt(batchId)],
    });
  };
  
  const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  
  useEffect(() => {
    if (isConfirmed && receipt && actorAddress) {
      toast({ title: "Success", description: `Batch ${batchId} marked as received.` });

      fetch('/api/history/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          eventType: 'Received',
          actorAddress,
          details: `Batch received by ${actorAddress.slice(0, 6)}...`,
        }),
      }).then(() => {
        setOpen(false); // Close modal on success
      });
    }
  }, [isConfirmed, receipt, actorAddress, batchId, toast]);


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Receive</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Receipt</DialogTitle>
          <DialogDescription>
            Are you sure you want to mark batch ID: {batchId} as received? This action will be recorded on the blockchain.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleReceive} disabled={isPending || isConfirming}>
            {isPending ? 'Confirm...' : isConfirming ? 'Processing...' : 'Confirm Receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}