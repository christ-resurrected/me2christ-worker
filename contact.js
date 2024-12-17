// import { EmailMessage } from 'cloudflare:email'
// import { createMimeMessage } from 'mimetext'

export default {
  async fetch(request, env) {
    try {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
      }

      const ip = request.headers.get("CF-Connecting-IP");
      const formData = await request.formData();
      const name = formData.get("name");
      const email = formData.get("email");
      const message = formData.get("message");
      // const token = formData.get("cf-turnstile-response");
      // const tokenValidated = await validateToken(ip, token);
      // if (!tokenValidated) {
      //   return new Response("Token validation failed", { status: 403 });
      // }

      console.log(`handleRequest: ${ip} ${name}, ${email}, ${message}`);
      console.log(`env: ${env.EMAIL_WORKER_ADDRESS} ${env.EMAIL_FORWARD_ADDRESS}`);
      console.log(`vars: ${env.S} ${env.X}`);

      // const msg = createMimeMessage()
      // // msg.setSender(env.EMAIL_WORKER_ADDRESS)
      // msg.setSender(email)
      // msg.setRecipient(env.EMAIL_FORWARD_ADDRESS)
      // msg.setSubject('Worker POST')
      // msg.addMessage({
      //   contentType: 'text/plain',
      //   data: message,
      // })
      //
      // console.log(msg)
      //
      // var em = new EmailMessage(env.EMAIL_WORKER_ADDRESS, env.EMAIL_FORWARD_ADDRESS, msg.asRaw())
      // await env.CF_MAILER.send(em)
      return new Response("OK", { status: 200 });

    } catch (e) {
      console.error(e);
      return new Response("Error sending message", { status: 500 });
    }
  }
}
