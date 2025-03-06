// Script to check module-slide relationship limits
// This script will work with either local or production URLs

// Configure your server URL here
const SERVER_URL = process.argv[2] || 'http://localhost:3000'
const API_PATH = '/api'

// Function to make a request with proper error handling
async function makeRequest(url) {
  try {
    console.log(`Making request to: ${url}`)
    const response = await fetch(url)

    if (!response.ok) {
      console.log(`Request failed with status: ${response.status}`)
      if (response.status === 404) {
        console.log('Endpoint not found. Make sure the URL is correct.')
      }
      return null
    }

    return await response.json()
  } catch (error) {
    console.error(`Request failed:`, error.message)
    return null
  }
}

// Main function to check for limits
async function checkLimits() {
  console.log(`\n===== Testing Module-Slide Relationship Limits =====`)
  console.log(`Using server: ${SERVER_URL}`)

  // 1. Check if server is accessible
  console.log(`\n1. Checking server accessibility...`)
  const rootResponse = await makeRequest(SERVER_URL)

  if (rootResponse === null) {
    console.log(`\nCannot access server. Please check the URL and ensure the server is running.`)
    console.log(`If using a local server, make sure it's started with 'npm run dev' or similar.`)
    return
  }

  console.log(`Server is accessible!`)

  // 2. Check the API endpoint
  console.log(`\n2. Checking API endpoint...`)
  const apiResponse = await makeRequest(`${SERVER_URL}${API_PATH}`)

  if (apiResponse === null) {
    console.log(`\nCannot access API. The API endpoint may be different or restricted.`)
    return
  }

  console.log(`API is accessible!`)

  // 3. Check for slides with different limits
  console.log(`\n3. Testing slide retrieval with different limits...`)

  // Try different limits to see if we can get more than 10 slides
  const limits = [10, 15, 20]

  for (const limit of limits) {
    console.log(`\nTesting with limit=${limit}...`)
    const slidesResponse = await makeRequest(`${SERVER_URL}${API_PATH}/slides?limit=${limit}`)

    if (!slidesResponse || !slidesResponse.docs) {
      console.log(`Failed to retrieve slides with limit=${limit}`)
      continue
    }

    const count = slidesResponse.docs.length
    console.log(`Retrieved ${count} slides with limit=${limit}`)

    if (count > 10) {
      console.log(`✅ SUCCESS: API returned more than 10 slides (${count})`)
      console.log(`This confirms there is no 10-slide limit at the API level`)
    } else if (count === 10 && limit > 10) {
      console.log(`⚠️ WARNING: API returned exactly 10 slides despite requesting ${limit}`)
      console.log(`This suggests there might be a 10-slide limit somewhere`)
    } else if (count < 10) {
      console.log(`ℹ️ INFO: API returned ${count} slides`)
      console.log(`This is less than 10, so not enough to test the limit`)
    }
  }

  // 4. Check modules with slides
  console.log(`\n4. Checking modules for slide relationships...`)
  const modulesResponse = await makeRequest(`${SERVER_URL}${API_PATH}/modules`)

  if (!modulesResponse || !modulesResponse.docs || !modulesResponse.docs.length) {
    console.log(`Failed to retrieve modules or no modules found`)
    return
  }

  console.log(`Found ${modulesResponse.docs.length} modules`)

  // Check each module for slides
  let foundModuleWithMoreThan10Slides = false

  for (const module of modulesResponse.docs) {
    if (!module.slides) continue

    console.log(`\nModule "${module.title}" has ${module.slides.length} slides`)

    if (module.slides.length > 10) {
      console.log(`✅ SUCCESS: This module has more than 10 slides (${module.slides.length})`)
      foundModuleWithMoreThan10Slides = true
    } else if (module.slides.length === 10) {
      console.log(`⚠️ NOTE: This module has exactly 10 slides`)
      console.log(`To test if there's a limit, try adding more slides to this module`)
    }

    // Check the module with depth to see if all slides are returned
    console.log(`Checking this module with expanded slides...`)
    const moduleDetailResponse = await makeRequest(
      `${SERVER_URL}${API_PATH}/modules/${module.id}?depth=1`,
    )

    if (!moduleDetailResponse || !moduleDetailResponse.slides) {
      console.log(`Failed to get expanded module details`)
      continue
    }

    const expandedCount = moduleDetailResponse.slides.length
    console.log(`Module has ${expandedCount} slides when expanded with depth=1`)

    if (expandedCount !== module.slides.length) {
      console.log(
        `⚠️ WARNING: Different slide counts (${expandedCount} vs ${module.slides.length})`,
      )
      console.log(`This suggests pagination or filtering may be active`)
    }
  }

  // 5. Conclusion
  console.log(`\n===== CONCLUSION =====`)

  if (foundModuleWithMoreThan10Slides) {
    console.log(`✅ Based on the tests, there is NO hard 10-slide limit in the database.`)
    console.log(`At least one module has more than 10 slides.`)
    console.log(`\nIf you're experiencing a limit, it might be due to:`)
    console.log(`1. UI pagination not showing all slides`)
    console.log(`2. A limit in the specific function you're using to add slides`)
    console.log(`3. The "Max rows" setting in Supabase API settings`)
  } else {
    console.log(`⚠️ Could not definitively determine if there is a 10-slide limit.`)
    console.log(`No modules with more than 10 slides were found.`)
    console.log(`\nRecommendations:`)
    console.log(`1. Try manually adding more than 10 slides to a module`)
    console.log(`2. Check your "Max rows" setting in Supabase (set to at least 1000)`)
    console.log(`3. Look for pagination controls in the UI when viewing slides`)
    console.log(`4. If using PDF uploads, check for limits in the PDF processing code`)
  }
}

// Run the check
checkLimits()
