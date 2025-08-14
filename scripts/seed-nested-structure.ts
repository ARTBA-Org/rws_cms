import type { SanitizedConfig } from 'payload'
import payload from 'payload'

export const script = async (config: SanitizedConfig) => {
  await payload.init({ config })

  payload.logger.info('🌱 Seeding nested course structure...')

  try {
    // Create a sample course (slug auto-generated from title)
    const course = await payload.create({
      collection: 'courses',
      data: {
        title: 'Introduction to Web Development',
        description:
          'Learn the fundamentals of web development including HTML, CSS, and JavaScript.',
        learningObjectives: [
          { objective: 'Understand HTML structure and semantics' },
          { objective: 'Master CSS styling and layout techniques' },
          { objective: 'Learn JavaScript programming basics' },
        ],
      },
    })

    payload.logger.info(`✅ Created course: ${course.title} (slug: ${course.slug})`)

    // Create modules for the course (slugs auto-generated from titles)
    const htmlModule = await payload.create({
      collection: 'modules',
      data: {
        title: 'HTML Fundamentals',
        description: 'Learn the building blocks of web pages with HTML.',
        parent: course.id,
      },
    })

    const cssModule = await payload.create({
      collection: 'modules',
      data: {
        title: 'CSS Styling',
        description: 'Style your web pages with CSS.',
        parent: course.id,
      },
    })

    payload.logger.info(`✅ Created modules: ${htmlModule.title}, ${cssModule.title}`)

    // Create slides for HTML module (slugs auto-generated from titles)
    const htmlSlides = await Promise.all([
      payload.create({
        collection: 'slides',
        data: {
          title: 'What is HTML?',
          description: 'Introduction to HTML and its purpose.',
          type: 'regular',
          parent: htmlModule.id,
        },
      }),
      payload.create({
        collection: 'slides',
        data: {
          title: 'HTML Document Structure',
          description: 'Understanding the basic structure of an HTML document.',
          type: 'regular',
          parent: htmlModule.id,
        },
      }),
      payload.create({
        collection: 'slides',
        data: {
          title: 'HTML Quiz',
          description: 'Test your knowledge of HTML basics.',
          type: 'quiz',
          parent: htmlModule.id,
        },
      }),
    ])

    // Create slides for CSS module (slugs auto-generated from titles)
    const cssSlides = await Promise.all([
      payload.create({
        collection: 'slides',
        data: {
          title: 'Introduction to CSS',
          description: 'What is CSS and how does it work?',
          type: 'regular',
          parent: cssModule.id,
        },
      }),
      payload.create({
        collection: 'slides',
        data: {
          title: 'CSS Selectors',
          description: 'Learn how to target HTML elements with CSS selectors.',
          type: 'regular',
          parent: cssModule.id,
        },
      }),
    ])

    payload.logger.info(`✅ Created ${htmlSlides.length + cssSlides.length} slides`)

    payload.logger.info(`\n🎉 Nested structure created successfully!`)
    payload.logger.info(`📚 Course: ${course.title}`)
    payload.logger.info(`  📖 Module: ${htmlModule.title} (${htmlSlides.length} slides)`)
    payload.logger.info(`  📖 Module: ${cssModule.title} (${cssSlides.length} slides)`)

    payload.logger.info(`\n🔗 Hierarchical URLs will be generated as:`)
    payload.logger.info(`  Course: /${course.slug}`)
    payload.logger.info(`  Module: /${course.slug}/${htmlModule.slug}`)
    payload.logger.info(`  Slide: /${course.slug}/${htmlModule.slug}/${htmlSlides[0].slug}`)
  } catch (error) {
    payload.logger.error(`❌ Seeding failed: ${error}`)
  }

  process.exit(0)
}
