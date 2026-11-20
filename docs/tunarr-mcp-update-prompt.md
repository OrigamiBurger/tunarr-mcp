# Tunarr MCP — Update Prompt

Copy the text below verbatim and hand it to an implementation agent (or use it yourself). It is self-contained and encodes all conventions from the existing repo.

---

> # Prompt: Add 59 Tunarr MCP tools for the curated endpoint set
>
> ## Background
> The Tunarr MCP server (`/home/cory/git/tunarr-mcp`) currently exposes 56 tools built on the Tunarr OpenAPI spec. A gap analysis identified 59 uncovered endpoints to add. Implement **exactly** these 59 tools. Do not remove or change existing tools. Do not add scans/refreshes, settings writes, or media-source source CRUD.
>
> ## Conventions — match the existing code exactly
> - `src/client.ts` exports `TunarrClient`. Add one method per endpoint. Use `this.request<T>(method, path)`; encode path params with `encodeURIComponent(id)`; return the parsed JSON cast to `T` (use `unknown` when the shape is unknown). For DELETE methods return `Promise<void>`. For raw-text streams, mirror `getM3uPlaylist`/`getXmltvPlaylist` (a direct `fetch` with an `Accept` header; return `.text()`). The client already throws `TunarrError` on non-2xx — do not add extra error handling.
> - Tool files live in `src/tools/*.ts`, each exporting `registerXTools(server: McpServer, client: TunarrClient)` that calls `server.registerTool(name, { description, annotations, inputSchema }, async (params) => { return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } })`.
> - Read tools: `annotations: { readOnlyHint: true }`. Mutating tools: `annotations: { readOnlyHint: false }`. Destructive tools: `annotations: { readOnlyHint: false, destructiveHint: true }`.
> - `inputSchema` is a zod object; every path param is `z.string().describe("... (get available IDs via <list tool>)")`.
> - Register new tools in the existing tool file for their domain. Add a new file only for Trash (`src/tools/trash.ts`).
> - Wire every `registerXTools` call in `src/server.ts` `createTunarrMcpServer()`. Update the count comment there (currently 55) to the new total.
>
> ## Endpoints to add (grouped by target tool file)
>
> ### 1. src/tools/channels.ts — 12 tools
> Read (7): `get_channel_programs` GET /api/channels/{id}/programs · `get_channel_lineup` GET /api/channels/{id}/lineup · `get_channel_now_playing` GET /api/channels/{id}/now_playing · `get_channel_programming` GET /api/channels/{id}/programming · `get_channel_fallbacks` GET /api/channels/{id}/fallbacks · `get_channel_native_playback` GET /api/channels/{id}/native-playback · `list_channel_lineups` GET /api/channels/all/lineups
> Modify (4): `add_program_to_channel` POST /api/channels/{id}/programming body · `add_schedule_slot` POST /api/channels/{channelId}/schedule-slots body · `add_schedule_time_slot` POST /api/channels/{channelId}/schedule-time-slots body · `bulk_add_fillers` POST /api/channels/bulk/fillers body
> Delete (1): `clear_channel_schedule` DELETE /api/channels/{id}/schedule
>
> ### 2. src/tools/programs.ts — 13 tools
> Read (13): `get_show_details` GET /api/programming/shows/{id} · `get_season_details` GET /api/programming/seasons/{id} · `list_show_seasons` GET /api/programming/shows/{id}/seasons · `get_program_grouping` GET /api/program_groupings/{id} · `batch_lookup_program_groupings` POST /api/program_groupings/batch/lookup body · `get_program_facets` GET /api/programs/facets/{facetName} · `search_programs` POST /api/programs/search body · `get_program_artwork` GET /api/programs/{id}/artwork/{artworkType} · `get_program_descendants` GET /api/programs/{id}/descendants · `get_program_external_link` GET /api/programs/{id}/external-link · `get_program_stream_details` GET /api/programs/{id}/stream_details · `get_credit` GET /api/credits/{id} · `get_credit_artwork` GET /api/credits/{id}/artwork/{artworkType}
>
> ### 3. src/tools/media-sources.ts — 18 tools
> Read (17): `list_source_libraries` GET /api/media-sources/{id}/libraries · `get_library_status` GET /api/media-sources/{mediaSourceId}/{libraryId}/status · `get_media_library` GET /api/media-libraries/{libraryId} · `list_library_programs` GET /api/media-libraries/{libraryId}/programs · `plex_libraries` GET /api/plex/{mediaSourceId}/libraries · `plex_item_children` GET /api/plex/{mediaSourceId}/items/{itemId}/children · `plex_collections` GET /api/plex/{mediaSourceId}/libraries/{libraryId}/collections · `plex_playlists` GET /api/plex/{mediaSourceId}/libraries/{libraryId}/playlists · `plex_user_playlists` GET /api/plex/{mediaSourceId}/playlists · `plex_search` GET /api/plex/{mediaSourceId}/search · `plex_filters` GET /api/plex/{mediaSourceId}/filters · `plex_tags` GET /api/plex/{mediaSourceId}/tags · `jellyfin_library_genres` GET /api/jellyfin/{mediaSourceId}/libraries/{libraryId}/genres · `jellyfin_library_items` GET /api/jellyfin/{mediaSourceId}/libraries/{libraryId}/items · `jellyfin_user_libraries` GET /api/jellyfin/{mediaSourceId}/user_libraries · `emby_library_items` GET /api/emby/{mediaSourceId}/libraries/{libraryId}/items · `emby_user_libraries` GET /api/emby/{mediaSourceId}/user_libraries
> Modify (1): `add_library_to_source` PUT /api/media-sources/{id}/libraries/{libraryId} body
>
> ### 4. src/tools/custom-shows.ts — 1 tool
> Read (1): `list_custom_show_programs` GET /api/custom-shows/{id}/programs
>
> ### 5. src/tools/filler-lists.ts — 1 tool
> Read (1): `list_filler_list_programs` GET /api/filler-lists/{id}/programs
>
> ### 6. src/tools/trash.ts (NEW FILE) — 3 tools
> Read (2): `list_trash` GET /api/trash · `get_trash_status` GET /api/trash/status
> Delete (1): `clear_trash` DELETE /api/trash
>
> ### 7. src/tools/guide.ts — 2 tools
> Read (2): `get_xmltv_last_refresh` GET /api/xmltv-last-refresh · `get_guide_debug` GET /api/guide/debug
>
> ### 8. src/tools/streaming.ts — 9 tools
> Read (8): `get_channel_stream` GET /stream/channels/{id} · `get_channel_m3u8` GET /stream/channels/{id}.m3u8 · `get_channel_ts` GET /stream/channels/{id}.ts · `get_channel_item_stream` GET /stream/channels/{id}/item-stream.ts · `get_ffmpeg_playlist` GET /ffmpeg/playlist · `get_etv_channel_diagnostics` GET /api/etv/channels/{id}/diagnostics · `get_etv_playout_item` GET /api/etv/playout-item · `get_etv_transcode_compatibility` GET /api/etv/transcode_configs/{id}/compatibility
> Delete (1): `clear_channels_m3u_cache` DELETE /api/channels.m3u
>
> ## Not exposed (explicitly excluded — do NOT add)
> - Scans/refreshes: POST /api/xmltv/refresh, POST /api/media-sources/foreignstatus, POST /api/media-sources/{id}/libraries/refresh, POST /api/media-sources/{id}/libraries/{libraryId}/scan, POST /api/programs/{id}/scan, POST /api/custom-shows/{id}/sync, POST /api/channels/{id}/scan
> - Settings writes: PUT /api/settings/media-source, PUT /api/settings/stream-selection, PUT /api/{type}-settings writes, transcode-config copy
> - Media source CRUD: POST/PUT/DELETE /api/media-sources (themselves)
> - Stream selection CRUD: all /api/stream-selection-profiles*, /api/stream-selection-settings*
> - POST /api/trash/cancel
> - System/debug admin endpoints
>
> ## Notes & edge cases
> - `artworkType` is a path-param enum. Enumerate valid values from the OpenAPI spec (typically poster/backdrop/logo/thumb/etc.) and expose it as `z.enum([...])`. If you can't enumerate, use `z.string().describe("artwork type, e.g. poster, backdrop")`.
> - `facetName` is a path-param enum; enumerate from the spec if possible, else `z.string()`.
> - The `/api/etv/*` endpoints are ErsatzTV-specific; they still register fine even if ErsatzTV isn't in use.
> - Media streams (`/stream/channels/{id}` family) are binary/playlist content: return the playlist/stream as raw text for `.m3u8`/`.ts`/`/ffmpeg/playlist`, and return the direct stream URL as JSON for `/stream/channels/{id}`.
> - Keep handler bodies thin: validate via zod → call client method → return JSON.
>
> ## Acceptance criteria
> - Exactly the 59 tools above are added; server count comment updated.
> - `tsc`/build passes with no type errors; `npm run build` succeeds.
> - Each tool calls the correct client method and returns JSON in the standard `{ content: [{ type: "text", text }] }` shape.
> - Read tools carry `readOnlyHint: true`; mutating carry `readOnlyHint: false`; the 3 destructive tools carry `destructiveHint: true`.
> - No scan/refresh or settings-write tool is added.
> - Where a live Tunarr is reachable, smoke-test a read tool per domain; otherwise verify via the MCP tools/list.
