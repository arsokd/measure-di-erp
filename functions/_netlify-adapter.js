// Every function here started life as a Netlify Function: an
// `async (event) => ({ statusCode, headers, body })` handler, where
// `event.httpMethod` / `event.headers` / `event.body` (a raw string) come
// from AWS Lambda's event shape. Rather than rewrite 8 functions' worth of
// request/response handling - including password-reset and email-sending
// logic that's live in production - this adapter lets each function keep
// that exact same handler body unchanged, and only translates Firebase
// Functions' Express-style (req, res) into the same shape on the way in,
// and back out again on the way out. The actual authorization, validation
// and business logic of every function is untouched by this file.
export function adaptNetlifyHandler(netlifyHandler) {
  return async function (req, res) {
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      // req.rawBody is the exact raw request body Firebase Functions
      // already buffers for every invocation (Buffer, UTF-8 safe) -
      // using it directly (rather than re-stringifying the
      // already-parsed req.body) mirrors Netlify's event.body exactly,
      // including for a body each handler re-parses with JSON.parse
      // itself.
      body: req.rawBody ? req.rawBody.toString('utf-8') : ''
    };

    let result;
    try {
      result = await netlifyHandler(event);
    } catch (err) {
      console.error('Unhandled error in a Netlify-style function handler:', err);
      res.status(500).set('Content-Type', 'application/json').send(
        JSON.stringify({ error: (err && err.message) || 'Internal server error.' })
      );
      return;
    }

    const resultHeaders = (result && result.headers) || {};
    res.status((result && result.statusCode) || 200);
    Object.keys(resultHeaders).forEach(function (key) {
      res.set(key, resultHeaders[key]);
    });
    res.send(result && result.body !== undefined ? result.body : '');
  };
}
