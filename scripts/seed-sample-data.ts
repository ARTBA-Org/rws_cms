#!/usr/bin/env tsx

import { getPayload } from 'payload'
import config from '../src/payload.config'

async function seedSampleData() {
  console.log('🌱 Seeding sample data...')

  const payload = await getPayload({ config })

  try {
    // Create sample courses
    console.log('📚 Creating sample courses...')

    const course1 = await payload.create({
      collection: 'courses',
      data: {
        title: 'Introduction to Web Development',
        slug: 'intro-web-dev',
        description: 'Learn the basics of HTML, CSS, and JavaScript',
      },
    })
    console.log(`✅ Created course: ${course1.title} (ID: ${course1.id})`)

    const course2 = await payload.create({
      collection: 'courses',
      data: {
        title: 'Advanced React Concepts',
        slug: 'advanced-react',
        description: 'Deep dive into React hooks, context, and performance optimization',
      },
    })
    console.log(`✅ Created course: ${course2.title} (ID: ${course2.id})`)

    // Create sample modules for course 1
    console.log('📖 Creating sample modules...')

    const module1 = await payload.create({
      collection: 'modules',
      data: {
        title: 'HTML Fundamentals',
        slug: 'html-fundamentals',
        description: 'Learn the structure and semantics of HTML',
        parent: course1.id,
      },
    })
    console.log(`✅ Created module: ${module1.title} (ID: ${module1.id})`)

    const module2 = await payload.create({
      collection: 'modules',
      data: {
        title: 'CSS Styling',
        slug: 'css-styling',
        description: 'Master CSS selectors, properties, and layouts',
        parent: course1.id,
      },
    })
    console.log(`✅ Created module: ${module2.title} (ID: ${module2.id})`)

    const module3 = await payload.create({
      collection: 'modules',
      data: {
        title: 'JavaScript Basics',
        slug: 'javascript-basics',
        description: 'Introduction to JavaScript programming',
        parent: course1.id,
      },
    })
    console.log(`✅ Created module: ${module3.title} (ID: ${module3.id})`)

    // Create sample modules for course 2
    const module4 = await payload.create({
      collection: 'modules',
      data: {
        title: 'React Hooks Deep Dive',
        slug: 'react-hooks-deep-dive',
        description: 'Advanced patterns with useState, useEffect, and custom hooks',
        parent: course2.id,
      },
    })
    console.log(`✅ Created module: ${module4.title} (ID: ${module4.id})`)

    // Create sample slides for modules
    console.log('📄 Creating sample slides...')

    const slide1 = await payload.create({
      collection: 'slides',
      data: {
        title: 'What is HTML?',
        slug: 'what-is-html',
        content:
          'HTML (HyperText Markup Language) is the standard markup language for creating web pages.',
        parent: module1.id,
      },
    })
    console.log(`✅ Created slide: ${slide1.title} (ID: ${slide1.id})`)

    const slide2 = await payload.create({
      collection: 'slides',
      data: {
        title: 'HTML Document Structure',
        slug: 'html-document-structure',
        content:
          'Every HTML document has a basic structure with DOCTYPE, html, head, and body elements.',
        parent: module1.id,
      },
    })
    console.log(`✅ Created slide: ${slide2.title} (ID: ${slide2.id})`)

    const slide3 = await payload.create({
      collection: 'slides',
      data: {
        title: 'CSS Selectors',
        slug: 'css-selectors',
        content: 'CSS selectors are patterns used to select and style HTML elements.',
        parent: module2.id,
      },
    })
    console.log(`✅ Created slide: ${slide3.title} (ID: ${slide3.id})`)

    const slide4 = await payload.create({
      collection: 'slides',
      data: {
        title: 'useState Hook',
        slug: 'usestate-hook',
        content: 'The useState hook allows you to add state to functional components.',
        parent: module4.id,
      },
    })
    console.log(`✅ Created slide: ${slide4.title} (ID: ${slide4.id})`)

    console.log('🎉 Sample data seeded successfully!')
    console.log('\nHierarchy created:')
    console.log(`📚 ${course1.title}`)
    console.log(`  📖 ${module1.title}`)
    console.log(`    📄 ${slide1.title}`)
    console.log(`    📄 ${slide2.title}`)
    console.log(`  📖 ${module2.title}`)
    console.log(`    📄 ${slide3.title}`)
    console.log(`  📖 ${module3.title}`)
    console.log(`📚 ${course2.title}`)
    console.log(`  📖 ${module4.title}`)
    console.log(`    📄 ${slide4.title}`)
  } catch (error) {
    console.error('❌ Error seeding data:', error)
  } finally {
    process.exit(0)
  }
}

seedSampleData()
