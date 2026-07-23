/**
 * Which Azure OpenAI surface a deployment answers on.
 *
 * Most Azure deployments serve the deployment-scoped chat surface
 * (`/openai/deployments/<name>/chat/completions`). The gpt-5.6 family
 * (`sol`/`luna`/`terra`) does not: it only serves the Responses API at
 * `/openai/responses`, with the deployment carried in the body as `model`.
 *
 * Hitting the chat surface for one of those deployments does not fail with a
 * clear 404. The Cognitive Services gateway finds no matching operation and
 * answers 401 "Access denied due to invalid subscription key or wrong API
 * endpoint", which reads as a credential problem and sends operators hunting
 * for a key that was never wrong.
 *
 * Azure exposes no per-deployment capability field we can read before the
 * first call, so the deployment name is the only signal available up front.
 * Deployment names are operator-chosen, but the portal defaults to the model
 * id, so `gpt-5.6-*` is the shape in practice.
 *
 * This predicate is the single source of truth for that routing decision.
 * Both the connection test and the chat proxy must call it, so "Test
 * connection" can never pass against a surface the run then fails on.
 */
export function azureDeploymentUsesResponsesApi(
  deployment: string | null | undefined,
): boolean {
  return /gpt-5\.6/i.test(deployment ?? '');
}

/**
 * The Responses API did not exist before this api-version, so the `2024-10-21`
 * default the chat surface uses would 404 here.
 */
export const AZURE_RESPONSES_API_VERSION = '2025-04-01-preview';
