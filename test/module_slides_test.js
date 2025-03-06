// Test script to check if more than 10 slides can be added to a module
// This script uses the native fetch API to make requests directly to the Payload API

// Configuration
const BASE_URL = 'http://localhost:3000' // Change if your server runs on a different URL
const API_PATH = '/api'
const NUM_SLIDES_TO_CREATE = 15 // We'll try to create 15 slides

// Credentials
const PAYLOAD_EMAIL = 'abenuro@gmail.com'
const PAYLOAD_PASSWORD = 'abenuro@gmail.com'

// Helper function to make authenticated API requests
async function makeRequest(endpoint, method = 'GET', data = null, token = null) {
  const url = `${BASE_URL}${API_PATH}${endpoint}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (token) {
    options.headers['Authorization'] = `JWT ${token}`
  }

  if (data && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(data)
  }

  try {
    const response = await fetch(url, options)
    return await response.json()
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error)
    throw error
  }
}

// Function to login and get the authentication token
async function login() {
  console.log('Logging in...')
  const loginData = {
    email: PAYLOAD_EMAIL,
    password: PAYLOAD_PASSWORD,
  }

  const result = await makeRequest('/users/login', 'POST', loginData)

  if (!result.token) {
    throw new Error('Failed to login. Check your credentials.')
  }

  console.log('Login successful!')
  return result.token
}

// Function to create a test slide
async function createSlide(index, token) {
  const slideData = {
    title: `Test Slide ${index}`,
    description: `This is test slide ${index} created via API`,
    type: 'regular',
  }

  console.log(`Creating slide ${index}...`)
  return makeRequest('/slides', 'POST', slideData, token)
}

// Function to create a test module or use an existing one
async function getOrCreateModule(token) {
  // First try to find an existing test module
  const modules = await makeRequest(
    '/modules?where[title][equals]=API Test Module',
    'GET',
    null,
    token,
  )

  if (modules.docs && modules.docs.length > 0) {
    console.log('Using existing test module.')
    return modules.docs[0]
  }

  // Create a new module if none exists
  console.log('Creating new test module...')
  const moduleData = {
    title: 'API Test Module',
    description: 'Module created to test slide limit',
  }

  return makeRequest('/modules', 'POST', moduleData, token)
}

// Function to add slides to a module
async function addSlidesToModule(moduleId, slideIds, token) {
  console.log(`Adding ${slideIds.length} slides to module ${moduleId}...`)

  return makeRequest(
    `/modules/${moduleId}`,
    'PATCH',
    {
      slides: slideIds,
    },
    token,
  )
}

// Main function to run the test
async function runTest() {
  try {
    console.log('Starting test to add multiple slides to a module...')

    // Login to get authentication token
    const token = await login()

    // Step 1: Create or get a module
    const testModule = await getOrCreateModule(token)
    console.log(`Module ID: ${testModule.id}`)

    // Step 2: Create multiple slides
    const createdSlides = []
    for (let i = 1; i <= NUM_SLIDES_TO_CREATE; i++) {
      const slide = await createSlide(i, token)
      createdSlides.push(slide)
      console.log(`Created slide ${i} with ID: ${slide.id}`)
    }

    // Step 3: Add all slides to the module
    const slideIds = createdSlides.map((slide) => slide.id)
    const updatedModule = await addSlidesToModule(testModule.id, slideIds, token)

    // Step 4: Verify the results
    if (updatedModule.slides && Array.isArray(updatedModule.slides)) {
      console.log(`Successfully added ${updatedModule.slides.length} slides to the module`)
      if (updatedModule.slides.length < NUM_SLIDES_TO_CREATE) {
        console.warn(
          `Warning: Only ${updatedModule.slides.length} slides were added out of ${NUM_SLIDES_TO_CREATE}`,
        )
      }
    } else {
      console.error('Failed to add slides to module or response format unexpected')
    }

    console.log('Test completed.')
  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Run the test
runTest()
