#!/usr/bin/env tsx

/**
 * PDF Processing Query Optimization Script
 * 
 * Optimizes database queries specifically for PDF processing workloads:
 * - Creates indexes for slide lookup and creation
 * - Optimizes module-slide relationship queries
 * - Adds caching-friendly indexes
 * - Configures database settings for bulk operations
 * 
 * Prerequisites:
 * - DATABASE_URI environment variable set
 * - PostgreSQL database with admin privileges
 * 
 * Usage:
 * tsx scripts/optimize-pdf-processing-queries.ts
 */

import { Pool } from 'pg'
import { config } from 'dotenv'

// Load environment variables
config()

interface OptimizationTask {
  name: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  sql: string
  rollbackSQL?: string
}

class PDFProcessingOptimizer {
  private pool: Pool
  
  constructor() {
    const connectionString = process.env.DATABASE_URI
    
    if (!connectionString) {
      throw new Error('DATABASE_URI environment variable is required')
    }
    
    this.pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
    
    console.log('⚡ PDF Processing Query Optimizer initialized')
  }

  async optimize(): Promise<void> {
    console.log('\n=== Starting PDF Processing Optimization ===\n')

    const optimizations = this.getOptimizationTasks()
    
    try {
      // 1. Create performance indexes
      await this.executeOptimizations(optimizations.filter(o => o.name.includes('index')))
      
      // 2. Optimize database settings
      await this.executeOptimizations(optimizations.filter(o => o.name.includes('setting')))
      
      // 3. Create helper functions
      await this.executeOptimizations(optimizations.filter(o => o.name.includes('function')))
      
      // 4. Analyze and update statistics
      await this.updateTableStatistics()
      
      // 5. Verify optimizations
      await this.verifyOptimizations()
      
      console.log('\n✅ PDF Processing optimization completed successfully!')

    } catch (error) {
      console.error('❌ Optimization failed:', error)
      throw error
    } finally {
      await this.pool.end()
    }
  }

  private getOptimizationTasks(): OptimizationTask[] {
    return [
      // Critical indexes for PDF processing
      {
        name: 'slides_source_lookup_index',
        description: 'Composite index for slide lookup by module and PDF info',
        priority: 'critical',
        sql: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slides_source_lookup 
          ON slides (source_module, source_pdfFilename, source_pdfPage)
          WHERE source_module IS NOT NULL
        `,
        rollbackSQL: 'DROP INDEX IF EXISTS idx_slides_source_lookup',
      },
      
      {
        name: 'slides_duplicate_check_index',
        description: 'Fast duplicate slide detection during PDF processing',
        priority: 'critical',
        sql: `
          CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_slides_duplicate_check 
          ON slides (source_module, source_pdfFilename, source_pdfPage)
          WHERE source_module IS NOT NULL 
            AND source_pdfFilename IS NOT NULL 
            AND source_pdfPage IS NOT NULL
            AND _status != 'archived'
        `,
        rollbackSQL: 'DROP INDEX IF EXISTS idx_slides_duplicate_check',
      },

      {
        name: 'slides_module_relationship_index',
        description: 'Optimize module-slide relationship queries',
        priority: 'high',
        sql: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slides_module_relationship 
          ON slides (source_module, updated_at DESC, id)
          WHERE source_module IS NOT NULL AND _status != 'archived'
        `,
        rollbackSQL: 'DROP INDEX IF EXISTS idx_slides_module_relationship',
      },

      {
        name: 'modules_slides_array_index',
        description: 'GIN index for slides array in modules table',
        priority: 'high',
        sql: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_modules_slides_gin 
          ON modules USING gin(slides)
          WHERE slides IS NOT NULL
        `,
        rollbackSQL: 'DROP INDEX IF EXISTS idx_modules_slides_gin',
      },

      {
        name: 'slides_search_vector_index',
        description: 'Full-text search index for slide content',
        priority: 'medium',
        sql: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slides_search_vector_gin 
          ON slides USING gin(to_tsvector('english', 
            COALESCE(title, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(source_pdfFilename, '')
          ))
        `,
        rollbackSQL: 'DROP INDEX IF EXISTS idx_slides_search_vector_gin',
      },

      {
        name: 'slides_admin_listing_index',
        description: 'Optimize admin interface listing queries',
        priority: 'medium',
        sql: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slides_admin_listing 
          ON slides (updated_at DESC, _status, id)
          WHERE _status != 'archived'
        `,
        rollbackSQL: 'DROP INDEX IF EXISTS idx_slides_admin_listing',
      },

      {
        name: 'modules_admin_listing_index',
        description: 'Optimize modules admin interface',
        priority: 'medium',
        sql: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_modules_admin_listing 
          ON modules (updated_at DESC, _status, id)
          WHERE _status != 'archived'
        `,
        rollbackSQL: 'DROP INDEX IF EXISTS idx_modules_admin_listing',
      },

      {
        name: 'media_upload_relationship_index',
        description: 'Optimize media-slide relationship for image uploads',
        priority: 'medium',
        sql: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_image_relationship 
          ON media (created_at DESC, mime_type, filesize)
          WHERE mime_type LIKE 'image/%'
        `,
        rollbackSQL: 'DROP INDEX IF EXISTS idx_media_image_relationship',
      },

      // Database settings optimizations
      {
        name: 'bulk_operations_setting',
        description: 'Optimize for bulk insert operations during PDF processing',
        priority: 'high',
        sql: `
          -- Temporarily increase maintenance_work_mem for index creation
          SET maintenance_work_mem = '256MB';
          
          -- Optimize for bulk operations
          SET synchronous_commit = OFF; -- Be careful with this in production
          SET wal_buffers = '16MB';
          SET checkpoint_completion_target = 0.9;
        `,
      },

      // Helper functions for PDF processing
      {
        name: 'slide_exists_function',
        description: 'Fast function to check if slide exists',
        priority: 'medium',
        sql: `
          CREATE OR REPLACE FUNCTION slide_exists_by_source(
            p_module_id INTEGER,
            p_pdf_filename TEXT,
            p_pdf_page INTEGER
          ) RETURNS BOOLEAN AS $$
          BEGIN
            RETURN EXISTS (
              SELECT 1 FROM slides 
              WHERE source_module = p_module_id 
                AND source_pdfFilename = p_pdf_filename 
                AND source_pdfPage = p_pdf_page
                AND _status != 'archived'
            );
          END;
          $$ LANGUAGE plpgsql STABLE;
        `,
        rollbackSQL: 'DROP FUNCTION IF EXISTS slide_exists_by_source(INTEGER, TEXT, INTEGER)',
      },

      {
        name: 'bulk_slide_insert_function',
        description: 'Optimized function for bulk slide insertion',
        priority: 'medium',
        sql: `
          CREATE OR REPLACE FUNCTION bulk_insert_slides(
            slide_data JSONB[]
          ) RETURNS INTEGER[] AS $$
          DECLARE
            slide_ids INTEGER[] := '{}';
            slide JSONB;
            new_id INTEGER;
          BEGIN
            FOREACH slide IN ARRAY slide_data LOOP
              INSERT INTO slides (
                title, description, type, source_module, 
                source_pdfFilename, source_pdfPage, image,
                created_at, updated_at, _status
              ) VALUES (
                slide->>'title',
                slide->>'description', 
                COALESCE(slide->>'type', 'regular')::slide_type_enum,
                (slide->>'source_module')::INTEGER,
                slide->>'source_pdfFilename',
                (slide->>'source_pdfPage')::INTEGER,
                (slide->>'image')::INTEGER,
                NOW(),
                NOW(),
                'published'
              ) RETURNING id INTO new_id;
              
              slide_ids := slide_ids || new_id;
            END LOOP;
            
            RETURN slide_ids;
          END;
          $$ LANGUAGE plpgsql;
        `,
        rollbackSQL: 'DROP FUNCTION IF EXISTS bulk_insert_slides(JSONB[])',
      },

      {
        name: 'update_module_slide_count_function',
        description: 'Efficient function to update module slide counts',
        priority: 'low',
        sql: `
          CREATE OR REPLACE FUNCTION update_module_slide_count(
            p_module_id INTEGER
          ) RETURNS INTEGER AS $$
          DECLARE
            slide_count INTEGER;
          BEGIN
            SELECT array_length(slides, 1) INTO slide_count
            FROM modules 
            WHERE id = p_module_id;
            
            RETURN COALESCE(slide_count, 0);
          END;
          $$ LANGUAGE plpgsql STABLE;
        `,
        rollbackSQL: 'DROP FUNCTION IF EXISTS update_module_slide_count(INTEGER)',
      },

      // Performance monitoring views
      {
        name: 'pdf_processing_stats_view',
        description: 'Create monitoring view for PDF processing performance',
        priority: 'low',
        sql: `
          CREATE OR REPLACE VIEW pdf_processing_stats AS
          SELECT 
            m.id as module_id,
            m.title as module_title,
            COUNT(s.id) as total_slides,
            COUNT(s.id) FILTER (WHERE s.created_at > NOW() - INTERVAL '24 hours') as slides_last_24h,
            COUNT(s.id) FILTER (WHERE s.created_at > NOW() - INTERVAL '7 days') as slides_last_week,
            MAX(s.created_at) as last_slide_created,
            COUNT(DISTINCT s.source_pdfFilename) as unique_pdfs_processed,
            AVG(s.source_pdfPage) as avg_page_number,
            MAX(s.source_pdfPage) as max_page_number
          FROM modules m
          LEFT JOIN slides s ON s.source_module = m.id
          WHERE m._status != 'archived'
          GROUP BY m.id, m.title
          ORDER BY total_slides DESC;
        `,
        rollbackSQL: 'DROP VIEW IF EXISTS pdf_processing_stats',
      },
    ]
  }

  private async executeOptimizations(tasks: OptimizationTask[]): Promise<void> {
    for (const task of tasks) {
      console.log(`🔧 ${task.description}...`)
      
      try {
        // Execute the optimization
        await this.pool.query(task.sql)
        console.log(`   ✅ ${task.name} completed`)
        
      } catch (error: any) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log(`   ⚠️  ${task.name} already exists or table not found`)
        } else {
          console.error(`   ❌ Failed: ${task.name} - ${error.message}`)
          
          // Don't fail completely for medium/low priority tasks
          if (task.priority === 'critical' || task.priority === 'high') {
            throw error
          }
        }
      }
    }
  }

  private async updateTableStatistics(): Promise<void> {
    console.log('📊 Updating table statistics...')
    
    const tables = ['slides', 'modules', 'courses', 'media', 'users']
    
    for (const table of tables) {
      try {
        await this.pool.query(`ANALYZE ${table}`)
        console.log(`   ✅ ${table} statistics updated`)
      } catch (error) {
        console.log(`   ⚠️  Could not analyze ${table} (table may not exist)`)
      }
    }
  }

  private async verifyOptimizations(): Promise<void> {
    console.log('🔍 Verifying optimizations...')
    
    // Check that critical indexes were created
    const indexCheck = await this.pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE indexname IN (
        'idx_slides_source_lookup',
        'idx_slides_duplicate_check',
        'idx_slides_module_relationship',
        'idx_modules_slides_gin'
      )
      ORDER BY tablename, indexname
    `)
    
    console.log('   Created indexes:')
    for (const row of indexCheck.rows) {
      console.log(`     ✅ ${row.tablename}.${row.indexname}`)
    }
    
    // Test query performance
    try {
      const testQuery = `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT s.id, s.title, s.source_pdfPage
        FROM slides s 
        WHERE s.source_module = 1 
          AND s.source_pdfFilename = 'test.pdf'
        LIMIT 10
      `
      
      const result = await this.pool.query(testQuery)
      const plan = result.rows[0]['QUERY PLAN'][0]
      const executionTime = plan['Execution Time']
      
      console.log(`   📈 Sample query execution time: ${executionTime.toFixed(2)}ms`)
      
      if (executionTime < 10) {
        console.log('   ✅ Query performance is excellent!')
      } else if (executionTime < 50) {
        console.log('   ✅ Query performance is good')
      } else {
        console.log('   ⚠️  Query performance could be improved')
      }
      
    } catch (error) {
      console.log('   ⚠️  Could not test query performance (tables may be empty)')
    }

    // Check function creation
    const functionCheck = await this.pool.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN (
        'slide_exists_by_source',
        'bulk_insert_slides',
        'update_module_slide_count'
      )
    `)
    
    if (functionCheck.rows.length > 0) {
      console.log('   Created functions:')
      for (const row of functionCheck.rows) {
        console.log(`     ✅ ${row.proname}()`)
      }
    }
  }

  // Method to rollback optimizations if needed
  async rollback(): Promise<void> {
    console.log('🔄 Rolling back PDF processing optimizations...')
    
    const tasks = this.getOptimizationTasks().reverse() // Reverse order for rollback
    
    for (const task of tasks) {
      if (task.rollbackSQL) {
        try {
          await this.pool.query(task.rollbackSQL)
          console.log(`   ✅ Rolled back: ${task.name}`)
        } catch (error) {
          console.log(`   ⚠️  Could not rollback: ${task.name}`)
        }
      }
    }
    
    await this.pool.end()
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const optimizer = new PDFProcessingOptimizer()
  const command = process.argv[2]
  
  if (command === 'rollback') {
    optimizer.rollback()
      .then(() => {
        console.log('🎉 Rollback completed!')
        process.exit(0)
      })
      .catch((error) => {
        console.error('💥 Rollback failed:', error)
        process.exit(1)
      })
  } else {
    optimizer.optimize()
      .then(() => {
        console.log('🎉 PDF processing optimization completed!')
        console.log('\n💡 Next steps:')
        console.log('   1. Monitor query performance in production')
        console.log('   2. Run VACUUM ANALYZE during maintenance windows')
        console.log('   3. Consider pg_stat_statements for ongoing monitoring')
        console.log('   4. Test PDF processing performance improvements')
        process.exit(0)
      })
      .catch((error) => {
        console.error('💥 Optimization failed:', error)
        process.exit(1)
      })
  }
}

export { PDFProcessingOptimizer }