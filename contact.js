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

      const ip = request.headers.get('CF-Connecting-IP')
      const formData = await request.formData()
      const tokenValidated = await validateToken(formData.get('cf-turnstile-response'), env, ip)
      if (!tokenValidated) return generateResponse('Token validation failed', 403)
      await forwardMessage(formData, env)
      return generateResponse('OK', 200)
    } catch (e) {
      return generateResponse('Error sending message', 500)
    }
  }
}

async function forwardMessage(formData, env) {
  const contact_name = formData.get('name')
  const contact_email = formData.get('email')
  const contact_message = formData.get('message')
  console.log(`forwardMessage: ${contact_name}, ${contact_email}, ${contact_message}`)
  // console.log(`env: ${ env.EMAIL_WORKER_ADDRESS } ${ env.EMAIL_FORWARD_ADDRESS }`)

  const msg = createMimeMessage()
  msg.setSender({ name: 'no-reply', addr: env.EMAIL_WORKER_ADDRESS })
  msg.setRecipient(env.EMAIL_FORWARD_ADDRESS)
  msg.setSubject('Message received from me2christ.com contact page')
  msg.addMessage({
    contentType: 'text/plain',
    data: `Name: ${contact_name}\nEmail: ${contact_email}\n\n${contact_message}`
  })
  var m = new EmailMessage(env.EMAIL_WORKER_ADDRESS, env.EMAIL_FORWARD_ADDRESS, msg.asRaw())
  console.log('send...')
  await env.SEND_EMAIL.send(m)
  console.log('...done')
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
