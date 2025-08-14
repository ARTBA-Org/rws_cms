#!/usr/bin/env tsx

import { getPayload } from 'payload'
import config from '../src/payload.config'

async function fixNestedDocsConstraints() {
  console.log('🔧 Fixing Nested Docs constraints...')

  const payload = await getPayload({ config })

  try {
    // Get all courses
    const courses = await payload.find({
      collection: 'courses',
      limit: 1000,
    })

    console.log(`📚 Found ${courses.docs.length} courses:`)
    courses.docs.forEach((course) => {
      console.log(`  - ID: ${course.id}, Title: ${course.title}`)
    })

    // Get all modules
    const modules = await payload.find({
      collection: 'modules',
      limit: 1000,
    })

    console.log(`📖 Found ${modules.docs.length} modules:`)
    modules.docs.forEach((module) => {
      console.log(
        `  - ID: ${module.id}, Title: ${module.title}, Parent: ${module.parent || 'none'}`,
      )
    })

    // Check for orphaned modules (modules with parent references to non-existent courses)
    const courseIds = new Set(courses.docs.map((c) => c.id))
    const orphanedModules = modules.docs.filter(
      (module) => module.parent && !courseIds.has(module.parent),
    )

    if (orphanedModules.length > 0) {
      console.log(`⚠️  Found ${orphanedModules.length} orphaned modules:`)
      orphanedModules.forEach((module) => {
        console.log(
          `  - Module "${module.title}" references non-existent course ID: ${module.parent}`,
        )
      })

      // Fix orphaned modules by removing their parent reference
      for (const module of orphanedModules) {
        console.log(`🔧 Fixing module "${module.title}"...`)
        await payload.update({
          collection: 'modules',
          id: module.id,
          data: {
            parent: null,
          },
        })
        console.log(`✅ Fixed module "${module.title}"`)
      }
    } else {
      console.log('✅ No orphaned modules found')
    }

    // Get all slides
    const slides = await payload.find({
      collection: 'slides',
      limit: 1000,
    })

    console.log(`📄 Found ${slides.docs.length} slides:`)
    slides.docs.forEach((slide) => {
      console.log(`  - ID: ${slide.id}, Title: ${slide.title}, Parent: ${slide.parent || 'none'}`)
    })

    // Check for orphaned slides (slides with parent references to non-existent modules)
    const moduleIds = new Set(modules.docs.map((m) => m.id))
    const orphanedSlides = slides.docs.filter(
      (slide) => slide.parent && !moduleIds.has(slide.parent),
    )

    if (orphanedSlides.length > 0) {
      console.log(`⚠️  Found ${orphanedSlides.length} orphaned slides:`)
      orphanedSlides.forEach((slide) => {
        console.log(`  - Slide "${slide.title}" references non-existent module ID: ${slide.parent}`)
      })

      // Fix orphaned slides by removing their parent reference
      for (const slide of orphanedSlides) {
        console.log(`🔧 Fixing slide "${slide.title}"...`)
        await payload.update({
          collection: 'slides',
          id: slide.id,
          data: {
            parent: null,
          },
        })
        console.log(`✅ Fixed slide "${slide.title}"`)
      }
    } else {
      console.log('✅ No orphaned slides found')
    }

    console.log('✅ Nested Docs constraints fixed successfully!')
  } catch (error) {
    console.error('❌ Error fixing constraints:', error)
  } finally {
    process.exit(0)
  }
}

fixNestedDocsConstraints()
