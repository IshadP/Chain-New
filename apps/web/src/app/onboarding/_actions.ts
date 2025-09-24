"use server";

import { clerkClient, auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { upsertUserProfile } from "@/lib/dataservice"; 

type Role = "manufacturer" | "distributor" | "retailer";

interface UpdateUserParams {
  role: Role;
  walletAddress: string;
  currentLocation: string
}

/**
 * This server action is called when a user completes the onboarding form.
 * It performs two critical tasks:
 * 1. Updates the user's public metadata in Clerk to store their role and wallet.
 * 2. Creates a corresponding record in the local `profiles` table to link the Clerk ID to the wallet.
 */
export async function updateUserRoleAndProfile({ role, walletAddress, currentLocation }: UpdateUserParams) {
  const { userId } =await auth();
  if (!userId) {
    throw new Error("You must be signed in to update your profile.");
  }

  try {
    const clerk = await clerkClient(); 
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: role,
        wallet_address: walletAddress,
        currentLocation: currentLocation,
        onboardingComplete: true
      },
    });

    await upsertUserProfile({
        id: userId,
        role: role,
        wallet_address: walletAddress,
        currentLocation: currentLocation,
    });

    revalidatePath("/", "layout");

    return { success: true };

  } catch (error) {
    console.error("Failed to update user role and profile:", error);
    throw new Error("Could not update profile. Please try again.");
  }
}
