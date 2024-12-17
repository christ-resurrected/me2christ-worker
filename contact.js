import { EmailMessage } from 'cloudflare:email'
import { createMimeMessage } from 'mimetext'

export default {
  async fetch(request, env) {
    try {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
      }

      const ip = request.headers.get("CF-Connecting-IP");
      const formData = await request.formData();
      const contact_name = formData.get("name");
      const contact_email = formData.get("email");
      const contact_message = formData.get("message");
      // const token = formData.get("cf-turnstile-response");
      // const tokenValidated = await validateToken(ip, token);
      // if (!tokenValidated) {
      //   return new Response("Token validation failed", { status: 403 });
      // }

      console.log(`handleRequest: ${ip} ${contact_name}, ${contact_email}, ${contact_message}`);
      console.log(`env: ${env.EMAIL_WORKER_ADDRESS} ${env.EMAIL_FORWARD_ADDRESS}`);

      const msg = createMimeMessage()
      // msg.setSender(env.EMAIL_WORKER_ADDRESS)
      msg.setSender(contact_email)
      msg.setRecipient(env.EMAIL_FORWARD_ADDRESS)
      msg.setSubject('Worker POST')
      msg.addMessage({
        contentType: 'text/plain',
        data: contact_message,
      })
      console.log(msg.asRaw())

      var em = new EmailMessage(env.EMAIL_WORKER_ADDRESS, env.EMAIL_FORWARD_ADDRESS, msg.asRaw())
      console.log(em)

      console.log('send...')
      await env.SEND_EMAIL.send(em)
      console.log('...ok')
      return new Response("OK", { status: 200 });

    } catch (e) {
      console.error(e);
      return new Response("Error sending message", { status: 500 });
    }
  }
}
