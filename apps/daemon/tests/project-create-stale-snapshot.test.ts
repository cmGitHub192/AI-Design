import type http from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startServer } from '../src/server.js';

/**
 * A client remembers an appliedPluginSnapshotId from a previous session, but
 * the daemon restarted and no longer holds it. POST /api/projects must not
 * dead-end on the stale id when the request also names a valid pluginId — it
 * re-resolves from the plugin and mints a fresh snapshot. (A 404 here bounced
 * every "send from home with a template" after a daemon restart.)
 */
describe('project create tolerates a stale applied-plugin snapshot', () => {
  let server: http.Server;
  let baseUrl: string;
  const projectsToClean: string[] = [];

  beforeAll(async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      url: string;
      server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterAll(async () => {
    for (const id of projectsToClean.splice(0)) {
      await fetch(`${baseUrl}/api/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function create(body: Record<string, unknown>) {
    const id = `stale-snap-${randomUUID()}`;
    projectsToClean.push(id);
    const resp = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    return { status: resp.status, body: (await resp.json()) as Record<string, any> };
  }

  it('re-resolves from the pluginId when the remembered snapshot is gone', async () => {
    const res = await create({
      name: 'Crea una landing',
      metadata: { kind: 'prototype', nameSource: 'prompt' },
      pendingPrompt: 'Crea una landing',
      pluginId: 'example-web-prototype',
      appliedPluginSnapshotId: 'snapshot-from-a-previous-session-9999',
      pluginInputs: {
        artifactKind: 'web prototype',
        fidelity: 'high-fidelity',
        audience: 'product evaluators',
      },
    });

    expect(res.status).toBe(200);
    // A fresh snapshot was minted — not the stale id the client sent.
    expect(res.body.appliedPluginSnapshotId).toBeTruthy();
    expect(res.body.appliedPluginSnapshotId).not.toBe(
      'snapshot-from-a-previous-session-9999',
    );
  });

  it('still 404s a stale snapshot with no pluginId to fall back on', async () => {
    const res = await create({
      name: 'No fallback',
      appliedPluginSnapshotId: 'snapshot-from-a-previous-session-9999',
    });

    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('snapshot-not-found');
  });
});
