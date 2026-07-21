import type { ByokChatProtocol } from './chat.js';

export interface AgentModelPrefs {
  model?: string;
  reasoning?: string;
}

export type AgentCliEnvPrefs = Record<string, Record<string, string>>;
export type AgentCliEnvIntentPrefs = Record<string, { apiKeyOverride?: boolean }>;

export interface TelemetryPrefs {
  metrics?: boolean;
  content?: boolean;
  artifactManifest?: boolean;
}

export interface OrbitConfigPrefs {
  enabled: boolean;
  /** Local 24-hour clock time in HH:mm format. Defaults to 08:00. */
  time: string;
  /** Optional skill id from the examples gallery where scenario === "orbit". */
  templateSkillId?: string | null;
}

export interface ProjectLocationPrefs {
  id: string;
  name: string;
  path: string;
}

export interface AppConfigPrefs {
  onboardingCompleted?: boolean;
  agentId?: string | null;
  agentModels?: Record<string, AgentModelPrefs>;
  agentCliEnv?: AgentCliEnvPrefs;
  agentCliEnvIntent?: AgentCliEnvIntentPrefs;
  skillId?: string | null;
  designSystemId?: string | null;
  disabledSkills?: string[];
  disabledDesignSystems?: string[];
  installationId?: string | null;
  telemetry?: TelemetryPrefs;
  /**
   * Unix-millis timestamp of when the user resolved the first-run privacy
   * consent surface (Share or Decline). Set on first decision and on
   * subsequent toggles in Settings → Privacy. Independent of
   * installationId so that "Delete my data" can rotate the id without
   * re-popping the consent banner.
   */
  privacyDecisionAt?: number | null;
  allowSilentUpdates?: boolean;
  orbit?: OrbitConfigPrefs;
  customInstructions?: string | null;
  /** External project library roots. The daemon adds its built-in .od/projects location at read time. */
  projectLocations?: ProjectLocationPrefs[];
  /** Project location id used for new projects when the create request does not choose one explicitly. */
  defaultProjectLocationId?: string | null;
  /**
   * Most-recently-used local working directories the user granted the agent
   * read access to (via the Home composer's working-directory picker). These
   * become a new project's `metadata.linkedDirs` — the agent perceives them
   * through `--add-dir`; they are NOT imported into Design Files. Stored
   * most-recent-first and capped by the daemon.
   */
  recentLinkedDirs?: string[];
}

/**
 * Operator-owned BYOK state, derived from the daemon's environment.
 *
 * This is deliberately NOT part of `AppConfigPrefs`. Prefs are user-writable
 * (`UpdateAppConfigRequest` is a `Partial` of them, and the daemon allowlists
 * the keys it accepts); this is read-only deployment truth. Keeping it a
 * sibling of `config` in the response means there is no request shape that
 * could forge it.
 *
 * Carries no credential. The daemon reports only whether a key exists and the
 * non-secret identity of the provider it belongs to, so the UI can stop asking
 * the user for a key it will never need. See `byok-server-defaults.ts`.
 */
export interface ServerByokStatus {
  /** True when the daemon can serve model traffic without a client credential. */
  configured: boolean;
  /** Protocol the operator declared, present only when `configured`. */
  protocol?: ByokChatProtocol;
  /** Operator's default model, when they pinned one. Display only. */
  model?: string;
}

export interface AppConfigResponse {
  config: AppConfigPrefs;
  /**
   * Absent on older daemons; treat a missing value as "not configured" so a
   * local-first install keeps demanding the user's own key.
   */
  serverByok?: ServerByokStatus;
}

export type UpdateAppConfigRequest = Partial<AppConfigPrefs>;

/** Response body for `GET /api/recent-dirs` — recent working directories
 *  pruned to those that still exist on disk, most-recent-first. */
export interface RecentLinkedDirsResponse {
  dirs: string[];
}
