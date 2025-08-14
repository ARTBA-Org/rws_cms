#!/usr/bin/env tsx

import { Client } from 'pg'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function fixNestedDocsConstraints() {
  console.log('🔧 Fixing Nested Docs constraints directly...')

  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  })

  try {
    await client.connect()
    console.log('✅ Connected to database')

    // Check what courses exist
    const coursesResult = await client.query('SELECT id, title FROM courses ORDER BY id')
    console.log(`📚 Found ${coursesResult.rows.length} courses:`)
    coursesResult.rows.forEach((course) => {
      console.log(`  - ID: ${course.id}, Title: ${course.title}`)
    })

    // Check what modules exist and their parent references
    const modulesResult = await client.query('SELECT id, title, parent_id FROM modules ORDER BY id')
    console.log(`📖 Found ${modulesResult.rows.length} modules:`)
    modulesResult.rows.forEach((module) => {
      console.log(
        `  - ID: ${module.id}, Title: ${module.title}, Parent: ${module.parent_id || 'none'}`,
      )
    })

    // Find orphaned modules (modules with parent references to non-existent courses)
    const courseIds = new Set(coursesResult.rows.map((c) => c.id))
    const orphanedModules = modulesResult.rows.filter(
      (module) => module.parent_id && !courseIds.has(module.parent_id),
    )

    if (orphanedModules.length > 0) {
      console.log(`⚠️  Found ${orphanedModules.length} orphaned modules:`)
      orphanedModules.forEach((module) => {
        console.log(
          `  - Module "${module.title}" references non-existent course ID: ${module.parent_id}`,
        )
      })

      // Fix orphaned modules by setting parent_id to null
      for (const module of orphanedModules) {
        console.log(`🔧 Fixing module "${module.title}"...`)
        await client.query('UPDATE modules SET parent_id = NULL WHERE id = $1', [module.id])
        console.log(`✅ Fixed module "${module.title}"`)
      }
    } else {
      console.log('✅ No orphaned modules found')
    }

    // Clean up orphaned breadcrumbs
    console.log('🧹 Cleaning up orphaned breadcrumbs...')

    // Delete breadcrumbs for modules that reference non-existent courses
    const deleteBreadcrumbsResult = await client.query(`
      DELETE FROM modules_breadcrumbs 
      WHERE doc_id NOT IN (SELECT id FROM courses)
    `)
    console.log(`🗑️  Deleted ${deleteBreadcrumbsResult.rowCount} orphaned module breadcrumbs`)

    // Delete breadcrumbs for slides that reference non-existent modules
    const deleteSlidesBreadcrumbsResult = await client.query(`
      DELETE FROM slides_breadcrumbs 
      WHERE doc_id NOT IN (SELECT id FROM modules)
    `)
    console.log(`🗑️  Deleted ${deleteSlidesBreadcrumbsResult.rowCount} orphaned slide breadcrumbs`)

    // Check slides as well
    const slidesResult = await client.query('SELECT id, title, parent_id FROM slides ORDER BY id')
    console.log(`📄 Found ${slidesResult.rows.length} slides:`)
    slidesResult.rows.forEach((slide) => {
      console.log(
        `  - ID: ${slide.id}, Title: ${slide.title}, Parent: ${slide.parent_id || 'none'}`,
      )
    })

    // Find orphaned slides (slides with parent references to non-existent modules)
    const moduleIds = new Set(modulesResult.rows.map((m) => m.id))
    const orphanedSlides = slidesResult.rows.filter(
      (slide) => slide.parent_id && !moduleIds.has(slide.parent_id),
    )

    if (orphanedSlides.length > 0) {
      console.log(`⚠️  Found ${orphanedSlides.length} orphaned slides:`)
      orphanedSlides.forEach((slide) => {
        console.log(
          `  - Slide "${slide.title}" references non-existent module ID: ${slide.parent_id}`,
        )
      })

      // Fix orphaned slides by setting parent_id to null
      for (const slide of orphanedSlides) {
        console.log(`🔧 Fixing slide "${slide.title}"...`)
        await client.query('UPDATE slides SET parent_id = NULL WHERE id = $1', [slide.id])
        console.log(`✅ Fixed slide "${slide.title}"`)
      }
    } else {
      console.log('✅ No orphaned slides found')
    }

    console.log('✅ Nested Docs constraints fixed successfully!')
  } catch (error) {
    console.error('❌ Error fixing constraints:', error)
  } finally {
    await client.end()
    process.exit(0)
  }
}

fixNestedDocsConstraints()
