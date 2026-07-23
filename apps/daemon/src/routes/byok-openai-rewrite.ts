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
 * The route builds the *deployment-based* chat URL
 * (`<base>/deployments/<model>/chat/completions?api-version=…`) — the surface
 * an Azure resource actually serves, as opposed to `/openai/v1` which 401'd on
 * a live resource. The resource base, api-version, and credential all ride in
 * on request headers the daemon sets in the OpenCode provider config, so this
 * route holds no state and works for operator- and client-supplied keys alike.
 */

export const BYOK_OPENAI_REWRITE_PREFIX = '/internal/byok-openai/v1';
const AZURE_BASE_HEADER = 'x-od-azure-base';
const AZURE_API_VERSION_HEADER = 'x-od-azure-api-version';

/**
 * OpenCode is handed `{env:OPEN_DESIGN_BYOK_API_KEY}` as the `api-key` header
 * value and is expected to expand it from the child's environment. If it does
 * not, the literal placeholder is forwarded as the credential and Azure answers
 * 401 "Access denied due to invalid subscription key or wrong API endpoint" —
 * which reads as a bad key and sends operators auditing a key that was never
 * wrong. Fail here instead, naming the actual fault.
 */
const UNEXPANDED_CONFIG_PLACEHOLDER = /^\{(?:env|file):[^}]*\}$/;

function rewriteTokenParam(body: Record<string, unknown>): Record<string, unknown> {
  if ('max_tokens' in body && !('max_completion_tokens' in body)) {
    const { max_tokens, ...rest } = body;
    return { ...rest, max_completion_tokens: max_tokens };
  }
  return body;
}

/**
 * Azure rejects `reasoning_effort` when the same request carries function
 * tools, for the gpt-5.6 family on the chat surface:
 *
 *   "Function tools with reasoning_effort are not supported for gpt-5.6-terra
 *    in /v1/chat/completions. Please use /v1/responses instead."
 *
 * OpenCode sends both on every turn and exposes no lever to suppress either.
 * We cannot take Azure's advice and switch to `/v1/responses`: OpenCode drives
 * this through @ai-sdk/openai-compatible, which speaks chat/completions in both
 * directions, so that surface would need a full protocol adapter including
 * tool-call translation.
 *
 * Tools are load-bearing — the agent cannot read or write files without them —
 * while `reasoning_effort` is a hint. So the hint is what gives way, and only
 * when tools are actually present.
 */
function dropReasoningEffortWithTools(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const tools = body.tools;
  if (!Array.isArray(tools) || tools.length === 0) return body;
  if (!('reasoning_effort' in body)) return body;
  const { reasoning_effort, ...rest } = body;
  return rest;
}

/** Every adjustment the Azure chat surface needs, in one place. */
function normalizeAzureChatBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return (body ?? {}) as Record<string, unknown>;
  }
  return dropReasoningEffortWithTools(
    rewriteTokenParam(body as Record<string, unknown>),
  );
}

export function registerByokOpenAiRewriteRoutes(app: Express): void {
  app.post(
    `${BYOK_OPENAI_REWRITE_PREFIX}/chat/completions`,
    async (req: Request, res: Response) => {
      const azureBase = req.get(AZURE_BASE_HEADER);
      const apiKey = req.get('api-key');
      const apiVersion = req.get(AZURE_API_VERSION_HEADER);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const deployment = typeof body.model === 'string' ? body.model.trim() : '';
      if (!azureBase || !apiKey || !apiVersion || !deployment) {
        return res.status(400).json({
          error: {
            message: `missing ${AZURE_BASE_HEADER} / ${AZURE_API_VERSION_HEADER} / api-key header or body.model`,
          },
        });
      }

      if (UNEXPANDED_CONFIG_PLACEHOLDER.test(apiKey)) {
        console.error(
          `[byok-openai-rewrite] OpenCode forwarded an unexpanded credential placeholder for deployment=${deployment}`,
        );
        return res.status(500).json({
          error: {
            message:
              'OpenCode did not expand the api-key placeholder from its provider config, so no credential reached Azure. This is an Open Design/OpenCode integration fault, not an invalid Azure key.',
          },
        });
      }

      // SSRF guard — this route forwards to whatever base the header names.
      const validated = await validateUserProviderBaseUrl(azureBase);
      if (validated.error) {
        return res
          .status(validated.forbidden ? 403 : 400)
          .json({ error: { message: validated.error } });
      }

      // Build the deployment-based chat URL — the surface the resource serves.
      const targetUrl = new URL(
        `${azureBase.replace(/\/+$/, '')}/deployments/${encodeURIComponent(deployment)}/chat/completions`,
      );
      targetUrl.searchParams.set('api-version', apiVersion);
      const target = targetUrl.toString();
      // Deliberately logs the built path and never the key: this route is the
      // only place that sees what OpenCode actually asked Azure for.
      console.log(
        `[byok-openai-rewrite] POST ${validated.parsed?.hostname ?? '?'}${targetUrl.pathname} api-version=${apiVersion} keyLen=${apiKey.length}`,
      );
      const outboundBody = normalizeAzureChatBody(req.body);
      let upstream: Awaited<ReturnType<typeof fetch>>;
      try {
        upstream = await fetch(target, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'api-key': apiKey },
          body: JSON.stringify(outboundBody),
        });
      } catch (err) {
        return res.status(502).json({
          error: { message: `azure upstream unreachable: ${String((err as Error)?.message ?? err)}` },
        });
      }

      const contentType = upstream.headers.get('content-type');
      if (!upstream.ok) {
        // Buffer the failure body rather than piping it: Azure's rejection
        // reason is the only thing that explains which parameter or surface it
        // objected to, and OpenCode rewrites the message before it reaches the
        // UI. Failure bodies are small and never the streamed completion.
        const errorText = await upstream.text();
        console.error(
          `[byok-openai-rewrite] azure answered ${upstream.status} for ${targetUrl.pathname}: ${errorText.slice(0, 600)}`,
        );
        // Log what we sent too — the rejected parameter set is half the answer.
        console.error(
          `[byok-openai-rewrite] rejected request keys: ${Object.keys(outboundBody).join(',')}`,
        );
        res.status(upstream.status);
        if (contentType) res.setHeader('content-type', contentType);
        res.send(errorText);
        return;
      }
      res.status(upstream.status);
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
