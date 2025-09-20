// FILE: apps/web/src/app/onboarding/_actions.ts

"use server";

import { auth, createClerkClient } from "@clerk/nextjs/server";
import { upsertUserProfile } from "@/lib/dataservice";

/**
 * This server action now performs two tasks:
 * 1. Updates the user's role in their Clerk metadata.
 * 2. Creates or updates their profile in the Supabase `profiles` table
 * with their role and wallet address.
 * 
 */


export async function updateUserRoleAndProfile({
  role,
  walletAddress,
}: {
  role: "manufacturer" |"distributor" | "retailer";
  walletAddress: string;
}) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not found");
  }

  const clerkClient = await createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
    });

  // 1. Update Clerk metadata
  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      role: role,
      onboardingComplete: true,
    },
  });

  // 2. Upsert profile in Supabase
  await upsertUserProfile({
    id: userId,
    role: role,
    wallet_address: walletAddress,
  });

  return { success: true };
}