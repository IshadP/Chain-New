import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "wagmi";
import { TransferModal } from "./TransferModal";
import { ReceiveModal } from "./ReceiveModal";

// Define a more specific type for the batch object from your database
interface Batch {
  batch_id: string;
  product_name: string;
  status: 'Received' | 'InTransit';
  current_holder_wallet: string | null;
  intended_recipient_wallet: string | null;
  categories: string;
  cost: number;
  [key: string]: any;
}

interface BatchCardProps {
  batch: Batch;
  userRole: string;
}

// Helper function to format wallet addresses for better readability
const formatAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function BatchCard({ batch, userRole }: BatchCardProps) {
  const { address: connectedWallet, isConnected } = useAccount();

  // Condition to show the "Transfer" button: The user must be the current holder.
  const canTransfer = isConnected && batch.current_holder_wallet?.toLowerCase() === connectedWallet?.toLowerCase();
  
  // Condition to show the "Receive" button: The user must be the intended recipient.
  const canReceive = isConnected && batch.intended_recipient_wallet?.toLowerCase() === connectedWallet?.toLowerCase();

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>{batch.product_name}</CardTitle>
                <CardDescription className="font-mono text-xs pt-1 break-all">{batch.batch_id}</CardDescription>
            </div>
            <Badge variant={batch.status === 'InTransit' ? 'outline' : 'default'} className="ml-2 flex-shrink-0">
              {batch.status || 'Unknown'}
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-gray-700">
        <div>
            <strong>Category:</strong> <span className="text-gray-900">{batch.categories}</span>
        </div>
        <div>
            <strong>Cost per item:</strong> <span className="text-gray-900">${batch.cost}</span>
        </div>
        <div className="pt-2">
            <p className="font-mono text-xs">
                <strong>Holder:</strong> {formatAddress(batch.current_holder_wallet)}
            </p>
            <p className="font-mono text-xs">
                <strong>Recipient:</strong> {formatAddress(batch.intended_recipient_wallet)}
            </p>
        </div>
      </CardContent>
      <CardFooter>
        {/* The correct button will appear based on the user's relationship to the batch */}
        {canTransfer && <TransferModal batchId={batch.batch_id} />}
        {canReceive && <ReceiveModal batchId={batch.batch_id} />}
      </CardFooter>
    </Card>
  );
}
