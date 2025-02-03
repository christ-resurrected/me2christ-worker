import { EmailMessage } from 'cloudflare:email'
import { createMimeMessage } from 'mimetext' // CF worker build config must have "npm install mimetext"

export default {
  async fetch(request, env) {
    function generateResponse(text, status) {
      console.error(`generateResponse: ${status}, ${text}`);
      var r = new Response(text, { status: status }); // text is shown in browser error field
      r.headers.set('Access-Control-Allow-Origin', '*')
      return r
    }

    try {
      if (request.method === 'OPTIONS') { // allow CORS
        console.log('return CORS preflight OPTIONS response')
        return new Response('OK', {
          headers: {
            'Access-Control-Allow-Headers': '*', // What headers are allowed. * is wildcard.
            'Access-Control-Allow-Methods': 'HEAD,POST,OPTIONS', // Allowed methods. Others could be GET, PUT, DELETE etc.
            'Access-Control-Allow-Origin': '*', // This is URLs that are allowed to access the server.
          },
          status: 204
        });
      }

      if (request.method !== 'POST') return generateResponse(`Method ${request.method} not allowed`, 405)
      if (env.DISABLE_WORKER) return generateResponse('Service unavailable', 503)

      // rate limiter
      const { success } = await env.RATE_LIMITER.limit({ key: 'key' })
      if (!success) return generateResponse(`Too many requests. Please try again later.`, 429)

      // validate form fields
      const formData = await request.formData()
      const contact = { name: formData.get('name'), email: formData.get('email'), message: formData.get('message') }
      const validation = validateContact(contact)
      if (validation != null) return generateResponse(validation, 422)

      // validate turnstile token
      const ip = request.headers.get('CF-Connecting-IP')
      const tokenValidated = await validateToken(formData.get('cf-turnstile-response'), env, ip)
      if (!tokenValidated) return generateResponse('Token validation failed', 403)

      // send email
      await forwardMessage(contact, env)
      return generateResponse('<p>Thank you.</p>Your message has been successfully sent.<p>', 200)
    } catch (e) {
      console.log(e)
      return generateResponse('An internal server error occurred while sending the message, sorry!', 500)
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
  await env.SEND_EMAIL.send(m)
}

function validateContact(contact) {
  function errMin(id, n) { return `${id} must be at least ${n} characters` }
  function errMax(id, n) { return `${id} must be ${n} characters or less` }
  if (contact.name.length < 2) return errMin('Name', 2)
  if (contact.name.length > 40) return errMax('Name', 40)
  const rgxEmail = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/ // basic validation from MDN, should match browser's
  if (!rgxEmail.test(contact.email)) return 'Email must be a valid email address'
  if (contact.email.length > 40) return errMax('Email', 40)
  if (contact.message.length < 40) return errMin('Message', 40)
  if (contact.message.length > 800) return errMax('Message', 800)
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
