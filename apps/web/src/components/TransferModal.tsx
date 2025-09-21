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
import { Label } from "@/components/ui/label";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

// Define the structure of the recipient data we expect from our API
interface Recipient {
  id: string;
  wallet_address: string;
  role: string;
}

// Helper to format wallet addresses for display
const formatAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to convert UUID to bytes16 format for smart contract
function uuidToBytes16(uuid: string): `0x${string}` {
  return `0x${uuid.replace(/-/g, '')}`;
}

interface TransferModalProps {
  batchId: string;
}

export function TransferModal({ batchId }: TransferModalProps) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(true);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const { address: actorAddress } = useAccount();

  const { data: hash, writeContract, isPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Effect to fetch the list of potential recipients when the modal is opened
  useEffect(() => {
    if (open && user) {
      setIsLoadingRecipients(true);
      fetch('/api/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRole: user.publicMetadata?.role })
      })
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch recipients');
            return res.json();
        })
        .then((data: Recipient[]) => {
          setRecipients(data);
        })
        .catch(err => {
          console.error('Failed to fetch recipients:', err);
          toast({ title: "Error", description: "Could not load recipient list.", variant: "destructive" });
        })
        .finally(() => {
          setIsLoadingRecipients(false);
        });
    }
  }, [open, user, toast]);

  // This function initiates the on-chain transaction
  const handleTransfer = () => {
    if (!selectedRecipient) {
      toast({ title: "Error", description: "Please select a recipient.", variant: "destructive" });
      return;
    }

    // Convert UUID batch ID to bytes16 format
    const batchIdBytes = uuidToBytes16(batchId);
    
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: SupplyChainArtifact.abi,
      functionName: 'transferBatch',
      args: [batchIdBytes, selectedRecipient as `0x${string}`],
    });
  };
  
  // This effect runs after the on-chain transaction is confirmed
  useEffect(() => {
    if (isConfirmed && actorAddress) {
      const processOffChainUpdates = async () => {
        try {
          toast({ title: "✅ On-Chain Success", description: "Batch transfer initiated." });
          
          // Step 1: Update the inventory state in Supabase
          const transferResponse = await fetch('/api/inventory/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchId, recipientWallet: selectedRecipient }),
          });

          if (!transferResponse.ok) {
            const error = await transferResponse.json();
            throw new Error(error.error || 'Failed to update database');
          }

          toast({ title: "💾 Off-Chain Success", description: "Database state updated."});
          
          // Step 2: Log the "Transferred" event to the history table (if you have this API)
          try {
            await fetch('/api/history/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                batch_id: batchId,
                event_type: 'Transferred',
                actor_wallet: actorAddress,
                notes: `Initiated transfer to recipient: ${formatAddress(selectedRecipient)}`,
                tx_hash: hash,
              }),
            });
            toast({ title: "📜 History Logged", description: "Transfer event recorded." });
          } catch (historyError) {
            console.warn('Failed to log history:', historyError);
            // Don't fail the entire process if history logging fails
          }
          
          // Step 3: Close the modal and refresh the dashboard to show the changes
          setOpen(false);
          setSelectedRecipient("");
          router.refresh();

        } catch (error) {
           toast({ 
             title: "Post-Transfer Failed", 
             description: `CRITICAL: On-chain transfer succeeded but off-chain updates failed. Error: ${error instanceof Error ? error.message : 'Unknown'}`, 
             variant: "destructive", 
             duration: 15000 
           });
        }
      };
      
      processOffChainUpdates();
    }
    if (contractError) {
      toast({ title: "Contract Error", description: contractError.message, variant: "destructive" });
    }
  }, [isConfirmed, contractError, batchId, selectedRecipient, toast, router, actorAddress, hash]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Transfer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Batch</DialogTitle>
          <DialogDescription>Select a recipient for batch: {batchId.slice(0, 12)}...</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Label htmlFor="recipient">Recipient</Label>
          {isLoadingRecipients ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select onValueChange={setSelectedRecipient} value={selectedRecipient}>
              <SelectTrigger>
                <SelectValue placeholder="Select a recipient..." />
              </SelectTrigger>
              <SelectContent>
                {recipients.length > 0 ? recipients.map(r => (
                  <SelectItem key={r.id} value={r.wallet_address}>
                    <span className="font-mono">{formatAddress(r.wallet_address)}</span>
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
          <Button onClick={handleTransfer} disabled={isPending || isConfirming || isLoadingRecipients || !selectedRecipient}>
            {isPending ? 'Confirming...' : isConfirming ? 'Transferring...' : 'Confirm Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}