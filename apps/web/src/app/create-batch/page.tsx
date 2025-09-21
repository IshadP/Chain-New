'use client'

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { Package, QrCode, AlertCircle } from 'lucide-react';
import SupplyChainArtifact from '../../../lib/contracts/contracts/SupplyChain.sol/SupplyChain.json';
import deployment from '../../../lib/deployment.json';

// Zod schema remains the same, as we still need to collect this data.
const formSchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  cost: z.coerce.number().positive('Cost must be a positive number'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  internalBatchNo: z.string().min(1, 'Internal batch name is required'),
  quantity: z.coerce.number().int().positive(), 
  currentLocation: z.string().min(1, 'Manufacturing location is required'),
  ewaybillNo: z.string().min(1, 'E-way bill is required'),
});

type FormData = z.infer<typeof formSchema>;

// ... (helper components and constants remain the same)
interface BatchCreationState {
  qrCodeUrl: string;
  batchId: `0x${string}` | null;
}
const categories = ['Electronics', 'Clothing', 'Food & Beverages', 'Home & Garden', 'Health & Beauty', 'Sports & Outdoors', 'Books & Media', 'Automotive', 'Industrial', 'Other'];
const abi = SupplyChainArtifact.abi;
const contractAddress = deployment.address as `0x${string}`;

function uuidToBytes16(uuid: string): `0x${string}` {
  return `0x${uuid.replace(/-/g, '')}`;
}

export default function CreateBatchPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { isConnected } = useAccount();
  const userRole = user?.publicMetadata?.role as string;

  const { data: hash, writeContract, isPending: isWalletPending } = useWriteContract();
  const { isSuccess: isConfirmed, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const [state, setState] = useState<BatchCreationState>({ qrCodeUrl: '', batchId: null });

  const form = useForm<FormData>({ resolver: zodResolver(formSchema), defaultValues: { /* ... */ } });
  const { register, handleSubmit, control, formState: { errors } } = form;

  // The saveOffChainData function is updated to remove the fields now stored on-chain.
  const saveOffChainData = async (batchId: `0x${string}`, data: FormData) => {
    try {
      const response = await fetch('/api/inventory/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchId,
          product_name: data.productName,
          cost: data.cost,
          description: data.description,
          category: data.category,
          internal_batch_no: data.internalBatchNo,
          quantity: data.quantity,
          status: 'Received',
          created_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to save');
      toast({ title: 'Database Success!', description: 'Off-chain details saved.' });
    } catch (error) {
      toast({ title: "Database Save Failed", description: `CRITICAL: The batch is on-chain, but saving failed. Batch ID: ${batchId}. Error: ${error instanceof Error ? error.message : 'Unknown'}`, variant: "destructive", duration: 15000 });
    }
  };

  const onFormSubmit = (data: FormData) => {
    if (!isConnected || !user || userRole?.toLowerCase() !== 'manufacturer') {
      toast({ title: 'Access Denied', variant: 'destructive' });
      return;
    }
    const newUuid = uuidv4();
    const batchIdAsBytes16 = uuidToBytes16(newUuid);
    setState(prev => ({ ...prev, batchId: batchIdAsBytes16 }));

    /**
     * UPDATED
     * The on-chain call now includes the ewaybillNo and currentLocation.
     */
    writeContract({
      address: contractAddress,
      abi: abi,
      functionName: 'createBatch',
      args: [ 
        batchIdAsBytes16,
        data.ewaybillNo,
        data.currentLocation
      ],
    });
  };

  useEffect(() => {
    if (isConfirmed && state.batchId) {
      const generateQrAndSave = async () => {
        const qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/track/${state.batchId}`);
        setState(prev => ({ ...prev, qrCodeUrl: qrDataUrl }));
        toast({ title: 'Batch Created On-Chain!', description: `On-chain record created successfully.` });
        await saveOffChainData(state.batchId, form.getValues());
      };
      generateQrAndSave();
    }
  }, [isConfirmed, state.batchId]);

  // The rest of the UI remains exactly the same.
  // ...
  if (userRole?.toLowerCase() !== 'manufacturer') { return ( <div className="container mx-auto p-8 text-center"> <Alert variant="destructive"><AlertCircle className="h-4 w-4" />Access Denied: Only manufacturers can create batches.</Alert> </div> ); }
  const isLoading = isWalletPending || isConfirming;
  const isCreated = isConfirmed && !!state.qrCodeUrl;
  return (
    <div className="container mx-auto p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center space-x-3 mb-8">
          <Package className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Create New Product Batch</h1>
            <p className="text-gray-600">Register a new batch on-chain and save descriptive details off-chain.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader><CardTitle>Batch Details</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">On-Chain Information</h3>
                  <div>
                      <Label htmlFor="ewaybillNo">E-Way Bill Number *</Label>
                      <Input id="ewaybillNo" {...register("ewaybillNo")} disabled={isCreated} className={errors.ewaybillNo ? 'border-red-500' : ''}/>
                      {errors.ewaybillNo && <p className="text-sm text-red-500 mt-1">{errors.ewaybillNo.message}</p>}
                    </div>
                     <div>
                      <Label htmlFor="currentLocation">Manufacturing Location *</Label>
                      <Input id="currentLocation" {...register("currentLocation")} disabled={isCreated} className={errors.currentLocation ? 'border-red-500' : ''}/>
                      {errors.currentLocation && <p className="text-sm text-red-500 mt-1">{errors.currentLocation.message}</p>}
                    </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Off-Chain Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="productName">Product Name *</Label>
                      <Input id="productName" {...register("productName")} disabled={isCreated} className={errors.productName ? 'border-red-500' : ''}/>
                      {errors.productName && <p className="text-sm text-red-500 mt-1">{errors.productName.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="cost">Cost (per item) *</Label>
                      <Input id="cost" type="number" step="0.01" {...register("cost")} disabled={isCreated} className={errors.cost ? 'border-red-500' : ''}/>
                      {errors.cost && <p className="text-sm text-red-500 mt-1">{errors.cost.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="quantity">Quantity *</Label>
                        <Input id="quantity" type="number" {...register("quantity")} disabled={isCreated} className={errors.quantity ? 'border-red-500' : ''}/>
                        {errors.quantity && <p className="text-sm text-red-500 mt-1">{errors.quantity.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Controller control={control} name="category" render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value} disabled={isCreated}>
                            <SelectTrigger className={errors.category ? 'border-red-500' : ''}><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                      )}/>
                      {errors.category && <p className="text-sm text-red-500 mt-1">{errors.category.message}</p>}
                    </div>
                   </div>
                  <div>
                    <Label htmlFor="internalBatchNo">Internal Batch No. *</Label>
                    <Input id="internalBatchNo" {...register("internalBatchNo")} disabled={isCreated} className={errors.internalBatchNo ? 'border-red-500' : ''}/>
                    {errors.internalBatchNo && <p className="text-sm text-red-500 mt-1">{errors.internalBatchNo.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" {...register("description")} disabled={isCreated}/>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || isCreated}>
                    {isLoading ? 'Processing On-Chain...' : 'Create Batch'}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center"><QrCode className="mr-2"/>QR Code & On-Chain Info</CardTitle></CardHeader>
            <CardContent className="text-center min-h-[300px] flex flex-col justify-center items-center">
              {!isCreated ? (
                <div className="text-gray-500">
                  <QrCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>QR code for on-chain tracking will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4 w-full">
                  <div className="bg-white p-2 rounded-lg inline-block shadow-md border mx-auto">
                    <Image src={state.qrCodeUrl} alt="Batch QR Code" width={180} height={180} />
                  </div>
                  <div className="space-y-2 text-left text-xs text-gray-600 break-all">
                    <p><strong>On-Chain Batch ID:</strong> {state.batchId}</p>
                    <p><strong>Transaction Hash:</strong> {hash}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

