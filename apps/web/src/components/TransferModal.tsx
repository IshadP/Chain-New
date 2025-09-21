import React, { useState, useEffect } from "react";
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
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Define the structure of the recipient data
interface Recipient {
  id: string;
  wallet_address: string;
  role: string;
}

// Helper to format wallet addresses
const formatAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to convert UUID to bytes16

interface TransferModalProps {
  batchId: string;
}

export function TransferModal({ batchId }: TransferModalProps) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(true);
  const [transferringTo, setTransferringTo] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const { address: actorAddress } = useAccount();

  const { data: hash, writeContract, isPending, error: contractError, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({ hash });

  // Fetch recipients when modal opens
  useEffect(() => {
    if (open && user) {
      setIsLoadingRecipients(true);
      fetch('/api/users/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRole: user.publicMetadata?.role })
      })
        .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch recipients'))
        .then(setRecipients)
        .catch(err => {
          console.error('Failed to fetch recipients:', err);
          toast({ title: "Error", description: "Could not load recipient list.", variant: "destructive" });
        })
        .finally(() => setIsLoadingRecipients(false));
    }
  }, [open, user, toast]);

  // Function to initiate the on-chain transaction
  const handleTransfer = (recipientWallet: string) => {
    console.log(`[1] handleTransfer triggered for recipient: ${recipientWallet}`);
    if (!recipientWallet) {
      toast({ title: "Error", description: "Recipient wallet is invalid.", variant: "destructive" });
      return;
    }

    setTransferringTo(recipientWallet);
    const batchIdBytes = batchId;
    console.log(`[2] Converted Batch ID to bytes16: ${batchIdBytes}`);

    console.log("[3] Calling writeContract...");
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainArtifact.abi,
      functionName: 'transferBatch',
      args: [batchIdBytes, recipientWallet as `0x${string}`],
    });
  };
  
  // This effect handles the entire lifecycle of the transaction after it's initiated
  useEffect(() => {
    // A. Handle post-confirmation (off-chain) logic
    if (isConfirmed && actorAddress && transferringTo) {
      console.log(`[SUCCESS] Transaction confirmed with hash: ${hash}`);
      toast({ title: "✅ On-Chain Success", description: "Batch transfer confirmed on-chain." });
      
      const processOffChainUpdates = async () => {
        try {
          // Off-chain updates...
          await fetch('/api/inventory/transfer', { /* ... */ });
          await fetch('/api/history/add', { /* ... */ });
          toast({ title: "💾 Off-Chain Success", description: "Database state updated."});
          setOpen(false);
          router.refresh();
        } catch (error) {
           toast({ title: "Post-Transfer Failed", description: "CRITICAL: On-chain transfer succeeded but off-chain updates failed.", variant: "destructive", duration: 15000 });
        } finally {
          setTransferringTo(null);
          reset(); // Reset wagmi state
        }
      };
      processOffChainUpdates();
    }

    // B. Handle errors from the contract write or transaction receipt
    const error = contractError || receiptError;
    if (error) {
      console.error("[ERROR] A contract or transaction error occurred:", error);
      toast({ 
        title: "Transaction Failed", 
        description: error.message.split('Reason:')[1] || error.message, 
        variant: "destructive",
        duration: 10000,
      });
      setTransferringTo(null); // Stop the 'Sending...' state
      reset(); // Reset wagmi state to allow retrying
    }
  }, [isConfirmed, contractError, receiptError, hash, actorAddress, transferringTo, batchId, toast, router, reset]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Transfer</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer Batch</DialogTitle>
          <DialogDescription>Select a recipient for batch: {batchId.slice(0, 12)}...</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoadingRecipients ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Wallet Address</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {recipients.length > 0 ? recipients.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{formatAddress(r.wallet_address)}</TableCell>
                      <TableCell className="capitalize">{r.role}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleTransfer(r.wallet_address)}
                          disabled={isPending || isConfirming}
                        >
                          {isPending && transferringTo === r.wallet_address ? 'Confirming...' :
                           isConfirming && transferringTo === r.wallet_address ? 'Sending...' :
                           'Send'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="h-24 text-center">No available recipients found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}