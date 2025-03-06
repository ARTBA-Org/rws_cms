// Simple script to check if the server is running
const BASE_URL = 'http://localhost:3000' // Change if your server runs on a different port

async function checkServer() {
  console.log(`Checking if server is running at ${BASE_URL}...`)

  try {
    const response = await fetch(BASE_URL)
    console.log(`Server responded with status: ${response.status}`)

    if (response.ok) {
      console.log('✅ Server is running!')

      // Check if API is accessible
      try {
        console.log('Testing API endpoint access...')
        const apiResponse = await fetch(`${BASE_URL}/api`)

        if (apiResponse.ok) {
          console.log('✅ API endpoint is accessible!')
        } else {
          console.log(`❌ API endpoint returned status: ${apiResponse.status}`)
        }
      } catch (apiError) {
        console.error('Failed to access API endpoint:', apiError)
      }
    } else {
      console.log('❌ Server returned an error response')
    }
  } catch (error) {
    console.error('Failed to connect to server:', error)
    console.log('\n❌ Server is not running or not accessible.')
    console.log('\nPlease make sure:')
    console.log('1. Your server is running (npm run dev or similar command)')
    console.log("2. It's running on the expected port (default: 3000)")
    console.log('3. There are no network connectivity issues')
  }
}

// Run the check
checkServer()
