import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('Testing Supabase connection...')
  
  try {
    // Test 1: Check connection
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('Error:', error)
      return
    }
    
    console.log('✅ Connection successful!')
    console.log('Sample data:', data)
    
    // Test 2: Insert test product
    const testProduct = {
      user_id: 'test_user_' + Date.now(),
      name: 'Test Product',
      cost: 99.99,
      description: 'This is a test product',
      category: 'Test'
    }
    
    const { data: insertData, error: insertError } = await supabase
      .from('products')
      .insert([testProduct])
      .select()
    
    if (insertError) {
      console.error('Insert error:', insertError)
      return
    }
    
    console.log('✅ Insert successful!')
    console.log('Inserted:', insertData)
    
    // Test 3: Clean up - delete test product
    await supabase
      .from('products')
      .delete()
      .eq('user_id', testProduct.user_id)
    
    console.log('✅ Cleanup successful!')
    console.log('🎉 All tests passed!')
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testConnection()