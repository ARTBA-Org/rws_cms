import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'

const base = 'http://localhost:3000/api'
const filePath =
  '/Users/abenezernuro/projects/Expos/rws_cms/pdf-processor-service/Lighting for Night Work Deck.pdf'

async function main() {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF not found at: ${filePath}`)
    }

    const email = `dev+apa${Date.now()}@example.com`
    const password = 'Passw0rd123'

    // Create user
    let res = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: 'APA Tester', password }),
    })
    let txt = await res.text()
    if (!res.ok) throw new Error(`Create user failed ${res.status} ${txt}`)

    // Login
    res = await fetch(`${base}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error(`Login failed ${res.status} ${await res.text()}`)
    const setCookies = res.headers.raw()['set-cookie'] || []
    if (!setCookies.length) throw new Error('No set-cookie returned on login')
    const cookie = setCookies.map((c) => c.split(';')[0]).join('; ')

    // Upload PDF to media
    const fd = new FormData()
    const buffer = fs.readFileSync(filePath)
    fd.append('file', buffer, {
      filename: 'Lighting-for-Night-Work-Deck.pdf',
      contentType: 'application/pdf',
    })
    fd.append('alt', 'Lighting Deck')
    res = await fetch(`${base}/media`, {
      method: 'POST',
      body: fd,
      headers: { ...fd.getHeaders(), cookie },
    })
    txt = await res.text()
    if (!res.ok) throw new Error(`Upload media failed ${res.status} ${txt}`)
    const media = JSON.parse(txt).doc

    // Create module
    res = await fetch(`${base}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ title: 'Lighting Deck (APA test)', description: 'APA test module' }),
    })
    txt = await res.text()
    if (!res.ok) throw new Error(`Create module failed ${res.status} ${txt}`)
    const mod = JSON.parse(txt).doc

    // Link PDF (not required for process endpoint but keeps module consistent)
    await fetch(`${base}/modules/${mod.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ pdfUpload: media.id }),
    })

    // Invoke process-module-pdf (uses Python service)
    res = await fetch(`${base}/process-module-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: String(mod.id) }),
    })
    txt = await res.text()
    if (!res.ok) throw new Error(`process-module-pdf failed ${res.status} ${txt}`)
    const result = JSON.parse(txt)

    // Print concise summary
    const summary = {
      success: result.success,
      page_count: result.page_count,
      filename: result.filename,
      first_page: result.results?.[0]?.page,
      first_title: result.results?.[0]?.analysis?.title,
      first_topic: result.results?.[0]?.analysis?.topic,
    }
    console.log(JSON.stringify(summary, null, 2))
  } catch (err) {
    console.error('APA test failed:', err.message || err)
    process.exit(1)
  }
}

main()
