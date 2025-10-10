import { BlockchainDataTable } from "@/components/BlockchainDataTable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

export default function BlockchainViewPage() {
  return (
    <div className="container mx-auto p-4 flex gap-2 flex-col">
      <Link href="/dashboard" className="">
              <Button variant="outline">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
      </Link>
      <Card className="">
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