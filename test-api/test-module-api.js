// @ts-check
import fetch from 'node-fetch'

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string|null} name
 * @property {string} userRole
 * @property {string} email
 * @property {string} collection
 * @property {number} loginAttempts
 * @property {string} updatedAt
 * @property {string} createdAt
 */

/**
 * @typedef {Object} UserResponse
 * @property {string} message
 * @property {number} exp
 * @property {string} token
 * @property {User} user
 */

/**
 * @typedef {Object} ModuleWithSlides
 * @property {number} id
 * @property {string} title
 * @property {string} description
 * @property {string|null} moduleThumbnail
 * @property {Array<Slide>} slides
 * @property {string} slidesColor
 * @property {string} updatedAt
 * @property {string} createdAt
 */

/**
 * @typedef {Object} ModuleResponse
 * @property {ModuleWithSlides} doc
 * @property {string} message
 */

/**
 * @typedef {Object} Slide
 * @property {number} id
 * @property {string} title
 * @property {string|null} description
 * @property {string|null} image
 * @property {string} type
 * @property {Array} urls
 * @property {string} updatedAt
 * @property {string} createdAt
 */

/**
 * @typedef {Object} SlideResponse
 * @property {Slide} doc
 * @property {string} message
 */

/**
 * @typedef {Object} SlideContent
 * @property {string} title
 * @property {string} content
 * @property {number} order
 */

/** @type {SlideContent[]} */
const workerFatigueSlides = [
  {
    title: 'Introduction to Worker Fatigue',
    content: `# Understanding Worker Fatigue

Worker fatigue is a critical workplace safety concern that affects performance, decision-making, and overall well-being.

## Key Points:
- Definition of worker fatigue
- Impact on workplace safety
- Common causes and risk factors`,
    order: 1,
  },
  {
    title: 'Signs and Symptoms',
    content: `# Recognizing Fatigue

## Physical Signs:
- Tiredness and drowsiness
- Slower reactions
- Difficulty concentrating
- Headaches and dizziness

## Mental Signs:
- Poor decision making
- Mood changes
- Difficulty remembering things
- Reduced communication`,
    order: 2,
  },
  {
    title: 'Risk Management',
    content: `# Managing Fatigue Risks

## Workplace Strategies:
1. Schedule optimization
2. Regular breaks
3. Adequate lighting
4. Temperature control

## Personal Strategies:
1. Sleep hygiene
2. Healthy diet
3. Regular exercise
4. Stress management`,
    order: 3,
  },
  {
    title: 'Best Practices',
    content: `# Best Practices for Night Shift Workers

## Tips for Better Sleep:
- Maintain a consistent sleep schedule
- Create a dark, quiet sleeping environment
- Limit caffeine and screen time before sleep

## Workplace Recommendations:
- Take scheduled breaks
- Stay hydrated
- Maintain social connections
- Regular health check-ups`,
    order: 4,
  },
]

/**
 * @returns {Promise<UserResponse|null>}
 */
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

    /** @type {UserResponse} */
    const data = await response.json()
    console.log('User creation response:', data)

    if (response.ok) {
      console.log('✅ User created successfully!')
      return data
    } else {
      console.error('❌ User creation failed:', data.message)
      return null
    }
  } catch (error) {
    console.error('❌ User creation error:', error.message)
    return null
  }
}

/**
 * @returns {Promise<string|null>}
 */
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

    /** @type {UserResponse} */
    const data = await response.json()
    console.log('Login response:', data)

    if (response.ok) {
      console.log('✅ Logged in successfully!')
      return data.token
    } else {
      console.error('❌ Login failed:', data.message)
      return null
    }
  } catch (error) {
    console.error('❌ Login error:', error.message)
    return null
  }
}

/**
 * @param {string} token
 * @param {string|number} moduleId
 * @param {SlideContent} slideContent
 * @returns {Promise<SlideResponse|null>}
 */
async function createSlide(token, moduleId, slideContent) {
  try {
    console.log('Creating slide:', slideContent.title)

    const response = await fetch('http://localhost:3000/api/slides', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${token}`,
      },
      body: JSON.stringify({
        moduleId: Number(moduleId),
        module: {
          id: Number(moduleId),
          title: 'Worker Fatigue Module',
        },
        title: slideContent.title,
        content: slideContent.content,
        type: 'regular',
        order: slideContent.order,
        description: `Slide ${slideContent.order} of the Worker Fatigue Module`,
        moduleTitle: 'Worker Fatigue Module',
        moduleColor: '#503D73',
        markdown: slideContent.content,
        text: slideContent.content,
      }),
    })

    /** @type {SlideResponse} */
    const data = await response.json()
    console.log('Slide creation response:', data)

    if (response.ok) {
      console.log('✅ Slide created successfully!')
      console.log('Slide ID:', data.doc.id)
      console.log('Slide Title:', data.doc.title)
      return data
    } else {
      console.error('❌ Failed to create slide:', data.message)
      return null
    }
  } catch (error) {
    console.error('❌ Error creating slide:', error.message)
    return null
  }
}

/**
 * @param {string} token
 * @param {string|number} moduleId
 * @returns {Promise<ModuleWithSlides|null>}
 */
async function getModule(token, moduleId) {
  try {
    console.log('Fetching module:', moduleId)

    const response = await fetch(`http://localhost:3000/api/modules/${moduleId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${token}`,
      },
    })

    if (response.ok) {
      /** @type {ModuleWithSlides} */
      const data = await response.json()
      console.log('✅ Module fetched successfully!')
      console.log('Module ID:', data.id)
      console.log('Module Title:', data.title)
      console.log('Number of slides:', data.slides.length)
      console.log('Slides:', JSON.stringify(data.slides, null, 2))
      return data
    } else {
      const error = await response.json()
      console.error('❌ Failed to fetch module:', error.message)
      return null
    }
  } catch (error) {
    console.error('❌ Error fetching module:', error.message)
    return null
  }
}

/**
 * @param {string} token
 * @param {string|number} moduleId
 * @param {number[]} slideIds
 * @returns {Promise<boolean>}
 */
async function associateSlides(token, moduleId, slideIds) {
  try {
    console.log('Associating slides with module:', { moduleId, slideIds })

    // First, let's try to associate each slide individually
    for (const slideId of slideIds) {
      const response = await fetch(`http://localhost:3000/api/slides/${slideId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${token}`,
        },
        body: JSON.stringify({
          module: Number(moduleId),
          moduleId: Number(moduleId),
        }),
      })

      if (response.ok) {
        console.log(`✅ Associated slide ${slideId} with module ${moduleId}`)
      } else {
        const error = await response.json()
        console.error(`❌ Failed to associate slide ${slideId}:`, error.message)
        return false
      }

      // Add a small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return true
  } catch (error) {
    console.error('❌ Error associating slides:', error.message)
    return false
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

    // Add slides to existing module
    const moduleId = 18 // Worker Fatigue Module

    // Create all slides sequentially
    for (const slideContent of workerFatigueSlides) {
      const slide = await createSlide(token, moduleId, slideContent)
      if (!slide) {
        throw new Error(`Failed to create slide: ${slideContent.title}`)
      }
      // Add a small delay between slide creations
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    console.log('✅ All slides created successfully!')

    // Verify the module's slides
    console.log('\nVerifying module slides...')
    const moduleData = await getModule(token, moduleId)
    if (!moduleData) {
      throw new Error('Failed to verify module slides')
    }
  } catch (error) {
    console.error('❌ Script failed:', error.message)
  }
}

run()
