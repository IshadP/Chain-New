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
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Skeleton } from "./ui/skeleton";

// Define the structure of the recipient data we expect from our API
interface Recipient {
  display_name: string | null;
  wallet_address: string;
}
SupplyChainABI = SupplyChainArtifact.abi;
/**
 * This updated TransferModal fetches a live list of potential recipients
 * from the database instead of using mock data.
 */
export function TransferModal({ batchId }: { batchId: string }) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const { toast } = useToast();
  const { address: actorAddress } = useAccount();
  const { data: hash, writeContract, isPending } = useWriteContract();

  // Fetch the list of recipients when the modal is opened
  useEffect(() => {
    if (open) {
      setIsLoadingRecipients(true);
      fetch('/api/users/recipients')
        .then(res => res.json())
        .then((data: Recipient[]) => {
          setRecipients(data);
        })
        .catch(err => {
          console.error("Failed to fetch recipients:", err);
          toast({ title: "Error", description: "Could not load recipient list.", variant: "destructive" });
        })
        .finally(() => {
          setIsLoadingRecipients(false);
        });
    }
  }, [open, toast]);

  const handleTransfer = () => {
    if (!selectedRecipient) {
      toast({ title: "Error", description: "Please select a recipient.", variant: "destructive" });
      return;
    }
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainABI,
      functionName: 'transferBatch',
      args: [BigInt(batchId), selectedRecipient as `0x${string}`],
    });
  };
  
  const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConfirmed && receipt && actorAddress) {
      toast({ title: "Success", description: `Batch ${batchId} transferred on-chain.` });
      
      fetch('/api/history/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          eventType: 'Transferred',
          actorAddress,
          details: `Transferred to ${selectedRecipient.slice(0, 10)}...`,
        }),
      }).then(() => {
        setOpen(false); // Close modal on success
      });
    }
  }, [isConfirmed, receipt, actorAddress, batchId, selectedRecipient, toast]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Transfer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Batch</DialogTitle>
          <DialogDescription>Select a recipient to transfer batch ID: {batchId}</DialogDescription>
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
                  <SelectItem key={r.wallet_address} value={r.wallet_address}>
                    {r.display_name ?? 'Unnamed User'} - {r.wallet_address.slice(0,10)}...
                  </SelectItem>
                )) : (
                  <div className="p-4 text-center text-sm text-gray-500">No recipients found.</div>
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