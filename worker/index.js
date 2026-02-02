addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const jsonHeaders = {
  'content-type': 'application/json;charset=UTF-8',
}

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
}

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...jsonHeaders, ...corsHeaders } })
  }

  let body
  try {
    body = await request.json()
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...jsonHeaders, ...corsHeaders } })
  }

  const name = (body.name || '').toString().trim().slice(0, 200)
  const email = (body.email || '').toString().trim().slice(0, 320)
  const message = (body.message || '').toString().trim().slice(0, 5000)

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...jsonHeaders, ...corsHeaders } })
  }

  // SendGrid API
  const SENDGRID_KEY = SENDGRID_API_KEY || undefined
  const FROM = FROM_EMAIL || 'no-reply@chaos.isibangalore'
  const TO = TO_EMAIL || 'chaos.isibangalore@gmail.com'

  if (!SENDGRID_KEY) {
    return new Response(JSON.stringify({ error: 'Mail sender not configured' }), { status: 500, headers: { ...jsonHeaders, ...corsHeaders } })
  }

  const payload = {
    personalizations: [
      {
        to: [{ email: TO }],
        subject: `CHAOS website contact - ${name}`,
      },
    ],
    from: { email: FROM },
    reply_to: { email },
    content: [
      { type: 'text/plain', value: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}` },
      { type: 'text/html', value: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><hr/><p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>` },
    ],
  }

  try {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (resp.status === 202 || resp.ok) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...jsonHeaders, ...corsHeaders } })
    }

    const text = await resp.text()
    return new Response(JSON.stringify({ error: 'Failed to send', details: text }), { status: 502, headers: { ...jsonHeaders, ...corsHeaders } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to send', details: err.message || String(err) }), { status: 500, headers: { ...jsonHeaders, ...corsHeaders } })
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  })
}
