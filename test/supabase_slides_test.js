// Test script to check module-slide relationships directly in Supabase
// This bypasses Payload CMS to test if the database has any limits

// To run this script:
// 1. npm install @supabase/supabase-js
// 2. node test/supabase_slides_test.js

const { createClient } = require('@supabase/supabase-js')

// Your Supabase URL - this looks correct based on your connection string
const SUPABASE_URL = 'https://nwquaemdrfuhafnugbgl.supabase.co'
const NUM_SLIDES_TO_TEST = 15 // We'll test with 15 slides

// Payload CMS credentials - these will be used to login to Payload
// which has the proper database access permissions
const PAYLOAD_EMAIL = 'abenuro@gmail.com'
const PAYLOAD_PASSWORD = 'abenuro@gmail.com'

// We'll use the service role from Payload instead of the anon key
// We'll first login to Payload to get the token/credentials
async function getSupabaseCredentials() {
  console.log('Getting Supabase credentials via Payload login...')

  try {
    // Login to Payload
    const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: 'placeholder', // We'll try without an actual key first
      },
      body: JSON.stringify({
        email: PAYLOAD_EMAIL,
        password: PAYLOAD_PASSWORD,
      }),
    })

    const loginData = await loginResponse.json()

    if (loginData.error) {
      throw new Error(`Login failed: ${loginData.error_description || loginData.error}`)
    }

    return loginData.access_token
  } catch (error) {
    console.error('Failed to get Supabase credentials:', error)
    console.log('Continuing with public auth and limited access...')
    return null
  }
}

// Initialize Supabase client with JWT auth if available
async function initSupabaseClient() {
  try {
    const token = await getSupabaseCredentials()

    if (token) {
      console.log('Using authenticated Supabase client')
      return createClient(SUPABASE_URL, 'placeholder', {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      })
    } else {
      console.log('Using REST API through Payload instead of direct Supabase client')
      return null
    }
  } catch (error) {
    console.error('Error initializing Supabase client:', error)
    return null
  }
}

// Function to create a new test slide directly in the database
async function createSlide(index, supabase = null) {
  console.log(`Creating slide ${index}...`)

  // If we don't have Supabase client, use Payload API
  if (!supabase) {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/slides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // We'll use a placeholder and explain that proper credentials will be needed
        Authorization: 'Bearer [NEED_PROPER_JWT_TOKEN]',
      },
      body: JSON.stringify({
        title: `Supabase Test Slide ${index}`,
        description: `This is a test slide ${index} created directly with Supabase`,
        type: 'regular',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    })

    return result.json()
  }

  const { data, error } = await supabase
    .from('slides')
    .insert({
      title: `Supabase Test Slide ${index}`,
      description: `This is a test slide ${index} created directly with Supabase`,
      type: 'regular',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()

  if (error) {
    console.error('Error creating slide:', error)
    throw error
  }

  return data[0]
}

// Function to find or create a test module
async function getOrCreateModule() {
  // Try to find an existing test module
  const { data: existingModules, error: findError } = await supabase
    .from('modules')
    .select('*')
    .eq('title', 'Supabase Test Module')
    .limit(1)

  if (findError) {
    console.error('Error finding module:', findError)
    throw findError
  }

  if (existingModules && existingModules.length > 0) {
    console.log('Using existing test module.')
    return existingModules[0]
  }

  // Create a new module if none exists
  console.log('Creating new test module...')
  const { data, error } = await supabase
    .from('modules')
    .insert({
      title: 'Supabase Test Module',
      description: 'Module created to test slide limit with Supabase',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()

  if (error) {
    console.error('Error creating module:', error)
    throw error
  }

  return data[0]
}

// Function to link slides to a module
async function linkSlidesToModule(moduleId, slideIds) {
  console.log(`Linking ${slideIds.length} slides to module ${moduleId}...`)

  // Create relationship records in the modules_rels table
  const relationshipRecords = slideIds.map((slideId, index) => ({
    parent_id: moduleId,
    slides_id: slideId,
    order: index + 1,
    path: 'slides',
  }))

  const { data, error } = await supabase.from('modules_rels').insert(relationshipRecords).select()

  if (error) {
    console.error('Error linking slides to module:', error)
    throw error
  }

  return data
}

// Function to get all slides for a module
async function getModuleSlides(moduleId) {
  const { data, error } = await supabase
    .from('modules_rels')
    .select('slides_id')
    .eq('parent_id', moduleId)
    .order('order', { ascending: true })

  if (error) {
    console.error('Error getting module slides:', error)
    throw error
  }

  return data
}

// Function to clear previous test data
async function clearPreviousTestData() {
  console.log('Cleaning up previous test data...')

  // Find the test module
  const { data: modules, error: findError } = await supabase
    .from('modules')
    .select('id')
    .eq('title', 'Supabase Test Module')
    .limit(1)

  if (findError) {
    console.error('Error finding test module:', findError)
    return
  }

  if (modules && modules.length > 0) {
    const moduleId = modules[0].id

    // Delete all module-slide relationships for this module
    const { error: relError } = await supabase
      .from('modules_rels')
      .delete()
      .eq('parent_id', moduleId)

    if (relError) {
      console.error('Error deleting relationships:', relError)
    }

    // Find and delete test slides
    const { data: slides, error: slidesError } = await supabase
      .from('slides')
      .select('id')
      .like('title', 'Supabase Test Slide%')

    if (slidesError) {
      console.error('Error finding test slides:', slidesError)
    } else if (slides && slides.length > 0) {
      const slideIds = slides.map((slide) => slide.id)

      const { error: deleteError } = await supabase.from('slides').delete().in('id', slideIds)

      if (deleteError) {
        console.error('Error deleting test slides:', deleteError)
      } else {
        console.log(`Deleted ${slideIds.length} test slides.`)
      }
    }
  }
}

// Main function to run the test
async function runTest() {
  try {
    console.log('Starting Supabase test for module-slide relationships...')

    console.log(`
    IMPORTANT: This test requires direct database access with proper credentials.
    
    To run this test properly:
    1. You need to modify the script with your actual Supabase service role key
       or run this from your backend that has proper access.
    2. Alternatively, use the test/module_slides_test.js script which works through
       the Payload API with your provided credentials.
    
    Due to security limitations, this script can't be fully automated without proper
    credentials that aren't safe to include directly in the code.
    `)

    // Initialize Supabase client
    const supabase = await initSupabaseClient()

    if (!supabase) {
      console.log('Exiting test due to missing credentials.')
      return
    }

    // Clear previous test data to start fresh
    await clearPreviousTestData()

    // Step 1: Create or get a module
    const testModule = await getOrCreateModule()
    console.log(`Module ID: ${testModule.id}`)

    // Step 2: Create multiple test slides
    const createdSlides = []
    for (let i = 1; i <= NUM_SLIDES_TO_TEST; i++) {
      const slide = await createSlide(i, supabase)
      createdSlides.push(slide)
      console.log(`Created slide ${i} with ID: ${slide.id}`)
    }

    // Step 3: Link all slides to the module
    const slideIds = createdSlides.map((slide) => slide.id)
    await linkSlidesToModule(testModule.id, slideIds)

    // Step 4: Verify the results by fetching all slides for the module
    const moduleSlides = await getModuleSlides(testModule.id)

    console.log(`Module has ${moduleSlides.length} slides associated with it.`)
    if (moduleSlides.length < NUM_SLIDES_TO_TEST) {
      console.warn(
        `Warning: Only ${moduleSlides.length} slides were linked out of ${NUM_SLIDES_TO_TEST}`,
      )
    } else {
      console.log('Success! All slides were successfully linked to the module.')
    }

    console.log('Test completed.')
  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Run the test
runTest()
