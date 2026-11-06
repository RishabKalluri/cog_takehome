import type { AppDefinition } from "@/platform/registry";
import { manifest } from "./manifest";
import { actions } from "./actions";
import Page from "./page";
import { seed } from "./seed";

export default { manifest, actions, Page, seed } satisfies AppDefinition;
