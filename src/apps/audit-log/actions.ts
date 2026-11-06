import { defineActions } from "@/platform/actions/define";
import { manifest } from "./manifest";

/** Read-only app: it declares no actions, so nothing here can write data. */
export const actions = defineActions(manifest, {});
