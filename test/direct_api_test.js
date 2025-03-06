// Direct API test to check for slide limits
const BASE_URL = 'http://localhost:3000' // Change if your server runs on a different port

// Function to make a GET request
async function get(url) {
  try {
    const response = await fetch(url)
    return await response.json()
  } catch (error) {
    console.error(`GET request failed for ${url}:`, error)
    return null
  }
}

// Function to test if we can retrieve more than 10 slides
async function testSlideRetrieval() {
  console.log('Testing slide retrieval with max rows set to 15...')

  try {
    // First check the max rows setting
    console.log('Checking the max rows setting in the API...')
    console.log('You should have set this to more than 10 in your Supabase dashboard')
    console.log('-------')

    // Get all slides to see if we can retrieve more than 10
    console.log('Retrieving slides from API...')
    const slidesResponse = await get(`${BASE_URL}/api/slides?limit=15`)

    if (!slidesResponse || !slidesResponse.docs) {
      console.error('Failed to get slides or unexpected response format')
      return
    }

    const slideCount = slidesResponse.docs.length
    console.log(`Retrieved ${slideCount} slides from the API`)

    if (slideCount >= 15) {
      console.log('✅ SUCCESS: API is able to return more than 10 slides')
      console.log('This confirms the limit is not at the API level')
    } else if (slideCount > 10 && slideCount < 15) {
      console.log('✅ SUCCESS: API is able to return more than 10 slides')
      console.log(`However, only ${slideCount} slides exist in the database`)
    } else if (slideCount === 10) {
      console.log('⚠️ WARNING: API returned exactly 10 slides')
      console.log('This could indicate a limit of 10 slides in the API or pagination')
    } else {
      console.log(`ℹ️ INFO: API returned ${slideCount} slides`)
      console.log('This is less than 10, so not enough to test the limit')
    }

    // Now test a specific module with slides
    console.log('\nTesting slide relationships for a specific module...')
    const modulesResponse = await get(`${BASE_URL}/api/modules`)

    if (!modulesResponse || !modulesResponse.docs || !modulesResponse.docs.length) {
      console.error('Failed to get modules or no modules found')
      return
    }

    // Find a module that has slides
    let moduleWithSlides = null
    for (const module of modulesResponse.docs) {
      if (module.slides && module.slides.length > 0) {
        moduleWithSlides = module
        break
      }
    }

    if (!moduleWithSlides) {
      console.log('No modules with slides found. Test inconclusive.')
      return
    }

    console.log(
      `Found module "${moduleWithSlides.title}" with ${moduleWithSlides.slides.length} slides`,
    )

    if (moduleWithSlides.slides.length > 10) {
      console.log('✅ SUCCESS: At least one module has more than 10 slides')
      console.log('This confirms there is no 10-slide limit in the database')
    } else if (moduleWithSlides.slides.length === 10) {
      console.log('⚠️ WARNING: The module has exactly 10 slides')
      console.log('This could indicate a limit of 10 slides per module')
    } else {
      console.log(`ℹ️ INFO: The module has ${moduleWithSlides.slides.length} slides`)
      console.log('This is less than 10, so not enough to test the limit')
    }

    // Get the module with expanded slides to check pagination
    console.log('\nTesting slide expansion for a module...')
    const moduleDetailResponse = await get(`${BASE_URL}/api/modules/${moduleWithSlides.id}?depth=1`)

    if (!moduleDetailResponse || !moduleDetailResponse.slides) {
      console.error('Failed to get module details or unexpected response format')
      return
    }

    const expandedSlideCount = moduleDetailResponse.slides.length
    console.log(`Module has ${expandedSlideCount} slides when retrieved with depth=1`)

    if (expandedSlideCount !== moduleWithSlides.slides.length) {
      console.log('⚠️ WARNING: Different slide counts when expanding slides')
      console.log('This could indicate pagination or filtering is active')
    }

    console.log('\n=== CONCLUSION ===')
    console.log('Based on these tests:')

    if (expandedSlideCount > 10 || slideCount > 10) {
      console.log('✅ The API and database DO NOT have a hard 10-slide limit')
      console.log('The issue might be in the UI or a specific API endpoint you are using')
    } else {
      console.log('⚠️ Results are inconclusive - could not find examples with more than 10 slides')
      console.log('Try creating more slides manually and testing again')
    }
  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Run the test
testSlideRetrieval()
