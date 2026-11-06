import { z } from "zod";
import { eq } from "drizzle-orm";
import { action, ActionError, defineActions } from "@/platform/actions/define";
import { manifest } from "./manifest";
import { notes } from "./schema";

export const actions = defineActions(manifest, {
  postNote: action(z.object({ body: z.string().trim().min(1, "Note cannot be empty").max(500) }), ({ db, user }, input) => {
    const row = db
      .insert(notes)
      .values({ body: input.body, authorId: user.id, authorName: user.name, createdAt: new Date().toISOString() })
      .returning()
      .get();
    return { entityId: String(row.id), after: row, message: "Note posted." };
  }),

  deleteNote: action(z.object({ id: z.coerce.number().int() }), ({ db }, input) => {
    const before = db.select().from(notes).where(eq(notes.id, input.id)).get();
    if (!before) throw new ActionError("Note not found", "not_found");
    db.delete(notes).where(eq(notes.id, input.id)).run();
    return { entityId: String(input.id), before, message: "Note deleted." };
  }),
});
