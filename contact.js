import { EmailMessage } from 'cloudflare:email'
import { createMimeMessage } from 'mimetext'

export default {
  async fetch(request, env) {
    try {
      // text is shown in browser error field
      function generateResponse(text, status) {
        console.error(`generateResponse: ${text} ${status}`);
        var r = new Response(text, { status: status });
        r.headers.set('Access-Control-Allow-Origin', '*')
        return r
      }

      if (request.method !== 'POST') return generateResponse(`Method ${request.method} not allowed`, 405)
      if (env.DISABLE_WORKER) return generateResponse('Service unavailable', 503)

      // rate limiter
      const { pathname } = new URL(request.url)
      const { success } = await env.RATE_LIMITER.limit({ key: pathname })
      if (!success) return new generateResponse(`Rate limit exceeded for ${pathname}`, 429)

      // validate form fields
      const formData = await request.formData()
      const contact = getContact(formData)
      const validation = validateContact(contact)
      if (validation != null) return generateResponse(validation, 422)

      // validate turnstile token
      const ip = request.headers.get('CF-Connecting-IP')
      const tokenValidated = await validateToken(formData.get('cf-turnstile-response'), env, ip)
      if (!tokenValidated) return generateResponse('Token validation failed', 403)

      // send email
      await forwardMessage(contact, env)
      return generateResponse('OK', 200)
    } catch (e) {
      return generateResponse('Error sending message', 500)
    }
  }
}

async function forwardMessage(contact, env) {
  console.log(`forwardMessage: ${contact.name}, ${contact.email}, ${contact.message}`)
  // console.log(`env: ${ env.EMAIL_WORKER_ADDRESS } ${ env.EMAIL_FORWARD_ADDRESS }`)
  const msg = createMimeMessage()
  msg.setSender({ name: 'no-reply', addr: env.EMAIL_WORKER_ADDRESS })
  msg.setRecipient(env.EMAIL_FORWARD_ADDRESS)
  msg.setSubject('Message received from me2christ.com contact page')
  msg.addMessage({
    contentType: 'text/plain',
    data: `Name: ${contact.name}\nEmail: ${contact.email}\n\n${contact.message}`
  })
  var m = new EmailMessage(env.EMAIL_WORKER_ADDRESS, env.EMAIL_FORWARD_ADDRESS, msg.asRaw())
  console.log('send...')
  await env.SEND_EMAIL.send(m)
  console.log('...done')
}

function getContact(formData) {
  const contact = {}
  contact.name = formData.get('name')
  contact.email = formData.get('email')
  contact.message = formData.get('message')
  return contact
}

function validateContact(contact) {
  if (contact.name.length < 2) return 'Name must be at least 2 characters'
  if (contact.name.length > 40) return 'Name must be at most 40 characters'
  const rgxEmail = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (!rgxEmail.test(contact.email)) return 'Email must be a valid email address'
  if (contact.email.length > 40) return 'Email must be at most 40 characters'
  if (contact.message.length < 20) return 'Message must be at least 20 characters'
  if (contact.message.length > 1000) return 'Message must be at most 1,000 characters'
}

async function validateToken(token, env, ip) {
  console.log(`validateToken: ${token}`)
  const body = new FormData()
  body.append('secret', env.TURNSTILE_SECRET_KEY)
  body.append('response', token)
  body.append('remoteip', ip)
  const URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
  const result = await fetch(URL, { body: body, method: 'POST', });
  return (await result.json()).success
}
