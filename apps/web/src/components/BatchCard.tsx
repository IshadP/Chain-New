import React from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Clock, CheckCircle } from 'lucide-react';
import { TransferModal } from './TransferModal';
import { ReceiveModal } from './ReceiveModal';

interface Batch {
  batch_id: string;
  product_name: string;
  manufacturer_wallet: string;
  current_holder_wallet: string | null;
  intended_recipient_wallet: string | null;
  status: 'Received' | 'InTransit';
  cost: number;
  quantity: number;
  categories: string;
  description?: string;
  created_at: string;
  [key: string]: any;
}

interface BatchCardProps {
  batch: Batch;
  userRole: string;
}

export function BatchCard({ batch, userRole }: BatchCardProps) {
  const { address } = useAccount();

  // Determine user's relationship to this batch
  const isCurrentHolder = batch.current_holder_wallet === address;
  const isIntendedRecipient = batch.intended_recipient_wallet === address;
  const isCreator = batch.manufacturer_wallet === address;

  const getStatusBadge = () => {
    switch (batch.status) {
      case 'Received':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Received</Badge>;
      case 'InTransit':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />In Transit</Badge>;
      default:
        return <Badge variant="secondary">{batch.status}</Badge>;
    }
  };

  const getRelationshipBadge = () => {
    if (isCurrentHolder) return <Badge variant="default">Current Holder</Badge>;
    if (isIntendedRecipient) return <Badge variant="outline">Incoming</Badge>;
    if (isCreator) return <Badge variant="secondary">Created by You</Badge>;
    return null;
  };

  const canTransfer = isCurrentHolder && batch.status === 'Received';
  const canReceive = isIntendedRecipient && batch.status === 'InTransit';

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <Package className="w-5 h-5 mr-2" />
            {batch.product_name}
          </CardTitle>
          {getRelationshipBadge()}
        </div>
        <div className="flex gap-2">
          {getStatusBadge()}
          <Badge variant="outline">{batch.categories}</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium">Quantity:</p>
            <p className="text-gray-600">{batch.quantity}</p>
          </div>
          <div>
            <p className="font-medium">Cost per item:</p>
            <p className="text-gray-600">${batch.cost}</p>
          </div>
        </div>

        {batch.description && (
          <div>
            <p className="font-medium text-sm">Description:</p>
            <p className="text-gray-600 text-sm">{batch.description}</p>
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>Batch ID: {batch.batch_id}</p>
          <p>Created: {new Date(batch.created_at).toLocaleDateString()}</p>
        </div>

        {/* Action Section */}
        <div className="pt-3 border-t flex gap-2">
          {canTransfer && (
            <TransferModal batchId={batch.batch_id} />
          )}
          {canReceive && (
            <ReceiveModal batchId={batch.batch_id} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}