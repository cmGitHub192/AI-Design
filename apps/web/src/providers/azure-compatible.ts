import type { AppConfig, ChatMessage } from '../types';
import type { StreamHandlers } from './anthropic';
import { streamProxyEndpoint, type ProxyContext } from './api-proxy';

export async function streamMessageAzure(
  cfg: AppConfig,
  system: string,
  history: ChatMessage[],
  signal: AbortSignal,
  handlers: StreamHandlers,
  // Threads projectId + byokImageModel so the daemon's Responses-API
  // `generate_image` tool can render into the active project (gpt-5.6 chat
  // models only serve the Responses API, where we wire the media dispatcher).
  context?: ProxyContext,
): Promise<void> {
  return streamProxyEndpoint('/api/proxy/azure/stream', cfg, system, history, signal, handlers, context);
}
