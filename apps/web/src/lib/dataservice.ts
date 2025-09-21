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
 * UPDATED: Fetches potential recipients based on the current user's role and smart contract transfer rules:
 * - Manufacturer → Distributor only
 * - Distributor → Distributor OR Retailer
 * - Retailer → Retailer only
 */
export const getPotentialRecipients = async (currentUserId: string, currentUserRole: 'manufacturer' | 'distributor' | 'retailer') => {
    try {
        const cleanedCurrentUserId = cleanString(currentUserId);
        if (!cleanedCurrentUserId) throw new Error("Current user ID is required.");
        if (!currentUserRole) throw new Error("Current user role is required.");

        let allowedRoles: string[] = [];
        
        // Define transfer rules based on smart contract logic
        switch (currentUserRole) {
            case 'manufacturer':
                // Manufacturers can only transfer to distributors
                allowedRoles = ['distributor'];
                break;
            case 'distributor':
                // Distributors can transfer to other distributors or retailers
                allowedRoles = ['distributor', 'retailer'];
                break;
            case 'retailer':
                // Retailers can transfer to other retailers
                allowedRoles = ['retailer'];
                break;
            default:
                throw new Error(`Invalid user role: ${currentUserRole}`);
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('id, wallet_address, role')
            .not('id', 'eq', cleanedCurrentUserId)
            .in('role', allowedRoles);
            
        if (error) throw new Error(`Failed to fetch recipients: ${error.message}`);
        return data || [];
    } catch (error) {
        console.error('Error in getPotentialRecipients:', error);
        return [];
    }
};

/**
 * NEW: Helper function to validate if a transfer is allowed based on roles
 * This mirrors the smart contract's canTransferTo function
 */
export const canTransferTo = (fromRole: string, toRole: string): boolean => {
    if (fromRole === 'manufacturer') {
        return toRole === 'distributor';
    } else if (fromRole === 'distributor') {
        return toRole === 'distributor' || toRole === 'retailer';
    } else if (fromRole === 'retailer') {
        return toRole === 'retailer';
    }
    return false;
};

/**
 * NEW: Get user profile by wallet address (useful for transfer validation)
 */
export const getUserProfileByWallet = async (walletAddress: string) => {
    try {
        const cleanWallet = cleanString(walletAddress);
        if (!cleanWallet) throw new Error("Wallet address is required.");
        
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('wallet_address', cleanWallet)
            .single();
            
        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found
                return null;
            }
            throw new Error(`Failed to fetch user profile: ${error.message}`);
        }
        
        return data;
    } catch (error) {
        console.error('Error in getUserProfileByWallet:', error);
        return null;
    }
};

/**
 * NEW: Validate transfer before executing (for additional security)
 */
export const validateTransfer = async (senderWallet: string, recipientWallet: string): Promise<{ valid: boolean; error?: string }> => {
    try {
        const senderProfile = await getUserProfileByWallet(senderWallet);
        const recipientProfile = await getUserProfileByWallet(recipientWallet);
        
        if (!senderProfile) {
            return { valid: false, error: "Sender profile not found" };
        }
        
        if (!recipientProfile) {
            return { valid: false, error: "Recipient profile not found" };
        }
        
        if (senderWallet === recipientWallet) {
            return { valid: false, error: "Cannot transfer to yourself" };
        }
        
        const isAllowed = canTransferTo(senderProfile.role, recipientProfile.role);
        
        if (!isAllowed) {
            return { 
                valid: false, 
                error: `Transfer not allowed: ${senderProfile.role} cannot transfer to ${recipientProfile.role}` 
            };
        }
        
        return { valid: true };
    } catch (error) {
        console.error('Error in validateTransfer:', error);
        return { valid: false, error: 'Transfer validation failed' };
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
 * UPDATED: Updates a batch's state to "InTransit" with additional validation
 */
export const transferBatchOffChain = async (batchId: string, recipientWallet: string, senderWallet: string) => {
    try {
        // Validate the transfer before executing
        const validation = await validateTransfer(senderWallet, recipientWallet);
        if (!validation.valid) {
            throw new Error(`Transfer validation failed: ${validation.error}`);
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .from('inventory')
            .update({ 
                current_holder_wallet: null, 
                intended_recipient_wallet: cleanString(recipientWallet), 
                status: 'InTransit',
                updated_at: new Date().toISOString()
            })
            .eq('batch_id', cleanString(batchId))
            .eq('current_holder_wallet', cleanString(senderWallet)) // Additional security check
            .select().single();
            
        if (error) throw error;
        if (!data) throw new Error('No batch found or you are not the current holder');
        return data;
    } catch (error) {
        console.error("Error in transferBatchOffChain:", error);
        throw error;
    }
};

/**
 * UPDATED: Completes a transfer by updating a batch's state to "Received" with additional validation
 */
export const receiveBatchOffChain = async (batchId: string, receiverWallet: string) => {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .from('inventory')
            .update({ 
                current_holder_wallet: cleanString(receiverWallet), 
                intended_recipient_wallet: null, 
                status: 'Received',
                updated_at: new Date().toISOString()
            })
            .eq('batch_id', cleanString(batchId))
            .eq('intended_recipient_wallet', cleanString(receiverWallet)) // Additional security check
            .select().single();
            
        if (error) throw error;
        if (!data) throw new Error('No batch found or you are not the intended recipient');
        return data;
    } catch (error) {
        console.error("Error in receiveBatchOffChain:", error);
        throw error;
    }
};

/**
 * NEW: Get batches that can be transferred by a specific user (based on their role and current holdings)
 */
export const getTransferableBatchesForUser = async (walletAddress: string, userRole: 'manufacturer' | 'distributor' | 'retailer') => {
    try {
        const cleanWallet = cleanString(walletAddress);
        if (!cleanWallet) return [];
        
        // Only get batches where the user is the current holder and status is 'Received'
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('current_holder_wallet', cleanWallet)
            .eq('status', 'Received')
            .order('created_at', { ascending: false });
            
        if (error) { 
            throw new Error(`Failed to fetch transferable batches: ${error.message}`); 
        }
        
        return data || [];
    } catch (error) {
        console.error('Error in getTransferableBatchesForUser:', error);
        return [];
    }
};

/**
 * NEW: Get batches that are in transit to a specific user
 */
export const getIncomingBatchesForUser = async (walletAddress: string) => {
    try {
        const cleanWallet = cleanString(walletAddress);
        if (!cleanWallet) return [];
        
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('intended_recipient_wallet', cleanWallet)
            .eq('status', 'InTransit')
            .order('created_at', { ascending: false });
            
        if (error) { 
            throw new Error(`Failed to fetch incoming batches: ${error.message}`); 
        }
        
        return data || [];
    } catch (error) {
        console.error('Error in getIncomingBatchesForUser:', error);
        return [];
    }
};