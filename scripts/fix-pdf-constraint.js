import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function fixPdfConstraint() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URI,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    
    // First, check if the modules table has pdf_upload_id column
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'modules' 
      AND column_name = 'pdf_upload_id'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('Found pdf_upload_id column in modules table');
      
      // Clear any invalid pdf_upload_id values
      const result = await pool.query(`
        UPDATE modules 
        SET pdf_upload_id = NULL 
        WHERE pdf_upload_id IS NOT NULL
      `);
      
      console.log(`Cleared ${result.rowCount} invalid pdf_upload_id references`);
    } else {
      console.log('No pdf_upload_id column found - will be created by Payload');
    }
    
    // Check if pdfs table exists
    const checkTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'pdfs'
    `);
    
    if (checkTable.rows.length === 0) {
      console.log('pdfs table does not exist yet - will be created by Payload');
    } else {
      console.log('pdfs table already exists');
    }
    
    console.log('Database cleanup complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixPdfConstraint();