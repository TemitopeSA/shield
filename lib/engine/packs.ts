import type { CorePack, RulePack, ShieldState } from "../types";
import core from "@/rules/core.json";
import pea from "@/rules/pea.json";
import peaPme from "@/rules/pea_pme.json";
import isk from "@/rules/isk.json";
import pir from "@/rules/pir.json";
import ike from "@/rules/ike.json";

export const CORE_PACK = core as CorePack;

/** Rule packs shipped with the engine, keyed by the file they came from. */
export const BUILTIN_PACKS: { file: string; pack: RulePack }[] = [
  { file: "pea.json", pack: pea as RulePack },
  { file: "pea_pme.json", pack: peaPme as RulePack },
  { file: "isk.json", pack: isk as RulePack },
  { file: "pir.json", pack: pir as RulePack },
  { file: "ike.json", pack: ike as RulePack },
];

export const DEFAULT_ACTIVE = ["PEA", "ISK", "PIR"];

export function allPacks(state: Pick<ShieldState, "custom_packs">): RulePack[] {
  const builtins = BUILTIN_PACKS.map((b) => b.pack);
  const custom = state.custom_packs.filter((c) => !builtins.some((b) => b.wrapper === c.wrapper));
  return [...builtins, ...custom];
}

export function activePacks(state: Pick<ShieldState, "custom_packs" | "active_wrappers">): RulePack[] {
  return allPacks(state).filter((p) => state.active_wrappers.includes(p.wrapper));
}

export function getPack(state: Pick<ShieldState, "custom_packs">, wrapper: string): RulePack | undefined {
  return allPacks(state).find((p) => p.wrapper === wrapper);
}

export const packFile = (wrapper: string) =>
  BUILTIN_PACKS.find((b) => b.pack.wrapper === wrapper)?.file ?? `${wrapper.toLowerCase()}.json`;

/** Contribution limits are derived from the rule pack itself, never duplicated. */
export function contributionLimits(pack: RulePack): { lifetime: number | null; annual: number | null } {
  const out = { lifetime: null as number | null, annual: null as number | null };
  for (const r of pack.rules) {
    if (r.kind !== "contribution_limit") continue;
    const period = r.params.period as "lifetime" | "annual";
    out[period] = r.params.limit as number;
  }
  return out;
}
