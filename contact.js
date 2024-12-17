import { EmailMessage } from 'cloudflare:email'
import { createMimeMessage } from 'mimetext'

export default {
  async fetch(request, env) {
    try {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
      }
      const ip = request.headers.get("CF-Connecting-IP")
      const formData = await request.formData()
      const tokenValidated = await validateToken(formData, ip)
      if (!tokenValidated) {
        return new Response("Token validation failed", { status: 403 })
      }
      await forwardMessage(formData, env)
      return new Response("OK", { status: 200 })
    } catch (e) {
      console.error(e);
      return new Response("Error sending message", { status: 500 })
    }
  }
}

async function forwardMessage(formData, env) {
  const contact_name = formData.get("name")
  const contact_email = formData.get("email")
  const contact_message = formData.get("message")
  console.log(`forwardMessage: ${contact_name}, ${contact_email}, ${contact_message}`)
  // console.log(`env: ${env.EMAIL_WORKER_ADDRESS} ${env.EMAIL_FORWARD_ADDRESS}`)

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

async function validateToken(formData, ip) {
  const TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA'
  const token = formData.get("cf-turnstile-response")
  console.log(`token: ${token}`)

  const body = new FormData()
  body.append('secret', TURNSTILE_SECRET_KEY)
  body.append('response', token)
  body.append('remoteip', ip)

  const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
  const result = await fetch(url, {
    body: body,
    method: 'POST',
  });

  const outcome = await result.json()
  return outcome.success;
}
