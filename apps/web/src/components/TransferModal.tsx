// FILE: apps/web/src/components/TransferModal.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Skeleton } from "./ui/skeleton";
import { useRouter } from "next/navigation";

interface Recipient {
  id: string;
  wallet_address: string;
  role: string;
}

const SupplyChainABI = SupplyChainArtifact.abi;

export function TransferModal({ batchId }: { batchId: string }) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const { toast } = useToast();
  const router = useRouter();

  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Fetch recipients when the modal opens
  useEffect(() => {
    if (open) {
      setIsLoadingRecipients(true);
      fetch('/api/users/recipients')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then((data: Recipient[]) => setRecipients(data))
        .catch(err => {
          console.error("Failed to fetch recipients:", err);
          toast({ title: "Error", description: "Could not load recipient list.", variant: "destructive" });
        })
        .finally(() => setIsLoadingRecipients(false));
    }
  }, [open, toast]);

  // Handle the on-chain transfer
  const handleTransfer = () => {
    if (!selectedRecipient) {
      toast({ title: "Validation Error", description: "Please select a recipient.", variant: "destructive" });
      return;
    }
    console.log(`Transferring batch ${batchId} to ${selectedRecipient}`);
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainABI,
      functionName: 'transferBatch',
      args: [batchId as `0x${string}`, selectedRecipient as `0x${string}`], // IMPORTANT: Pass batchId as a string (bytes16)
    });
  };
  
  // Handle off-chain updates after successful on-chain transaction
  useEffect(() => {
    if (isConfirmed) {
      toast({ title: "On-Chain Success!", description: "Batch has been transferred." });

      // Update off-chain data
      fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          recipientWallet: selectedRecipient,
        }),
      })
      .then(res => {
        if (!res.ok) throw new Error("Failed to update off-chain data");
        toast({ title: "Off-Chain Success!", description: "Database updated."});
        setOpen(false);
        router.refresh(); // Refresh the page to show updated batch state
      })
      .catch(err => {
        console.error("Off-chain update failed:", err);
        toast({ title: "CRITICAL ERROR", description: `On-chain transfer succeeded but DB update failed. Batch ID: ${batchId}`, variant: "destructive", duration: 10000 });
      });
    }
    if(contractError){
        toast({ title: "Contract Error", description: contractError.message, variant: "destructive" });
    }
  }, [isConfirmed, contractError, batchId, selectedRecipient, toast, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Transfer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Batch</DialogTitle>
          <DialogDescription>Select a recipient for batch ID: {batchId.slice(0,12)}...</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Label htmlFor="recipient">Recipient</Label>
          {isLoadingRecipients ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select onValueChange={setSelectedRecipient} value={selectedRecipient}>
              <SelectTrigger>
                <SelectValue placeholder="Select a distributor or retailer..." />
              </SelectTrigger>
              <SelectContent>
                {recipients.length > 0 ? recipients.map(r => (
                  <SelectItem key={r.id} value={r.wallet_address}>
                    <span className="font-mono">{r.wallet_address.slice(0,10)}...</span>
                    <span className="ml-2 text-muted-foreground capitalize">({r.role})</span>
                  </SelectItem>
                )) : (
                  <div className="p-4 text-center text-sm text-gray-500">No available recipients found.</div>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleTransfer} disabled={isPending || isConfirming || isLoadingRecipients}>
            {isPending ? 'Confirm...' : isConfirming ? 'Transferring...' : 'Confirm Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}