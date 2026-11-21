# Channel Creation Flows — Working Patterns & Pitfalls

This document documents the correct approaches for creating and programming Tunarr channels via the MCP server, based on real-world usage patterns. Use these as reference when building or troubleshooting channel creation flows.

---

## 1. Single-Show Channel (Recommended — Semantic Tools)

The simplest and most reliable approach is to use the built-in semantic tools that handle the entire flow in a single call.

### `create_channel_from_show`

Creates a new channel and attaches a show's episodes as its lineup in one call.

```
Tool: create_channel_from_show
Arguments:
  channelName: "Addams Family Channel"
  showId: "The Addams Family"          ← UUID, external id (TMDb/IMDb), or title — auto-resolved
  lineUp: "random"                      ← "ordered" | "chronological" | "random" | "next"
  channelNumber: 50                     ← optional, defaults to 0
  groupTitle: "Cartoons"                ← optional, defaults to channelName
  guideFlexTitle: "..."                 ← optional
  seasonId: "..."                       ← optional: one specific season (by UUID)
  includeAllSeasons: true               ← optional: every season (overrides seasonId)
  transcodeConfigId: "..."              ← optional; use list_transcode_configs to see options
```

**What happens internally:**
1. `resolveShow(showId)` — resolves the title/external ID to a Tunarr show UUID
2. `createChannel({...})` — creates the channel with type `"new"`
3. `addProgramToChannel(...)` — attaches the chosen season(s) to the lineup (default: first season)

**Returns:** `{ createdChannel, resolvedShow, channelId }`

### `add_show_to_channel`

Attaches a show to an **existing** channel without disturbing its current lineup. Uses `append: true`.

```
Tool: add_show_to_channel
Arguments:
  channelId: "abc-123-def"              ← existing channel ID
  showId: "The Addams Family"           ← UUID, external id, or title
  lineUp: "random"                      ← optional, defaults to "ordered"
  seasonId: "..."                       ← optional: one specific season
  includeAllSeasons: true               ← optional: every season (overrides seasonId)
```

**Returns:** `{ attached, resolvedShow }`

### `get_episode_list`

List episodes for a show (useful for debugging or verifying content exists).

```
Tool: get_episode_list
Arguments:
  showId: "The Addams Family"           ← UUID, external id, or title
  seasonId: "..."                       ← optional, limits to one season
```

---

## 2. Single-Show Channel (Manual — Advanced)

For full control over the schedule structure, you can build the channel manually through its component steps. This is the flow described in the user's notes.

### Step-by-step:

#### Step 1: Find the show and get its UUID

```
Tool: lookup_program or lookup_by_external_id
Arguments: id: "tt0098722"   ← IMDb ID, or use search/lookup to find by title
```

Returns the show object with its Tunarr UUID (e.g., `9ef1d9bb-27d1-4f18-a516-e958ecc8cc87`).

#### Step 2: Create the channel

```
Tool: create_channel
Arguments: body: {
  name: "Addams Family Channel",
  type: "new",
  number: 50,
  groupTitle: "Cartoons"
}
```

#### Step 3: Add a schedule slot with type "show"

```
Tool: add_schedule_slot
Arguments:
  channelId: "<channel-id-from-step-2>"
  body: {
    schedule: {
      type: "random",                  ← or "sequential"
      flexPreference: "distribute",
      maxDays: 30,
      padMs: 0,
      padStyle: "episode",
      slots: [
        {
          id: "unique-slot-uuid",
          cooldownMs: 0,
          weight: 1,
          order: "shuffle",            ← or "next" for sequential
          type: "show",                ← KEY: use type "show", not "collection"
          showId: "<the-show-uuid>"    ← the UUID from step 1
        }
      ],
      randomDistribution: "uniform"
    }
  }
```

**Key insight:** For a single show, set `type: "show"` in the schedule slot and provide the show's UUID as `showId`. This auto-resolves all episodes from that show into the channel lineup. **Skip smart collections entirely for single shows.**

#### Step 4: Verify

```
Tool: get_channel_programming
Arguments: id: "<channel-id>"
```

Confirm that the channel has a schedule slot referencing the show and episodes are resolving into the lineup. Use `get_channel_lineup` to see the compiled playback order.

---

## 3. Multi-Show / Themed Channel (Smart Collections)

For channels with content from multiple shows or based on themes, use smart collections.

### Step-by-step:

#### Step 1: Create a smart collection

```
Tool: create_smart_collection
Arguments: body: {
  name: "Action Movies",
  keywords: ["action", "adventure"],
  filterString: "",                    ← or use filter rules
  mediaSourceIds: [...]                ← which sources to search
}
```

#### Step 2: Create the channel and reference the collection in a schedule slot

```
Tool: add_schedule_slot
Arguments:
  channelId: "<channel-id>"
  body: {
    schedule: {
      slots: [
        {
          id: "unique-slot-uuid",
          type: "smart-collection",     ← use type "smart-collection"
          smartCollectionId: "<collection-uuid>"
        }
      ]
    }
  }
```

**Caveat:** Smart collection keyword matching can fail silently if the keywords don't match any programs in your media sources. Always verify with `get_channel_programming` afterward.

---

## 4. What Doesn't Work (Pitfalls to Avoid)

### ❌ Smart collections for single shows with narrow keywords
Creating a smart collection with overly specific or incorrect keywords → zero matches, fails silently. The channel gets created but has no content.

**Fix:** Use `create_channel_from_show` for single shows instead.

### ❌ `add_program_to_channel` with incorrect body schemas
Passing the wrong structure (e.g., missing `type`, `lineup`, or `append` fields) → validation errors from Tunarr's ASP.NET Core backend.

**Fix:** Use the semantic tool `create_channel_from_show` which assembles the correct body automatically.

### ❌ Manual episode assembly
Trying to iterate through every episode and add them individually with their UUIDs and durations → fragile, error-prone, and unnecessary.

**Fix:** The semantic tools resolve the show's seasons and episodes automatically via `season: { order, direction }`.

### ❌ Using `type: "collection"` instead of `type: "show"` in schedule slots
When manually building a single-show channel, using the wrong slot type → Tunarr can't resolve the content.

**Fix:** Use `type: "show"` with `showId` for single shows; use `type: "smart-collection"` with `smartCollectionId` for themed channels.

---

## 5. Quick Reference — Which Tool to Use

| Scenario | Recommended Tool(s) |
|----------|-------------------|
| Create channel from one show | `create_channel_from_show` |
| Add a show to existing channel | `add_show_to_channel` |
| Find a show by title | `search_shows` |
| List episodes of a show | `get_episode_list` |
| Choose a transcode config | `list_transcode_configs` |
| Multi-show themed channel | `create_smart_collection` + `add_schedule_slot` (type: "smart-collection") |
| Full manual control over schedule slots | Manual: `create_channel` → `add_schedule_slot` (type: "show") |
| Debug what's on a channel | `get_channel_programming` + `get_channel_lineup` |

---

## 6. Verification Checklist

After any channel creation or modification:

1. **`get_channel_programming`** — Confirm schedule slots exist and reference the correct shows/collections
2. **`get_channel_lineup`** — Check that episodes are resolving into the compiled playback order
3. **`list_channel_lineups`** — Quick overview of all channels' lineups
4. **Episode count matches expectations** — If `totalPrograms` is zero or unexpected, something went wrong

---

## 7. Example: Complete Single-Show Flow (Addams Family)

```
# Step 1: Create the channel with the show's episodes in one call
create_channel_from_show(
  channelName: "Addams Family Channel",
  showId: "The Addams Family",     # resolves automatically
  lineUp: "random",                 # shuffle episodes
  channelNumber: 50
)

# Step 2: Verify
get_channel_programming(id: "<returned-channel-id>")
# → Confirm schedule slot with type "show" referencing the show UUID

get_channel_lineup(id: "<channel-id>")
# → Confirm episodes are in the lineup
```

That's it — one call creates the channel, resolves the show, and populates the lineup. No smart collections needed for single shows.
