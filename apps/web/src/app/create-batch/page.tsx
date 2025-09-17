// FILE: apps/web/src/app/create-batch/page.tsx

"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseEventLogs } from 'viem';
import SupplyChainArtifact from '../../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '@/lib/deployment.json';
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/nextjs";

const createBatchSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  quantity: z.coerce.number().positive("Quantity must be a positive number"),
  ewaybillNo: z.string().min(1, "E-way bill number is required"),
  description: z.string().optional(),
  cost: z.coerce.number().positive("Cost must be a positive number").optional(),
});

type CreateBatchForm = z.infer<typeof createBatchSchema>;

// --- FIX: Create a typed constant for the ABI ---
const abi = SupplyChainArtifact.abi as const;
// --- END FIX ---

export default function CreateBatchPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userId } = useAuth();
  const { address: actorAddress } = useAccount();
  const { data: hash, writeContract, isPending: isWalletPending } = useWriteContract();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<CreateBatchForm>({
    resolver: zodResolver(createBatchSchema),
  });

  const onSubmit = (data: CreateBatchForm) => {
    writeContract({
      address: deployment.address as `0x${string}`,
      abi: abi, // Use the typed constant
      functionName: 'createBatch',
      args: [BigInt(data.quantity), data.ewaybillNo],
    });
  };

  const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConfirmed && receipt && actorAddress && userId) {
      const logs = parseEventLogs({
          abi: abi, // Use the typed constant
          logs: receipt.logs
      });

      const batchCreatedLog = logs.find(log => log.eventName === 'BatchCreated');
      const batchId = batchCreatedLog?.args?.batchId?.toString();

      if (batchId) {
        toast({ title: "On-Chain Success!", description: `Batch ${batchId} created successfully.` });
        
        const offChainData = getValues();
        
        const saveOffChainData = async () => {
          try {
            // ... (rest of the API call logic remains the same)
          } catch (err) {
            // ...
          }
        };

        saveOffChainData();
      } else {
          console.error("Could not find BatchCreated event in transaction logs.");
          toast({ title: "Parsing Error", description: "Could not get batch ID from transaction. Supabase not updated.", variant: "destructive"});
      }
    }
  }, [isConfirmed, receipt, actorAddress, userId, router, getValues, toast]);

  const isProcessing = isWalletPending || isConfirming;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
       < Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl">Create New Product Batch</CardTitle>
          <CardDescription>Fill in the details below to register a new batch on the blockchain and in the database.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name</Label>
                <Input id="productName" placeholder="e.g., Organic Apples" {...register("productName")} />
                {errors.productName && <p className="text-sm text-red-500">{errors.productName.message}</p>}
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" type="number" placeholder="e.g., 500" {...register("quantity")} />
                {errors.quantity && <p className="text-sm text-red-500">{errors.quantity.message}</p>}
              </div>
            </div>

            {/* E-way Bill Number */}
            <div className="space-y-2">
              <Label htmlFor="ewaybillNo">E-way Bill Number</Label>
              <Input id="ewaybillNo" placeholder="e.g., EWB1234567890" {...register("ewaybillNo")} />
              {errors.ewaybillNo && <p className="text-sm text-red-500">{errors.ewaybillNo.message}</p>}
            </div>

            {/* Cost (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="cost">Total Cost (Optional)</Label>
              <Input id="cost" type="number" placeholder="e.g., 25000" {...register("cost")} />
              {errors.cost && <p className="text-sm text-red-500">{errors.cost.message}</p>}
            </div>

            {/* Description (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" placeholder="Add any extra details about the batch..." {...register("description")} />
              {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isProcessing}>
              {isWalletPending ? 'Confirm in Wallet...' : isConfirming ? 'Processing On-Chain...' : 'Create Batch'}
            </Button>
          </form>

          {hash && (
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>Transaction Sent! Hash:</p>
              <p className="truncate block">{hash}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}