import type { Db } from "@/platform/db/client";
import { notes } from "./schema";

export function seed(db: Db) {
  db.insert(notes)
    .values([
      { body: "Welcome to the internal apps platform. This is the reference app.", authorId: "u-priya", authorName: "Priya Natarajan", createdAt: new Date(Date.now() - 86400000).toISOString() },
      { body: "Try switching users (top right) to see permissions change.", authorId: "u-sam", authorName: "Sam Chen", createdAt: new Date().toISOString() },
    ])
    .run();
}
