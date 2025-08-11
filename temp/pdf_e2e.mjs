import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'

const base = 'http://localhost:3000/api'

async function main() {
  try {
    const email = `dev+pdftest${Date.now()}@example.com`
    const password = 'Passw0rd123'

    console.log('Creating user:', email)
    let res = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: 'PDF Tester', password }),
    })
    let txt = await res.text()
    if (!res.ok) throw new Error(`Create user failed ${res.status} ${txt}`)
    console.log('✅ user created')

    console.log('Logging in...')
    res = await fetch(`${base}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Login failed ${res.status} ${t}`)
    }
    const setCookies = res.headers.raw()['set-cookie'] || []
    if (!setCookies.length) throw new Error('No set-cookie returned on login')
    const cookie = setCookies.map((c) => c.split(';')[0]).join('; ')
    console.log('✅ logged in')

    console.log('Uploading PDF to media...')
    const fd = new FormData()
    fd.append('file', fs.readFileSync('sample-local-pdf.pdf'), {
      filename: 'sample-local-pdf.pdf',
      contentType: 'application/pdf',
    })
    fd.append('alt', 'Sample PDF')

    res = await fetch(`${base}/media`, {
      method: 'POST',
      body: fd,
      headers: { ...fd.getHeaders(), cookie },
    })
    txt = await res.text()
    if (!res.ok) throw new Error(`Upload media failed ${res.status} ${txt}`)
    const media = JSON.parse(txt).doc
    console.log('✅ media id:', media.id, media.url || '(no url yet)')

    console.log('Creating module...')
    res = await fetch(`${base}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({
        title: 'PDF Proc Test Module',
        description: 'Module for PDF processing flow',
      }),
    })
    txt = await res.text()
    if (!res.ok) throw new Error(`Create module failed ${res.status} ${txt}`)
    const mod = JSON.parse(txt).doc
    console.log('✅ module id:', mod.id)

    console.log('Updating module with pdfUpload to trigger processing...')
    res = await fetch(`${base}/modules/${mod.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ pdfUpload: media.id }),
    })
    txt = await res.text()
    if (!res.ok) throw new Error(`Update module failed ${res.status} ${txt}`)
    console.log('✅ update accepted; waiting for processing...')

    const start = Date.now()
    let slidesCount = 0
    while (Date.now() - start < 60000) {
      // up to 60s
      await new Promise((r) => setTimeout(r, 5000))
      res = await fetch(`${base}/modules/${mod.id}?depth=0`, { headers: { cookie } })
      txt = await res.text()
      if (!res.ok) throw new Error(`Fetch module failed ${res.status} ${txt}`)
      const updated = JSON.parse(txt)
      slidesCount = Array.isArray(updated.slides) ? updated.slides.length : 0
      console.log(`Slides so far: ${slidesCount}`)
      if (slidesCount > 0) break
    }

    console.log('Final slides count:', slidesCount)
    console.log('Module ID:', mod.id, 'Media ID:', media.id)
  } catch (err) {
    console.error('E2E flow failed:', err.message || err)
    process.exit(1)
  }
}

main()
