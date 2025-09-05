const assert = require('assert').strict;
const path = require('path');

// --- Mocking next/server ---
let mockedResponse = null;
const mockNextResponse = {
  json: (data) => {
    mockedResponse = data;
    return { status: 200, json: () => Promise.resolve(data) };
  },
};
require.cache[require.resolve('next/server')] = {
  exports: {
    NextResponse: mockNextResponse,
  },
};
// --- End Mocking ---

async function runHealthTest() {
  console.log('Running Health Check Test...');
  const originalEnv = { ...process.env };
  let testFailed = false;

  try {
    // --- Test 1: Development environment ---
    console.log('\nTesting in development mode...');
    process.env.NODE_ENV = 'development';
    mockedResponse = null;
    const { GET: GET_DEV } = require('../src/app/api/health/route');
    await GET_DEV();

    assert.ok(mockedResponse, 'Response should not be null in dev');
    assert.equal(mockedResponse.status, 'healthy', 'Status should be healthy in dev');
    assert.equal(mockedResponse.environment, 'development', 'Environment should be development');
    assert.ok(mockedResponse.timestamp, 'Timestamp should exist in dev');
    assert.ok(mockedResponse.features, 'Features should exist in dev');
    console.log('Development test passed.');

    // --- Test 2: Production environment (pre-fix) ---
    console.log('\nTesting in production mode (expecting failure pre-fix)...');
    process.env.NODE_ENV = 'production';
    mockedResponse = null;
    // Invalidate the cache to re-import with new env vars
    delete require.cache[require.resolve('../src/app/api/health/route')];
    const { GET: GET_PROD } = require('../src/app/api/health/route');
    await GET_PROD();

    assert.ok(mockedResponse, 'Response should not be null in prod');
    const expectedResponse = { status: 'healthy' };
    try {
      assert.deepStrictEqual(mockedResponse, expectedResponse, 'Response in prod should be minimal');
      console.warn('Warning: Production test passed unexpectedly. The bug might already be fixed.');
    } catch (error) {
      if (error instanceof assert.AssertionError) {
        console.log('Production test failed as expected (pre-fix). This is good!');
        console.log('  └─ Details:', error.message);
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('\nHealth Check Test Suite Failed:', error);
    testFailed = true;
  } finally {
    process.env = originalEnv;
    if (testFailed) {
      process.exit(1);
    } else {
      console.log('\nHealth Check Test Suite Finished Successfully.');
    }
  }
}

runHealthTest();
