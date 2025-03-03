import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

// Check if we're in development or production
const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

// Initialize Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Log environment variables for debugging (masking sensitive data)
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PGHOST: process.env.PGHOST ? '✓ Set' : '✗ Not set',
  PGPORT: process.env.PGPORT || '5432',
  PGDATABASE: process.env.PGDATABASE ? '✓ Set' : '✗ Not set',
  PGUSER: process.env.PGUSER ? '✓ Set' : '✗ Not set',
  PGPASSWORD: process.env.PGPASSWORD ? '✓ Set' : '✗ Not set',
  PGSSLMODE: process.env.PGSSLMODE || 'no-verify',
  DATABASE_URI: process.env.DATABASE_URI ? '✓ Set' : '✗ Not set',
  NEXT_BUILD_SKIP_DB: process.env.NEXT_BUILD_SKIP_DB,
})

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Parse the URL
      const parsedUrl = parse(req.url, true)

      // Let Next.js handle the request
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling request:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
