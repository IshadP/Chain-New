// FILE: apps/web/src/app/create-batch/page.tsx

"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import SupplyChainArtifact from '../../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '@/lib/deployment.json';
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/nextjs";
import { decodeEventLog } from 'viem';

// --- Types for manual state management ---
interface CreateBatchForm {
  productName: string;
  quantity: number | ''; 
  ewaybillNo: string;
  description: string;
  cost: number | '';
  currentLocation: string;
  internalBatchNo: string;
}

// Type for validation errors
interface CreateBatchErrors {
  productName?: string;
  quantity?: string;
  ewaybillNo?: string;
  description?: string;
  cost?: string;
  form?: string;
  currentLocation: string;
  internalBatchNo: string;
}

const abi = SupplyChainArtifact.abi;
const contractAddress = deployment.address as `0x${string}`;

/**
 * **IMPROVED LOG DECODING FUNCTION using viem**
 * Extracts the on-chain batchId from the transaction receipt logs.
 */
function extractBatchIdFromReceipt(receipt: any): string | undefined {
  if (!receipt || !receipt.logs || receipt.logs.length === 0) return undefined;

  try {
    // Find the BatchCreated event in the logs
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
        try {
          // Decode the log using viem
          const decoded = decodeEventLog({
            abi: abi,
            data: log.data,
            topics: log.topics,
          });

          // Check if this is the BatchCreated event
          if (decoded.eventName === 'BatchCreated') {
            const batchId = (decoded.args as any).batchId;
            return batchId.toString();
          }
        } catch (decodeError) {
          console.warn('Failed to decode log:', decodeError);
          continue;
        }
      }
    }

    // Fallback to manual decoding if viem fails
    const targetLog = receipt.logs.find((log: any) => 
      log.address.toLowerCase() === contractAddress.toLowerCase()
    );

    if (targetLog && targetLog.data && targetLog.data.length > 2) {
      const data = targetLog.data;
      const batchIdHex = data.substring(0, 66); // First 32 bytes
      const batchId = BigInt(batchIdHex).toString();
      return batchId;
    }
  } catch (error) {
    console.error("Error extracting batch ID from receipt:", error);
  }

  return undefined;
}

/**
 * Generate QR code for the batch
 */
async function generateQRForBatch(batchId: string): Promise<void> {
  try {
    const response = await fetch('/api/qr/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate QR code');
    }

    const qrData = await response.json();
    console.log('QR code generated successfully:', qrData);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

export default function CreateBatchPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userId } = useAuth();
  const { address: actorAddress, isConnected } = useAccount();
  const { data: hash, writeContract, isPending: isWalletPending, error: writeError } = useWriteContract();

  // State for form data and errors
  const [formData, setFormData] = useState<CreateBatchForm>({
    productName: '',
    quantity: '',
    ewaybillNo: '',
    description: '',
    cost: '',
    currentLocation: '',
    internalBatchNo: '',
  });

  const [errors, setErrors] = useState<CreateBatchErrors>({});
  
  const { 
    data: receipt, 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    error: receiptError 
  } = useWaitForTransactionReceipt({ 
    hash,
    confirmations: 1 // Wait for at least 1 confirmation
  });

  // Handle write contract errors
  useEffect(() => {
    if (writeError) {
      console.error('Write contract error:', writeError);
      toast({
        title: "Transaction Failed",
        description: `Failed to send transaction: ${writeError.message}`,
        variant: "destructive"
      });
    }
  }, [writeError, toast]);

  // Handle receipt errors
  useEffect(() => {
    if (receiptError) {
      console.error('Receipt error:', receiptError);
      toast({
        title: "Transaction Error",
        description: `Transaction failed: ${receiptError.message}`,
        variant: "destructive"
      });
    }
  }, [receiptError, toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      // Convert to Number only if value is not empty, otherwise keep it ''
      [id]: (id === 'quantity' || id === 'cost') ? (value === '' ? '' : Number(value)) : value,
    }));
    if (errors[id as keyof CreateBatchErrors]) {
      setErrors(prev => ({ ...prev, [id]: undefined }));
    }
  };
  
  // Manual Validation Logic
  const validateForm = (data: CreateBatchForm) => {
    const newErrors: CreateBatchErrors = {};
    const quantity = data.quantity as number;
    const cost = data.cost as number;

    if (!data.productName.trim()) newErrors.productName = 'Product name is required';
    
    // Check if it's not a number OR if it's a number but not positive
    if (typeof data.quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
      newErrors.quantity = 'Quantity must be a positive number';
    }
    
    if (!data.ewaybillNo.trim()) newErrors.ewaybillNo = 'E-way bill number is required';
    
    // Cost is optional, only validate if it's present and numeric
    if (data.cost !== '' && (typeof data.cost !== 'number' || isNaN(cost) || cost <= 0)) {
      newErrors.cost = 'Cost must be a positive number or empty';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Callback to save off-chain data to the database
  const saveOffChainData = useCallback(async (onChainBatchId: string, offChainData: CreateBatchForm) => {
    if (!userId || !actorAddress) {
      throw new Error('User not authenticated or wallet not connected');
    }

    try {
      const requestBody = {
        batch_id: onChainBatchId,
        product_name: offChainData.productName.trim(),
        quantity: offChainData.quantity as number,
        eway_bill_no: offChainData.ewaybillNo.trim(),
        description: offChainData.description.trim() || null,
        cost: (typeof offChainData.cost === 'number' && offChainData.cost > 0) ? offChainData.cost : null,
        manufacturer_id: userId,
        current_holder_wallet: actorAddress,
      };

      console.log('Sending request body to API:', requestBody);

      const response = await fetch('/api/inventory/add', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('API Error Response:', responseData);
        throw new Error(responseData.error || `HTTP ${response.status}: Failed to save off-chain data.`);
      }

      console.log('Successfully saved to database:', responseData);
      toast({ 
        title: "Database Success!", 
        description: "Batch details saved to Supabase.",
        variant: "default"
      });

      // Generate QR code after successful database save
      try {
        await generateQRForBatch(onChainBatchId);
        toast({ 
          title: "QR Code Generated!", 
          description: "QR code created for batch tracking.",
          variant: "default"
        });
      } catch (qrError) {
        console.error('QR generation failed:', qrError);
        toast({
          title: "QR Generation Warning",
          description: "Batch created successfully but QR code generation failed.",
          variant: "default"
        });
      }

      // Navigate to dashboard after success
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      console.error("Error saving off-chain data:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      toast({
        title: "Database Error",
        description: `Failed to save batch to Supabase: ${errorMessage}`,
        variant: "destructive"
      });
      throw err; // Re-throw to handle in confirmation callback
    }
  }, [userId, actorAddress, router, toast]);

  // Callback to handle transaction confirmation
  const handleConfirmation = useCallback(async (txReceipt: any) => {
    if (!actorAddress || !userId) {
      toast({
        title: "Authentication Error",
        description: "User authentication or wallet connection lost.",
        variant: "destructive"
      });
      return;
    }

    console.log('Transaction receipt:', txReceipt);

    const onChainBatchId = extractBatchIdFromReceipt(txReceipt);

    if (onChainBatchId) {
      toast({ 
        title: "On-Chain Success!", 
        description: `Batch ${onChainBatchId} created successfully on blockchain.`,
        variant: "default"
      });
      
      try {
        await saveOffChainData(onChainBatchId, formData as CreateBatchForm);
      } catch (saveError) {
        console.error('Failed to save off-chain data:', saveError);
        // Error already handled in saveOffChainData
      }
    } else {
      console.error("Could not find BatchCreated event in transaction logs.", txReceipt.logs);
      toast({
        title: "Parsing Error",
        description: "Could not extract batch ID from transaction. Database not updated.",
        variant: "destructive"
      });
    }
  }, [toast, saveOffChainData, userId, actorAddress, formData]);

  // The useEffect hook to watch for a confirmed transaction
  useEffect(() => {
    if (isConfirmed && receipt) {
      console.log('Transaction confirmed, handling confirmation...');
      handleConfirmation(receipt);
    }
  }, [isConfirmed, receipt, handleConfirmation]);

  // Manual Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('Form submitted with data:', formData);

    // 🛡️ CRITICAL CHECK 1: Ensure wallet is connected
    if (!isConnected || !actorAddress) {
      toast({ 
        title: "Connection Error", 
        description: "Please connect your wallet before creating a batch.", 
        variant: "destructive" 
      });
      return;
    }
    
    // 🛡️ CRITICAL CHECK 2: Ensure user is authenticated (Clerk)
    if (!userId) {
      toast({ 
        title: "Authentication Required", 
        description: "You must be logged in to create a batch.", 
        variant: "destructive" 
      });
      return;
    }

    // 🛡️ CRITICAL CHECK 3: Form validation
    if (!validateForm(formData as CreateBatchForm)) {
      toast({
        title: "Validation Error",
        description: "Please correct the errors in the form.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Initiating blockchain transaction...');
      console.log('Contract address:', contractAddress);
      console.log('Quantity:', formData.quantity);
      console.log('E-way Bill:', formData.ewaybillNo);

      // Validation passed, initiate transaction
      await writeContract({
        address: contractAddress,
        abi: abi,
        functionName: 'createBatch',
        args: [BigInt(formData.quantity as number), formData.ewaybillNo.trim(), BigInt(formData.cost), formData.internalBatchNo.trim(), formData.currentLocation.trim()],
      });

      console.log('Transaction initiated successfully');
    } catch (error) {
      console.error('Error initiating transaction:', error);
      toast({
        title: "Transaction Error",
        description: `Failed to initiate transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const isProcessing = isWalletPending || isConfirming;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl">Create New Product Batch</CardTitle>
          <CardDescription>
            Fill in the details below to register a new batch on the blockchain and in the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name</Label>
                <Input 
                  id="productName" 
                  placeholder="e.g., Organic Apples" 
                  value={formData.productName} 
                  onChange={handleChange}
                  disabled={isProcessing}
                />
                {errors.productName && <p className="text-sm text-red-500">{errors.productName}</p>}
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input 
                  id="quantity" 
                  type="number" 
                  placeholder="e.g., 500" 
                  value={formData.quantity} 
                  onChange={handleChange}
                  disabled={isProcessing}
                  min="1"
                  step="1"
                />
                {errors.quantity && <p className="text-sm text-red-500">{errors.quantity}</p>}
              </div>
            </div>

            {/* E-way Bill Number */}
            <div className="space-y-2">
              <Label htmlFor="ewaybillNo">E-way Bill Number</Label>
              <Input 
                id="ewaybillNo" 
                placeholder="e.g., EWB1234567890" 
                value={formData.ewaybillNo} 
                onChange={handleChange}
                disabled={isProcessing}
              />
              {errors.ewaybillNo && <p className="text-sm text-red-500">{errors.ewaybillNo}</p>}
            </div>

            {/* E-way Bill Number */}
            <div className="space-y-2">
              <Label htmlFor="InternalBatchNo">Internal Batch No.</Label>
              <Input 
                id="internalbatchNo." 
                placeholder="e.g., EWB1234567890" 
                value={formData.internalBatchNo} 
                onChange={handleChange}
                disabled={isProcessing}
              />
              {errors.internalBatchNo && <p className="text-sm text-red-500">{errors.internalBatchNo}</p>}
            </div>

            {/* Cost (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="cost">Total Cost (Optional)</Label>
              <Input 
                id="cost" 
                type="number" 
                placeholder="e.g., 25000" 
                value={formData.cost} 
                onChange={handleChange}
                disabled={isProcessing}
                min="0"
                step="0.01"
              />
              {errors.cost && <p className="text-sm text-red-500">{errors.cost}</p>}
            </div>

            {/* E-way Bill Number */}
            <div className="space-y-2">
              <Label htmlFor="currentLocation">Current Location</Label>
              <Input 
                id="currentLocation" 
                placeholder="e.g., Nagpur" 
                value={formData.currentLocation} 
                onChange={handleChange}
                disabled={isProcessing}
              />
              {errors.currentLocation && <p className="text-sm text-red-500">{errors.currentLocation}</p>}
            </div>

            {/* Description (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                placeholder="Add any extra details about the batch..." 
                value={formData.description} 
                onChange={handleChange}
                disabled={isProcessing}
                rows={3}
              />
            </div>

            {/* Connection Status Display */}
            <div className="text-sm text-gray-600 space-y-1">
              <p>Wallet: {isConnected ? `✅ Connected (${actorAddress?.slice(0, 6)}...${actorAddress?.slice(-4)})` : '❌ Not Connected'}</p>
              <p>Authentication: {userId ? '✅ Logged In' : '❌ Not Logged In'}</p>
            </div>

            <Button type="submit" className="w-full" disabled={isProcessing || !isConnected || !userId}>
              {isWalletPending ? 'Confirm in Wallet...' : 
               isConfirming ? 'Processing On-Chain...' : 
               'Create Batch & Generate QR'}
            </Button>
          </form>

          {hash && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-700">Transaction Sent!</p>
              <p className="text-xs text-blue-600 mt-1 break-all">Hash: {hash}</p>
              {isConfirming && <p className="text-xs text-blue-600 mt-1">⏳ Waiting for confirmation...</p>}
            </div>
          )}

          {isConfirmed && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-700">✅ Transaction Confirmed!</p>
              <p className="text-xs text-green-600 mt-1">Saving to database and generating QR code...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}