import { amrAgentDef } from './defs/amr.js';
import { codexAgentDef } from './defs/codex.js';
import { byokOpenCodeAgentDef } from './defs/byok-opencode.js';
import { antigravityAgentDef } from './defs/antigravity.js';
import { readLocalAgentProfileDefs as readLocalAgentProfileDefsFromFile } from './local-profiles.js';
import type { RuntimeAgentDef } from './types.js';

/**
 * This product talks to its model provider over HTTP; it does not shell out
 * to a third-party coding CLI. The twenty-two adapters for claude, codex-cli,
 * cursor-agent, opencode, and the rest were removed because nothing here
 * launches them.
 *
 * What remains is not an endorsement of these four as agents — `amr`,
 * `codex`, and `antigravity` still have callers elsewhere in the daemon
 * (connection tests, media sandbox flags, a dynamic import in server.ts), and
 * `byok-opencode` carries the operator-credential translation. Untangling
 * those callers is its own change; until then the defs stay so the registry
 * keeps a valid shape.
 */
const BASE_AGENT_DEFS: RuntimeAgentDef[] = [
  amrAgentDef,
  codexAgentDef,
  byokOpenCodeAgentDef,
  antigravityAgentDef,
];

export function readLocalAgentProfileDefs(
  baseDefs: RuntimeAgentDef[] = BASE_AGENT_DEFS,
): RuntimeAgentDef[] {
  return readLocalAgentProfileDefsFromFile(baseDefs);
}

export const AGENT_DEFS: RuntimeAgentDef[] = [
  ...BASE_AGENT_DEFS,
  ...readLocalAgentProfileDefs(BASE_AGENT_DEFS),
];

const ids = new Set();
for (const def of AGENT_DEFS) {
  if (ids.has(def.id)) {
    throw new Error(`Duplicate agent definition id: ${def.id}`);
  }
  ids.add(def.id);
}

export function getAgentDef(id: string): RuntimeAgentDef | null {
  return AGENT_DEFS.find((a) => a.id === id) || null;
}
