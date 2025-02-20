// @ts-check
import fetch from 'node-fetch'

async function createUser() {
  try {
    const response = await fetch('http://localhost:3000/api/users/first-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123',
        name: 'Test User',
      }),
    })

    const data = await response.json()
    console.log('User creation response:', data)

    if (response.ok) {
      console.log('✅ User created successfully!')
      return data
    } else {
      console.error('❌ User creation failed:', data.errors || data.message)
      return null
    }
  } catch (error) {
    console.error('❌ User creation error:', error.message)
    return null
  }
}

async function login() {
  try {
    const response = await fetch('http://localhost:3000/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'abenuro@gmail.com',
        password: 'abenuro@gmail.com',
      }),
    })

    const data = await response.json()
    console.log('Login response:', data)

    if (response.ok) {
      console.log('✅ Logged in successfully!')
      return data.token || data.user?.token
    } else {
      console.error('❌ Login failed:', data.errors || data.message)
      return null
    }
  } catch (error) {
    console.error('❌ Login error:', error.message)
    return null
  }
}

async function createModule(token) {
  try {
    console.log('Creating module with token:', token)

    const response = await fetch('http://localhost:3000/api/modules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${token}`,
      },
      body: JSON.stringify({
        title: 'Test Module via API',
        description: 'This is a test module created via API',
        slidesColor: '#4287f5',
      }),
    })

    const data = await response.json()
    console.log('Module creation response:', data)

    if (response.ok) {
      console.log('✅ Module created successfully!')
      console.log('Module ID:', data.id)
      console.log('Module Title:', data.title)
      return data
    } else {
      console.error('❌ Failed to create module:', data.errors || data.message)
      return null
    }
  } catch (error) {
    console.error('❌ Error creating module:', error.message)
    return null
  }
}

async function run() {
  try {
    // Login with existing credentials
    const token = await login()
    if (!token) {
      throw new Error('Failed to get authentication token')
    }

    console.log('Got authentication token:', token)

    // Create the module
    const module = await createModule(token)
    if (!module) {
      throw new Error('Failed to create module')
    }
  } catch (error) {
    console.error('❌ Script failed:', error.message)
  }
}

run()
