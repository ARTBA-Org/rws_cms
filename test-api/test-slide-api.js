// @ts-check
import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

async function login() {
  try {
    console.log('Attempting to login...')
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
    console.log('Login API Response:', data)

    if (response.ok) {
      console.log('✅ Logged in successfully!')
      const token = data.token || data.user?.token
      if (!token) {
        throw new Error('No token received in response')
      }
      return token
    } else {
      throw new Error(`Login failed: ${JSON.stringify(data.errors || data.message)}`)
    }
  } catch (error) {
    console.error('❌ Login error:', error)
    throw error
  }
}

async function uploadImage(token, imagePath) {
  try {
    console.log('Uploading image from path:', imagePath)

    // Verify file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found at path: ${imagePath}`)
    }

    const formData = new FormData()
    const fileBuffer = fs.readFileSync(imagePath)
    const filename = path.basename(imagePath)

    // Add required fields for Payload CMS media collection
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: 'image/jpeg',
    })
    formData.append('alt', filename) // Required field from Media collection

    console.log('Sending upload request...')
    const response = await fetch('http://localhost:3000/api/media', {
      method: 'POST',
      headers: {
        Authorization: `JWT ${token}`,
        ...formData.getHeaders(),
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upload response:', response.status, errorText)
      throw new Error(`Upload failed with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log('Image Upload Response:', data)

    if (data.doc && data.doc.id) {
      console.log('✅ Image uploaded successfully!')
      return data.doc.id
    } else {
      throw new Error('Upload succeeded but no document ID was returned')
    }
  } catch (error) {
    console.error('❌ Error uploading image:', error)
    throw error
  }
}

async function createSlide(token, imageId) {
  try {
    console.log('Attempting to create slide with image ID:', imageId)
    const response = await fetch('http://localhost:3000/api/slides', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${token}`,
      },
      body: JSON.stringify({
        title: 'Introduction to Safety Protocols',
        description: 'This slide covers the basic safety protocols in the workplace',
        type: 'regular', // One of: regular, video, quiz, reference, resources
        image: imageId, // Attach the uploaded image
        slide_color_code: '#FF5733', // Optional: Color theme for the slide
        urls: [
          // Optional: Array of related URLs
          {
            url: 'https://www.osha.gov/safety-protocols',
          },
          {
            url: 'https://www.safety-training.com/basics',
          },
        ],
      }),
    })

    const data = await response.json()
    console.log('Slide Creation API Response:', data)

    if (response.ok) {
      console.log('✅ Slide created successfully!')
      console.log('Slide Details:', {
        id: data.doc.id,
        title: data.doc.title,
        type: data.doc.type,
        image: data.doc.image,
        urls: data.doc.urls,
      })
      return data.doc
    } else {
      throw new Error(`Failed to create slide: ${JSON.stringify(data.errors || data.message)}`)
    }
  } catch (error) {
    console.error('❌ Error creating slide:', error)
    throw error
  }
}

async function run() {
  try {
    console.log('Starting slide creation process...')

    // Login first
    const token = await login()
    console.log('Authentication successful, got token')

    // Upload the image
    const imagePath =
      '/Users/abenezernuro/Documents/work2025/Rs_cms/rs-cms/Free-Stock-Photos-01.jpg'
    const imageId = await uploadImage(token, imagePath)
    console.log('Image uploaded with ID:', imageId)

    // Create the slide with the image
    const slide = await createSlide(token, imageId)
    console.log('Slide creation completed successfully!')
  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

run()
