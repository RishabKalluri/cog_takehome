import type { AppDefinition } from "@/platform/registry";
import { manifest } from "./manifest";
import { actions } from "./actions";
import Page from "./page";

export default { manifest, actions, Page } satisfies AppDefinition;
