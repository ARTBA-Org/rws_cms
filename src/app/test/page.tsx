export default function TestPage() {
  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1>🚀 Deployment Test Page</h1>

      <div
        style={{
          padding: '16px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ color: '#16a34a', margin: '0 0 8px 0' }}>✅ Deployment Successful!</h2>
        <p style={{ color: '#15803d', margin: '0' }}>
          Your Next.js application is running successfully on AWS Amplify.
        </p>
      </div>

      <div
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <h3>Environment Information</h3>
        <ul>
          <li>
            <strong>Environment:</strong> {process.env.NODE_ENV || 'development'}
          </li>
          <li>
            <strong>Build Time:</strong> {new Date().toISOString()}
          </li>
          <li>
            <strong>Next.js:</strong> Running
          </li>
        </ul>
      </div>

      <div
        style={{
          padding: '16px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ color: '#92400e', margin: '0 0 8px 0' }}>📋 Available Routes</h3>
        <ul style={{ color: '#78350f', margin: '8px 0' }}>
          <li>
            <a href="/admin" style={{ color: '#2563eb' }}>
              /admin
            </a>{' '}
            - Payload CMS Admin Panel
          </li>
          <li>
            <a href="/api/health" style={{ color: '#2563eb' }}>
              /api/health
            </a>{' '}
            - Health Check API
          </li>
          <li>
            <a href="/pdf-import/test" style={{ color: '#2563eb' }}>
              /pdf-import/test
            </a>{' '}
            - PDF Import Test Page
          </li>
        </ul>
      </div>

      <div
        style={{
          padding: '16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ color: '#dc2626', margin: '0 0 8px 0' }}>⚠️ Production Limitations</h3>
        <p style={{ color: '#7f1d1d', margin: '0', fontSize: '14px' }}>
          PDF processing functionality is disabled in production due to server-side dependency
          requirements. This feature works fully in development mode.
        </p>
      </div>
    </div>
  )
}
