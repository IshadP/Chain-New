import { createClient } from '@supabase/supabase-js';
import { supabase } from "./supabase";

/**
 * Creates a Supabase client with admin privileges (service_role key).
 * This client can bypass Row Level Security (RLS) and should ONLY be used
 * in trusted server-side environments (like API routes and server actions).
 */
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) {
        throw new Error('Supabase URL or service key is missing from environment variables.');
    }
    return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * A helper function to sanitize string inputs by trimming whitespace
 * and removing any newline characters before database operations.
 */
const cleanString = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.trim().replace(/(\r\n|\n|\r)/gm, "");
}

// ===============================================================
// USER PROFILE FUNCTIONS
// ===============================================================

/**
 * Creates or updates a user's profile in the `profiles` table.
 * This is a critical link between a Clerk user ID and their wallet address.
 * Uses the admin client to bypass RLS, as it's called from a trusted server action.
 */
export const upsertUserProfile = async (profile: { id: string; role: 'manufacturer' | 'distributor' | 'retailer'; wallet_address: string; }) => {
    try {
        const cleanId = cleanString(profile.id);
        const cleanWallet = cleanString(profile.wallet_address);
        if (!cleanId || !profile.role || !cleanWallet) {
            throw new Error("User ID, role, and wallet address are required.");
        }
        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin.from('profiles').upsert({ id: cleanId, role: profile.role, wallet_address: cleanWallet }).select().single();
        if (error) throw new Error(`Database error: ${error.message}`);
        if (!data) throw new Error('No data returned from database after upsert');
        return data;
      } catch (error) {
        console.error("Error in upsertUserProfile:", error);
        throw error;
      }
};

/**
 * Fetches all user profiles. Used by the admin panel.
 */
export const getAllProfiles = async () => {
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);
        return data || [];
      } catch (error) {
        console.error('Error in getAllProfiles:', error);
        return [];
      }
};

/**
 * Fetches potential recipients (distributors and retailers) for a transfer,
 * excluding the current user.
 */
export const getPotentialRecipients = async (currentUserId: string) => {
    try {
        const cleanedCurrentUserId = cleanString(currentUserId);
        if (!cleanedCurrentUserId) throw new Error("Current user ID is required.");
        const { data, error } = await supabase.from('profiles').select('id, wallet_address, role').not('id', 'eq', cleanedCurrentUserId).in('role', ['distributor', 'retailer']);
        if (error) throw new Error(`Failed to fetch recipients: ${error.message}`);
        return data || [];
    } catch (error) {
        console.error('Error in getPotentialRecipients:', error);
        return [];
    }
};

// ===============================================================
// INVENTORY (BATCHES) FUNCTIONS
// ===============================================================

/**
 * Creates a new inventory item. Called from a secure API route.
 * Uses the admin client to bypass RLS.
 */
export const createInventoryItem = async (item: any) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .insert({
        batch_id: item.batch_id,
        product_name: item.product_name,
        manufacturer_id: item.manufacturer_id,
        manufacturer_wallet: item.manufacturer_wallet,
        current_holder_wallet: item.current_holder_wallet,
        categories: item.category,
        internal_batch_no: item.internal_batch_no,
        description: item.description,
        cost: item.cost,
        quantity: item.quantity,
        status: 'Received',
        created_at: item.created_at,
      })
      .select().single();
    if (error) {
      if (error.code === '23505') throw new Error(`Batch ID '${item.batch_id}' already exists`);
      throw new Error(`Database error: ${error.message}`);
    }
    if (!data) throw new Error('No data returned from database after insert');
    return data;
  } catch (error) {
    console.error("Error in createInventoryItem:", error);
    throw error;
  }
};

/**
 * The unified, wallet-centric function to fetch all batches relevant to a user.
 * It checks if the user's wallet is the creator, current holder, or intended recipient.
 * This function relies on the RLS policy allowing any authenticated user to read.
 */
export const getBatchesForUser = async (walletAddress: string) => {
    try {
        const cleanWallet = cleanString(walletAddress);
        if (!cleanWallet) return [];
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .or(`manufacturer_wallet.eq.${cleanWallet},current_holder_wallet.eq.${cleanWallet},intended_recipient_wallet.eq.${cleanWallet}`)
            .order('created_at', { ascending: false });
        if (error) { throw new Error(`Failed to fetch user batches: ${error.message}`); }
        return data || [];
    } catch (error) {
        console.error('Error in getBatchesForUser:', error);
        throw error;
    }
};

/**
 * Updates a batch's state to "InTransit" in the database.
 * Uses the admin client as it's called from a secure API route.
 */
export const transferBatchOffChain = async (batchId: string, recipientWallet: string) => {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin.from('inventory').update({ current_holder_wallet: null, intended_recipient_wallet: cleanString(recipientWallet), status: 'InTransit' }).eq('batch_id', cleanString(batchId)).select().single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error in transferBatchOffChain:", error);
        throw error;
    }
};

/**
 * Completes a transfer by updating a batch's state to "Received".
 * Uses the admin client as it's called from a secure API route.
 */
export const receiveBatchOffChain = async (batchId: string, receiverWallet: string) => {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin.from('inventory').update({ current_holder_wallet: cleanString(receiverWallet), intended_recipient_wallet: null, status: 'Received' }).eq('batch_id', cleanString(batchId)).select().single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error in receiveBatchOffChain:", error);
        throw error;
    }
};

