/**
 * Test script for Supabase Edge Function PDF processing
 * 
 * This script tests the new Edge Function implementation and compares
 * it with the existing local processing system.
 */

const fs = require('fs')
const path = require('path')

// Configuration
const config = {
  baseUrl: 'http://localhost:3000',
  edgeHealthEndpoint: '/api/process-pdf-edge',
  processEndpoint: '/api/process-pdf-edge',
  testModuleId: '16', // Use the High Visibility Clothing module
  testPdfPath: './sample-local-pdf.pdf', // Adjust path as needed
}

console.log('🧪 Starting Supabase Edge Function PDF Processing Tests')
console.log('=' .repeat(60))

async function runTests() {
  try {
    // Test 1: Health Check
    console.log('\n📊 Test 1: Health Check')
    await testHealthCheck()

    // Test 2: Edge Function Processing
    console.log('\n🚀 Test 2: Edge Function Processing')
    const edgeResult = await testEdgeFunctionProcessing()

    // Test 3: Local Processing (for comparison)
    console.log('\n🏠 Test 3: Local Processing (Comparison)')
    const localResult = await testLocalProcessing()

    // Test 4: Performance Comparison
    console.log('\n⚡ Test 4: Performance Comparison')
    compareResults(edgeResult, localResult)

    console.log('\n✅ All tests completed!')

  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
    process.exit(1)
  }
}

async function testHealthCheck() {
  try {
    console.log('🏥 Checking Edge Function health...')
    
    const response = await fetch(`${config.baseUrl}${config.edgeHealthEndpoint}`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`)
    }

    const health = await response.json()
    console.log('📊 Health Check Results:')
    console.log(`   Status: ${health.status}`)
    console.log(`   Edge Function: ${health.edgeFunction?.available ? '✅ Available' : '❌ Unavailable'}`)
    console.log(`   Latency: ${health.edgeFunction?.latency || 'N/A'}ms`)
    console.log(`   Local Processor: ${health.localProcessor?.available ? '✅ Available' : '❌ Unavailable'}`)

    if (!health.edgeFunction?.available) {
      console.warn('⚠️  Edge Function is not available, some tests may fail')
    }

    return health

  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    throw error
  }
}

async function testEdgeFunctionProcessing() {
  try {
    console.log('🚀 Testing Edge Function processing...')
    
    const startTime = Date.now()
    
    const response = await fetch(`${config.baseUrl}${config.processEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        moduleId: config.testModuleId,
        useEdgeFunction: true,
        replaceExisting: false, // Don't replace existing slides for testing
        processorConfig: {
          maxPages: 5, // Test with fewer pages
          enableImages: true,
          enableAI: true,
        }
      })
    })

    const result = await response.json()
    const endTime = Date.now()
    const duration = endTime - startTime

    console.log('📊 Edge Function Results:')
    console.log(`   Success: ${result.success ? '✅' : '❌'}`)
    console.log(`   Method: ${result.method || 'unknown'}`)
    console.log(`   Slides Created: ${result.slidesCreated || 0}`)
    console.log(`   Total Pages: ${result.totalPages || 'unknown'}`)
    console.log(`   Pages Processed: ${result.pagesProcessed || 0}`)
    console.log(`   Duration: ${duration}ms`)
    console.log(`   Server Time: ${result.timeElapsed || 'unknown'}ms`)

    if (!result.success) {
      console.error(`   Error: ${result.error}`)
    }

    return {
      success: result.success,
      method: 'edge-function',
      slidesCreated: result.slidesCreated || 0,
      totalPages: result.totalPages || 0,
      pagesProcessed: result.pagesProcessed || 0,
      clientDuration: duration,
      serverDuration: result.timeElapsed || 0,
      error: result.error,
    }

  } catch (error) {
    console.error('❌ Edge Function test failed:', error.message)
    return {
      success: false,
      method: 'edge-function',
      error: error.message,
      clientDuration: 0,
      serverDuration: 0,
    }
  }
}

async function testLocalProcessing() {
  try {
    console.log('🏠 Testing Local processing...')
    
    const startTime = Date.now()
    
    const response = await fetch(`${config.baseUrl}${config.processEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        moduleId: config.testModuleId,
        useEdgeFunction: false, // Force local processing
        replaceExisting: false, // Don't replace existing slides for testing
        processorConfig: {
          maxPages: 5, // Test with fewer pages
          enableImages: true,
          enableAI: true,
        }
      })
    })

    const result = await response.json()
    const endTime = Date.now()
    const duration = endTime - startTime

    console.log('📊 Local Processing Results:')
    console.log(`   Success: ${result.success ? '✅' : '❌'}`)
    console.log(`   Method: ${result.method || 'unknown'}`)
    console.log(`   Slides Created: ${result.slidesCreated || 0}`)
    console.log(`   Total Pages: ${result.totalPages || 'unknown'}`)
    console.log(`   Pages Processed: ${result.pagesProcessed || 0}`)
    console.log(`   Duration: ${duration}ms`)
    console.log(`   Server Time: ${result.timeElapsed || 'unknown'}ms`)

    if (!result.success) {
      console.error(`   Error: ${result.error}`)
    }

    return {
      success: result.success,
      method: 'local-processing',
      slidesCreated: result.slidesCreated || 0,
      totalPages: result.totalPages || 0,
      pagesProcessed: result.pagesProcessed || 0,
      clientDuration: duration,
      serverDuration: result.timeElapsed || 0,
      error: result.error,
    }

  } catch (error) {
    console.error('❌ Local processing test failed:', error.message)
    return {
      success: false,
      method: 'local-processing',
      error: error.message,
      clientDuration: 0,
      serverDuration: 0,
    }
  }
}

function compareResults(edgeResult, localResult) {
  console.log('📊 Performance Comparison:')
  console.log('=' .repeat(50))
  
  // Success Rate
  console.log(`Success Rate:`)
  console.log(`   Edge Function: ${edgeResult.success ? '✅' : '❌'} ${edgeResult.success ? 'Success' : 'Failed'}`)
  console.log(`   Local Processing: ${localResult.success ? '✅' : '❌'} ${localResult.success ? 'Success' : 'Failed'}`)
  
  if (edgeResult.success && localResult.success) {
    // Performance Metrics
    console.log(`\nProcessing Speed:`)
    console.log(`   Edge Function: ${edgeResult.serverDuration}ms (server) / ${edgeResult.clientDuration}ms (total)`)
    console.log(`   Local Processing: ${localResult.serverDuration}ms (server) / ${localResult.clientDuration}ms (total)`)
    
    const speedImprovement = localResult.serverDuration > 0 
      ? ((localResult.serverDuration - edgeResult.serverDuration) / localResult.serverDuration * 100).toFixed(1)
      : 'N/A'
    
    console.log(`   Speed Improvement: ${speedImprovement}% ${speedImprovement !== 'N/A' && parseFloat(speedImprovement) > 0 ? '(Edge Function faster)' : ''}`)
    
    // Slides Created
    console.log(`\nSlides Created:`)
    console.log(`   Edge Function: ${edgeResult.slidesCreated}`)
    console.log(`   Local Processing: ${localResult.slidesCreated}`)
    
    // Pages Processed
    console.log(`\nPages Processed:`)
    console.log(`   Edge Function: ${edgeResult.pagesProcessed}/${edgeResult.totalPages}`)
    console.log(`   Local Processing: ${localResult.pagesProcessed}/${localResult.totalPages}`)
  }
  
  // Recommendations
  console.log(`\n💡 Recommendations:`)
  if (edgeResult.success && !localResult.success) {
    console.log('   ✅ Use Edge Function - Local processing failed')
  } else if (!edgeResult.success && localResult.success) {
    console.log('   ✅ Use Local Processing - Edge Function failed')
  } else if (edgeResult.success && localResult.success) {
    if (edgeResult.serverDuration < localResult.serverDuration) {
      console.log('   ✅ Use Edge Function - Better performance')
    } else if (localResult.serverDuration < edgeResult.serverDuration) {
      console.log('   ✅ Use Local Processing - Better performance')
    } else {
      console.log('   ⚖️  Both methods perform similarly - Edge Function recommended for scalability')
    }
  } else {
    console.log('   ❌ Both methods failed - Check configuration and dependencies')
  }
}

// Run the tests
runTests().catch(console.error)
