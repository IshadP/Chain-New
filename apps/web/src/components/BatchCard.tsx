// FILE: apps/web/src/components/BatchCard.tsx

import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "wagmi";
import { TransferModal } from "./TransferModal";
import { ReceiveModal } from  "./ReceiveModal"; 

// Define a more specific type for the batch object
interface Batch {
  batch_id: string;
  product_name: string;
  category: string;
  cost: number;
  quantity: number;
  current_holder_wallet: string | null;
  intended_recipient_wallet: string | null; // Add this field
  manufacturer_id: string;
  [key: string]: any;
}

interface BatchCardProps {
  batch: Batch;
  userRole: string;
}

// Helper to format wallet addresses for display
const formatAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function BatchCard({ batch, userRole }: BatchCardProps) {
  const { address: connectedWallet, isConnected } = useAccount();

  const isHolder = isConnected && batch.current_holder_wallet?.toLowerCase() === connectedWallet?.toLowerCase();
  const isRecipient = isConnected && batch.intended_recipient_wallet?.toLowerCase() === connectedWallet?.toLowerCase();

  const getStatus = (): { text: string; color: "default" | "secondary" | "destructive" | "outline" } => {
    if (isRecipient) {
        return { text: "Pending Receipt", color: "secondary" };
    }
    if (batch.intended_recipient_wallet) {
        return { text: "In Transit", color: "outline" };
    }
    if (batch.current_holder_wallet) {
        return { text: "In Stock", color: "default" };
    }
    return { text: "Unknown", color: "destructive" };
  }

  const status = getStatus();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>{batch.product_name}</CardTitle>
                <CardDescription className="font-mono text-xs pt-1">{batch.batch_id}</CardDescription>
            </div>
            <Badge variant={status.color}>{status.text}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><strong>Category:</strong> {batch.categories}</p>
        <p><strong>Cost per item:</strong> ${batch.cost}</p>
        <p className="font-mono text-xs">
            <strong>Holder:</strong> {formatAddress(batch.current_holder_wallet)}
        </p>
         <p className="font-mono text-xs">
            <strong>Recipient:</strong> {formatAddress(batch.intended_recipient_wallet)}
        </p>
      </CardContent>
      <CardFooter>
        {isHolder && <TransferModal batchId={batch.batch_id} />}
        {isRecipient && <ReceiveModal batchId={batch.batch_id} />}
      </CardFooter>
    </Card>
  );
}