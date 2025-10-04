import { BlockchainDataTable } from "@/components/BlockchainDataTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function BlockchainViewPage() {
  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>On-Chain Data</CardTitle>
          <CardDescription>
            This page displays real-time data directly from the blockchain.
            It will remain available even if the centralized database is down,
            showing all batches you currently hold or are intended to receive.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BlockchainDataTable />
        </CardContent>
      </Card>
    </div>
  );
}