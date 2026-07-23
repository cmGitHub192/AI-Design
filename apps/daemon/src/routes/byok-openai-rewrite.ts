import type { Express, Request, Response } from 'express';
import { Readable } from 'node:stream';

import { validateUserProviderBaseUrl } from '../connectionTest.js';

/**
 * Raw pass-through that fixes one Azure incompatibility for OpenCode-driven
 * BYOK runs.
 *
 * OpenCode talks to Azure through @ai-sdk/openai-compatible, which always
 * sends `max_tokens`. The gpt-5 family on Azure rejects that
 * ("'max_tokens' is not supported with this model. Use
 * 'max_completion_tokens' instead."). We cannot change what OpenCode sends
 * (no config lever, no fetch hook over a JSON config), so the daemon points
 * OpenCode's baseURL at this route instead of at Azure directly. The route
 * renames the parameter and forwards the request verbatim, streaming the
 * response straight back.
 *
 * The real Azure `/openai/v1` base and the credential ride in on request
 * headers the daemon sets in the OpenCode provider config, so this route
 * holds no state and works for both operator- and client-supplied keys.
 */

export const BYOK_OPENAI_REWRITE_PREFIX = '/internal/byok-openai/v1';
const AZURE_BASE_HEADER = 'x-od-azure-base';

function rewriteTokenParam(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  if ('max_tokens' in record && !('max_completion_tokens' in record)) {
    const { max_tokens, ...rest } = record;
    return { ...rest, max_completion_tokens: max_tokens };
  }
  return record;
}

export function registerByokOpenAiRewriteRoutes(app: Express): void {
  app.post(
    `${BYOK_OPENAI_REWRITE_PREFIX}/chat/completions`,
    async (req: Request, res: Response) => {
      const azureBase = req.get(AZURE_BASE_HEADER);
      const apiKey = req.get('api-key');
      if (!azureBase || !apiKey) {
        return res
          .status(400)
          .json({ error: { message: `missing ${AZURE_BASE_HEADER} or api-key header` } });
      }

      // SSRF guard — this route forwards to whatever base the header names.
      const validated = await validateUserProviderBaseUrl(azureBase);
      if (validated.error) {
        return res
          .status(validated.forbidden ? 403 : 400)
          .json({ error: { message: validated.error } });
      }

      const target = `${azureBase.replace(/\/+$/, '')}/chat/completions`;
      let upstream: Awaited<ReturnType<typeof fetch>>;
      try {
        upstream = await fetch(target, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'api-key': apiKey },
          body: JSON.stringify(rewriteTokenParam(req.body ?? {})),
        });
      } catch (err) {
        return res.status(502).json({
          error: { message: `azure upstream unreachable: ${String((err as Error)?.message ?? err)}` },
        });
      }

      res.status(upstream.status);
      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('content-type', contentType);
      if (!upstream.body) {
        res.end();
        return;
      }
      // Stream the response straight through — SSE for stream:true, JSON
      // otherwise. Either way OpenCode reads the raw Azure bytes.
      Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream).pipe(res);
    },
  );
}
