import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import SupplyChainArtifact from '../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../lib/deployment.json';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Helper to convert UUID to bytes16 format for smart contract
function uuidToBytes16(uuid: string): `0x${string}` {
  // Handle both 0x-prefixed hex and UUID formats
  if (uuid.startsWith('0x')) {
    const hex = uuid.slice(2);
    if (hex.length !== 32) {
      throw new Error(`Invalid hex length: expected 32 hex characters (16 bytes), got ${hex.length}`);
    }
    return uuid as `0x${string}`;
  }
  
  // UUID format - remove hyphens
  const cleaned = uuid.replace(/-/g, '');
  if (cleaned.length !== 32) {
    throw new Error(`Invalid UUID length: expected 32 hex characters, got ${cleaned.length}`);
  }
  return `0x${cleaned}`;
}

interface ReceiveModalProps {
  batchId: string;
}

export function ReceiveModal({ batchId }: ReceiveModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const { address: actorAddress, isConnected } = useAccount();
  
  // State to control dialog and processing
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userLocation, setUserLocation] = useState<string>("");

  // Try to get location from Clerk metadata first
  const clerkLocation = user?.publicMetadata?.currentLocation as string | undefined;

  // Fetch user location from Supabase if not in Clerk
  useEffect(() => {
    const fetchUserLocation = async () => {
      if (clerkLocation) {
        setUserLocation(clerkLocation);
        return;
      }

      if (!user?.id) return;

      try {
        const response = await fetch(`/api/user/profile?userId=${user.id}`);
        if (response.ok) {
          const profile = await response.json();
          if (profile.currentLocation) {
            setUserLocation(profile.currentLocation);
          }
        }
      } catch (error) {
        console.error("Failed to fetch user location:", error);
      }
    };

    fetchUserLocation();
  }, [user?.id, clerkLocation]);

  const currentLocation = userLocation || clerkLocation;

  const { 
    data: hash, 
    writeContract, 
    isPending, 
    error: contractError,
    reset: resetContract 
  } = useWriteContract();
  
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({ hash });

  // Handle contract errors
  useEffect(() => {
    if (contractError) {
      console.error("Contract Error:", contractError);
      
      let errorMessage = contractError.message;
      
      // Parse common errors
      if (errorMessage.includes("User rejected")) {
        errorMessage = "Transaction rejected in MetaMask";
      } else if (errorMessage.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas fees";
      } else if (errorMessage.includes("Caller is not the intended recipient")) {
        errorMessage = "You are not the intended recipient of this batch";
      } else if (errorMessage.includes("Batch is not in transit")) {
        errorMessage = "This batch is not currently in transit";
      }
      
      toast({ 
        title: "Transaction Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
      
      setIsProcessing(false);
    }
  }, [contractError, toast]);

  // Handle successful confirmation
  useEffect(() => {
    if (isConfirmed && actorAddress && hash && !isProcessing) {
      setIsProcessing(true);
      
      const processReceipt = async () => {
        try {
          console.log("Transaction confirmed:", hash);
          
          toast({ 
            title: "Blockchain Confirmed", 
            description: "Batch receipt recorded on blockchain" 
          });
          
          // Update off-chain inventory state
          console.log("Updating database for batchId:", batchId);
          const receiveResponse = await fetch('/api/inventory/receive', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchId }),
          });

          if (!receiveResponse.ok) {
            const error = await receiveResponse.json();
            console.error("Database update failed:", error);
            throw new Error(error.error || 'Failed to update database');
          }

          const responseData = await receiveResponse.json();
          console.log("Database updated successfully:", responseData);

          toast({ 
            title: "Database Updated", 
            description: "Inventory status synchronized"
          });
          
          // Log the history event
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
            console.log("History logged successfully");
          } catch (historyError) {
            console.warn('Failed to log history:', historyError);
          }
          
          toast({ 
            title: "Success!", 
            description: 'Batch received and recorded successfully.' 
          });

          // Close the dialog and refresh
          setIsOpen(false);
          router.refresh();
          
          // Reset contract state
          resetContract();

        } catch(error) {
          console.error("Post-receipt processing error:", error);
          toast({ 
            title: "Partial Success", 
            description: `Blockchain updated but database sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
            variant: "destructive", 
            duration: 15000 
          });
        } finally {
          setIsProcessing(false);
        }
      };

      processReceipt();
    }
  }, [isConfirmed, actorAddress, hash, batchId, toast, router, resetContract, isProcessing]);

  const handleReceive = async (e: React.MouseEvent) => {
    console.log("🔵 handleReceive called!");
    console.log("Event:", e);
    
    // CRITICAL: Prevent default dialog close behavior
    e.preventDefault();
    e.stopPropagation();
    
    try {
      console.log("=== Starting Receive Process ===");
      console.log("isConnected:", isConnected);
      console.log("actorAddress:", actorAddress);
      console.log("currentLocation:", currentLocation);
      console.log("batchId:", batchId);
      
      // Validation checks
      if (!isConnected) {
        toast({ 
          title: "Wallet Not Connected", 
          description: "Please connect your MetaMask wallet", 
          variant: "destructive" 
        });
        return;
      }

      if (!actorAddress) {
        toast({ 
          title: "No Wallet Address", 
          description: "Unable to detect wallet address", 
          variant: "destructive" 
        });
        return;
      }

      if (!currentLocation) {
        console.error("❌ Current location is missing!");
        toast({ 
          title: "Location Missing", 
          description: "Your current location is required. Please update your profile.", 
          variant: "destructive" 
        });
        return;
      }

      if (!batchId) {
        toast({ 
          title: "Invalid Batch", 
          description: "Batch ID is missing", 
          variant: "destructive" 
        });
        return;
      }

      // Convert UUID to bytes16
      let batchIdBytes: `0x${string}`;
      try {
        batchIdBytes = uuidToBytes16(batchId);
        console.log("Batch ID conversion:", { original: batchId, converted: batchIdBytes });
      } catch (conversionError) {
        console.error("Batch ID conversion error:", conversionError);
        toast({ 
          title: "Invalid Batch ID", 
          description: conversionError instanceof Error ? conversionError.message : "Failed to convert batch ID", 
          variant: "destructive" 
        });
        return;
      }

      // Call the smart contract
      console.log("Calling receiveBatch with:", {
        batchId: batchIdBytes,
        location: currentLocation,
        contract: deployment.address
      });

      writeContract({
        address: deployment.address as `0x${string}`,
        abi: SupplyChainArtifact.abi,
        functionName: 'receiveBatch',
        args: [batchIdBytes, currentLocation],
      });

    } catch (error) {
      console.error("Error in handleReceive:", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "An unexpected error occurred", 
        variant: "destructive" 
      });
    }
  };

  const isButtonDisabled = isPending || isConfirming || isProcessing || !isConnected;

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (isPending) return "Confirm in MetaMask...";
    if (isConfirming) return "Processing Transaction...";
    if (isProcessing) return "Updating Database...";
    return "Confirm and Receive";
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="secondary"
          disabled={!isConnected}
          onClick={() => {
            if (!isConnected) {
              toast({ 
                title: "Wallet Required", 
                description: "Please connect your MetaMask wallet first", 
                variant: "destructive" 
              });
            }
          }}
        >
          Receive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Receipt</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You are about to take ownership of batch:{" "}
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                  {batchId.slice(0, 12)}...
                </code>
              </p>
              <p>This action will be recorded on the blockchain and cannot be undone.</p>
              {currentLocation ? (
                <p>
                  Location: <strong>{currentLocation}</strong>
                </p>
              ) : (
                <p className="text-red-600 font-semibold">
                  ⚠️ Warning: Current location not set in your profile!
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isButtonDisabled}>
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={(e) => {
              console.log("🟢 Button clicked!");
              console.log("isButtonDisabled:", isButtonDisabled);
              handleReceive(e);
            }}
            disabled={isButtonDisabled}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {getButtonText()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}