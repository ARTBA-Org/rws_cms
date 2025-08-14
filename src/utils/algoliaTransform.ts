import { getPayload } from 'payload'
import config from '../payload.config'

export interface AlgoliaRecord {
  objectID: string
  type: 'course' | 'module' | 'slide'
  title: string
  description?: string
  content?: string

  // Hierarchy
  courseId?: number
  courseTitle?: string
  courseSlug?: string
  moduleId?: number
  moduleTitle?: string
  moduleSlug?: string
  slideId?: number
  slideSlug?: string

  // Search optimization
  searchableText: string
  breadcrumb: string
  tags?: string[]

  // Navigation
  deepLink: string
  navigationPath: any

  // Metadata
  priority: number
  updatedAt: string
  slideCount?: number
  moduleCount?: number
}

export async function transformDataForAlgolia(): Promise<AlgoliaRecord[]> {
  const payload = await getPayload({ config })
  const records: AlgoliaRecord[] = []

  // Get all courses with their modules and slides
  const courses = await payload.find({
    collection: 'courses',
    depth: 3, // Deep populate to get modules and slides
    limit: 1000,
  })

  for (const course of courses.docs as any[]) {
    // Create course record
    const courseRecord: AlgoliaRecord = {
      objectID: `course_${course.id}`,
      type: 'course',
      title: course.title,
      description: course.description,

      courseId: course.id,
      courseSlug: course.slug,

      searchableText: `${course.title} ${course.description || ''} ${course.tags?.join(' ') || ''}`,
      breadcrumb: course.title,
      tags: course.tags || [],

      deepLink: `/courses/${course.id}`,
      navigationPath: {
        course: { id: course.id, slug: course.slug, title: course.title },
      },

      priority: 1,
      updatedAt: course.updatedAt,
      moduleCount: course.modules?.length || 0,
      slideCount:
        course.modules?.reduce(
          (total: number, module: any) => total + (module.slides?.length || 0),
          0,
        ) || 0,
    }
    records.push(courseRecord)

    // Process modules
    if (course.modules && Array.isArray(course.modules)) {
      for (const module of course.modules) {
        // Create module record
        const moduleRecord: AlgoliaRecord = {
          objectID: `module_${module.id}`,
          type: 'module',
          title: module.title,
          description: module.description,

          courseId: course.id,
          courseTitle: course.title,
          courseSlug: course.slug,
          moduleId: module.id,
          moduleSlug: module.slug,

          searchableText: `${module.title} ${module.description || ''} ${course.title}`,
          breadcrumb: `${course.title} > ${module.title}`,

          deepLink: `/courses/${course.id}/modules/${module.id}`,
          navigationPath: {
            course: { id: course.id, slug: course.slug, title: course.title },
            module: { id: module.id, slug: module.slug, title: module.title },
          },

          priority: 2,
          updatedAt: module.updatedAt,
          slideCount: module.slides?.length || 0,
        }
        records.push(moduleRecord)

        // Process slides
        if (module.slides && Array.isArray(module.slides)) {
          for (const slide of module.slides) {
            // Create slide record
            const slideRecord: AlgoliaRecord = {
              objectID: `slide_${slide.id}`,
              type: 'slide',
              title: slide.title,
              description: slide.description,
              content: slide.content || slide.description,

              courseId: course.id,
              courseTitle: course.title,
              courseSlug: course.slug,
              moduleId: module.id,
              moduleTitle: module.title,
              moduleSlug: module.slug,
              slideId: slide.id,
              slideSlug: slide.slug,

              searchableText: `${slide.title} ${slide.description || ''} ${slide.content || ''} ${module.title} ${course.title}`,
              breadcrumb: `${course.title} > ${module.title} > ${slide.title}`,
              tags: slide.tags || [],

              deepLink: `/courses/${course.id}/modules/${module.id}/slides/${slide.id}`,
              navigationPath: {
                course: { id: course.id, slug: course.slug, title: course.title },
                module: { id: module.id, slug: module.slug, title: module.title },
                slide: { id: slide.id, slug: slide.slug, title: slide.title },
              },

              priority: 3, // Highest priority for slides
              updatedAt: slide.updatedAt,
            }
            records.push(slideRecord)
          }
        }
      }
    }
  }

  return records
}

export async function syncToAlgolia() {
  const algoliasearch = (await import('algoliasearch')).default
  const client = algoliasearch(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_ADMIN_API_KEY!)

  const index = client.initIndex('learning_content')
  const records = await transformDataForAlgolia()

  console.log(`🔍 Syncing ${records.length} records to Algolia...`)

  // Clear and replace all records
  await index.clearObjects()
  await index.saveObjects(records)

  console.log('✅ Algolia sync completed')
  return records.length
}
