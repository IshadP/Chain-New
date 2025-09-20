// FILE: apps/web/src/components/ReceiveModal.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const SupplyChainABI = SupplyChainArtifact.abi;

export function ReceiveModal({ batchId }: { batchId: string }) {
  const { toast } = useToast();
  const router = useRouter();

  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleReceive = () => {
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainABI,
      functionName: 'receiveBatch',
      args: [batchId as `0x${string}`],
    });
  };
  
  useEffect(() => {
    if (isConfirmed) {
      toast({ title: "On-Chain Success!", description: "Batch has been received." });
      
      // Update off-chain data
      fetch('/api/inventory/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      })
      .then(res => {
        if (!res.ok) throw new Error("Failed to update off-chain data");
        toast({ title: "Off-Chain Success!", description: "Database updated."});
        router.refresh();
      })
      .catch(err => {
        console.error("Off-chain update failed:", err);
        toast({ title: "CRITICAL ERROR", description: `On-chain receive succeeded but DB update failed. Batch ID: ${batchId}`, variant: "destructive", duration: 10000 });
      });
    }
     if(contractError){
        toast({ title: "Contract Error", description: contractError.message, variant: "destructive" });
    }
  }, [isConfirmed, contractError, batchId, toast, router]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary">Receive</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Receipt</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to take ownership of batch ID: {batchId.slice(0, 12)}... This action will be recorded on the blockchain.
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