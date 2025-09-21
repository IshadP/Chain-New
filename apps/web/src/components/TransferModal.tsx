"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Skeleton } from "./ui/skeleton";
import { useRouter } from "next/navigation";

interface Recipient { id: string; wallet_address: string; role: string; }

// Helper to format wallet addresses
const formatAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function TransferModal({ batchId }: { batchId: string }) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(true);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const { toast } = useToast();
  const router = useRouter();
  const { address: actorAddress } = useAccount(); // Get the current user's wallet

  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (open) { /* ... fetch recipients logic ... */ }
  }, [open, toast]);

  const handleTransfer = () => {
    if (!selectedRecipient) { toast({ title: "Error", description: "Please select a recipient.", variant: "destructive" }); return; }
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainArtifact.abi,
      functionName: 'transferBatch',
      args: [batchId, selectedRecipient],
    });
  };
  
  useEffect(() => {
    if (isConfirmed && actorAddress) {
      const processTransfer = async () => {
        try {
          toast({ title: "✅ On-Chain Success", description: "Batch transfer initiated." });
          // Update off-chain inventory state
          await fetch('/api/inventory/transfer', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchId, recipientWallet: selectedRecipient }),
          });
          toast({ title: "💾 Off-Chain Success", description: "Database updated."});
          
          // Log the history event
          await fetch('/api/history/add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              batch_id: batchId, event_type: 'Transferred', actor_wallet: actorAddress,
              notes: `Initiated transfer to ${formatAddress(selectedRecipient)}`, tx_hash: hash,
            }),
          });
          toast({ title: "📜 History Logged!", description: 'Transfer event recorded.' });
          
          setOpen(false);
          router.refresh();

        } catch (error) {
           toast({ title: "Post-Transfer Failed", description: `CRITICAL: On-chain transfer succeeded but off-chain updates failed. Error: ${error instanceof Error ? error.message : 'Unknown'}`, variant: "destructive", duration: 15000 });
        }
      };
      processTransfer();
    }
    if (contractError) { toast({ title: "Contract Error", description: contractError.message, variant: "destructive" }); }
  }, [isConfirmed, contractError, batchId, selectedRecipient, toast, router, actorAddress, hash]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Transfer</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Batch</DialogTitle>
          <DialogDescription>Select a recipient for batch: {batchId.slice(0, 12)}...</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Label htmlFor="recipient">Recipient</Label>
          {isLoadingRecipients ? <Skeleton className="h-10 w-full" /> : (
            <Select onValueChange={setSelectedRecipient} value={selectedRecipient}>
              <SelectTrigger><SelectValue placeholder="Select a recipient..." /></SelectTrigger>
              <SelectContent>
                {recipients.length > 0 ? recipients.map(r => (
                  <SelectItem key={r.id} value={r.wallet_address}>
                    <span className="font-mono">{r.wallet_address.slice(0, 10)}...</span>
                    <span className="ml-2 text-muted-foreground capitalize">({r.role})</span>
                  </SelectItem>
                )) : <div className="p-4 text-center text-sm text-gray-500">No recipients.</div>}
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

