// FILE: apps/web/src/lib/dataservice.ts

import { supabase } from "./supabase"; // <-- This now correctly imports the reliable client

/**
 * This file serves as the data access layer for the application.
 * It contains all the functions that interact with the Supabase database.
 */

// ==================================================================
// INVENTORY (BATCHES) FUNCTIONS
// ==================================================================

export const createInventoryItem = async (item: {
  batch_id: string;
  product_name: string;
  manufacturer_id: string;
  current_holder_wallet: string;
  eway_bill_no: string;
  description?: string;
  cost?: number;
}) => {
  const { data, error } = await supabase.from('inventory').insert(item).select().single();
  if (error) {
    console.error("Error creating inventory item:", error);
    return null;
  }
  return data;
};

export const getAllBatches = async () => {
  const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching all batches:', error);
    return [];
  }
  return data;
};

// ==================================================================
// PROFILE FUNCTIONS
// ==================================================================

export const upsertUserProfile = async (profile: {
  id: string; // This is the Clerk user ID
  role: string;
  wallet_address: string;
  display_name?: string;
}) => {
  const { data, error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' }).select().single();
  if (error) {
    console.error('Error upserting user profile:', error);
    return null;
  }
  return data;
};

export const getRecipients = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, wallet_address')
    .in('role', ['distributor', 'retailer']);

  if (error) {
    console.error('Error fetching recipients:', error);
    return [];
  }
  return data;
};

export const getAllProfiles = async () => {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error('Error fetching all profiles:', error);
    return [];
  }
  return data;
};


// ==================================================================
// BATCH HISTORY FUNCTIONS
// ==================================================================

export const addHistoryEvent = async (event: {
  batch_id: string;
  event_type: string;
  actor_address: string;
  details?: string;
}) => {
  const { data, error } = await supabase.from('batch_history').insert(event);
  if (error) {
    console.error('Error adding history event:', error);
    return false;
  }
  return true;
};

export const getBatchHistory = async (batchId: string) => {
  const { data, error } = await supabase
    .from('batch_history')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`Error fetching history for batch ${batchId}:`, error);
    return [];
  }
  return data;
};