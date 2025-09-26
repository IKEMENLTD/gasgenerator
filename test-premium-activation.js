// Test script for premium activation
// Run with: node test-premium-activation.js

const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

// Test the premium activation logic
async function testPremiumActivation() {
  console.log('🧪 Testing Premium Activation')

  // Check environment variables
  console.log('\n📋 Environment Variables:')
  console.log('PREMIUM_MASTER_CODE_1:', process.env.PREMIUM_MASTER_CODE_1?.length || 'NOT SET')
  console.log('PREMIUM_MASTER_CODE_2:', process.env.PREMIUM_MASTER_CODE_2?.length || 'NOT SET')
  console.log('PREMIUM_MASTER_CODE_3:', process.env.PREMIUM_MASTER_CODE_3?.length || 'NOT SET')
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET')
  console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY?.substring(0, 20) + '...' || 'NOT SET')

  // Test master codes
  const MASTER_CODES = [
    process.env.PREMIUM_MASTER_CODE_1,
    process.env.PREMIUM_MASTER_CODE_2,
    process.env.PREMIUM_MASTER_CODE_3
  ].filter(Boolean)

  console.log('\n🔑 Master Codes Loaded:', MASTER_CODES.length)

  // Test patterns
  const SPECIAL_PATTERNS = [
    /^PREMIUM-ACTIVATE-\d{4}-[A-Z0-9]{32}$/,
    /^TM-SPECIAL-[A-Z0-9]{48}$/,
  ]

  console.log('\n🎯 Testing Patterns:')

  // Test sample codes
  const testCodes = [
    'PREMIUM-ACTIVATE-2024-' + 'A'.repeat(32), // Should match pattern 1
    'TM-SPECIAL-' + 'B'.repeat(48), // Should match pattern 2
    process.env.PREMIUM_MASTER_CODE_1, // Should match master code
    'INVALID_CODE_123' // Should not match
  ]

  for (const code of testCodes) {
    if (!code) continue

    console.log(`\nTesting code: ${code.substring(0, 20)}...`)

    // Master code check
    const isMasterCode = MASTER_CODES.includes(code)
    console.log(`  Master code: ${isMasterCode ? '✅' : '❌'}`)

    // Pattern check
    const patternMatch = SPECIAL_PATTERNS.find(pattern => pattern.test(code))
    console.log(`  Pattern match: ${patternMatch ? '✅ ' + patternMatch.toString() : '❌'}`)
  }

  // Test database connection
  console.log('\n🗄️ Testing Database Connection:')

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (error) {
      console.log('❌ Database connection failed:', error.message)
    } else {
      console.log('✅ Database connection successful')
    }
  } catch (err) {
    console.log('❌ Database connection error:', err.message)
  }

  console.log('\n✅ Test completed!')
}

testPremiumActivation().catch(console.error)