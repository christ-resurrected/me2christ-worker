import { EmailMessage } from 'cloudflare:email'
import { createMimeMessage } from 'mimetext'

export default {
  async fetch(request, env) {
    try {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
      }

      // const token = formData.get("cf-turnstile-response");
      // const tokenValidated = await validateToken(ip, token);
      // if (!tokenValidated) {
      //   return new Response("Token validation failed", { status: 403 });
      // }

      const formData = await request.formData();
      const contact_name = formData.get("name");
      const contact_email = formData.get("email");
      const contact_message = formData.get("message");

      console.log(`handleRequest: ${contact_name}, ${contact_email}, ${contact_message}`);
      // console.log(`env: ${env.EMAIL_WORKER_ADDRESS} ${env.EMAIL_FORWARD_ADDRESS}`);

      const msg = createMimeMessage()
      msg.setSender({ name: 'no-reply', addr: env.EMAIL_WORKER_ADDRESS })
      msg.setRecipient(env.EMAIL_FORWARD_ADDRESS)
      msg.setSubject('Message received from me2christ.com contact page')
      msg.addMessage({
        contentType: 'text/plain',
        data: `Name: ${contact_name}\nEmail: ${contact_email}\n\n${contact_message}`
      })
      var em = new EmailMessage(env.EMAIL_WORKER_ADDRESS, env.EMAIL_FORWARD_ADDRESS, msg.asRaw())
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
