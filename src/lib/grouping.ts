import type { SoundGroup } from "../types";

export interface Section<T> {
  /** null = the implicit "ungrouped" bucket. */
  group: SoundGroup | null;
  /** Items in this section, each with its index in the original flat array. */
  entries: { item: T; index: number }[];
}

/**
 * Split a flat item list into ordered sections: the ungrouped bucket first
 * (only when non-empty), then each defined group in order (always shown, even
 * when empty, so a freshly created group is visible). Items whose groupId no
 * longer matches a group fall back to ungrouped. Order within a section
 * follows the original array.
 */
export function sectionize<T extends { groupId?: string }>(
  items: T[],
  groups: SoundGroup[],
): Section<T>[] {
  const known = new Set(groups.map((g) => g.id));
  const byGroup = new Map<string, { item: T; index: number }[]>();
  const ungrouped: { item: T; index: number }[] = [];

  items.forEach((item, index) => {
    const gid = item.groupId;
    if (gid && known.has(gid)) {
      const bucket = byGroup.get(gid) ?? [];
      bucket.push({ item, index });
      byGroup.set(gid, bucket);
    } else {
      ungrouped.push({ item, index });
    }
  });

  const sections: Section<T>[] = [];
  if (ungrouped.length > 0) sections.push({ group: null, entries: ungrouped });
  for (const g of groups) {
    sections.push({ group: g, entries: byGroup.get(g.id) ?? [] });
  }
  return sections;
}
