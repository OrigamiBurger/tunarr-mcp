# Tunarr MCP — Curated Target Endpoint List

**Scope selected by user (final):**
- **Domains IN:** Channel lineup & schedule, Program & media lookup, Media source & library browsing, Custom-show/filler/SMC sub-resources, Trash, XMLTV & guide refresh, Live streaming output.
- **Domain OUT:** Settings & stream-selection.
- **Mutating IN:** Modify/add items (low risk), Delete/clear data (destructive).
- **Mutating OUT:** scans/refreshes, overwrite settings, media-source source CRUD.

**Total: 59 endpoints → 59 new MCP tools.**

## Not exposed (explicit exclusions)
- Scans/refreshes: `POST /api/xmltv/refresh`, `POST /api/media-sources/foreignstatus`, `POST /api/media-sources/{id}/libraries/refresh`, `POST /api/media-sources/{id}/libraries/{libraryId}/scan`, `POST /api/programs/{id}/scan`, `POST /api/custom-shows/{id}/sync`, `POST /api/channels/{id}/scan`
- Settings writes: `PUT /api/settings/media-source`, transcode-config copy, any `PUT/POST /api/{type}-settings`
- Media-source source CRUD: `POST/PUT/DELETE /api/media-sources`
- Stream selection CRUD: all `/api/stream-selection-profiles*`, `/api/stream-selection-settings*`
- `POST /api/trash/cancel` (a modify, not in the selected categories)
- System/debug admin endpoints

---

## 1. Channel lineup & schedule — 12 tools (7 read + 4 modify + 1 delete)

| Tool | Method + Path | Mutating |
|---|---|---|
| `get_channel_programs` | `GET /api/channels/{id}/programs` | read |
| `get_channel_lineup` | `GET /api/channels/{id}/lineup` | read |
| `get_channel_now_playing` | `GET /api/channels/{id}/now_playing` | read |
| `get_channel_programming` | `GET /api/channels/{id}/programming` | read |
| `get_channel_fallbacks` | `GET /api/channels/{id}/fallbacks` | read |
| `get_channel_native_playback` | `GET /api/channels/{id}/native-playback` | read |
| `list_channel_lineups` | `GET /api/channels/all/lineups` | read |
| `add_program_to_channel` | `POST /api/channels/{id}/programming` | modify |
| `add_schedule_slot` | `POST /api/channels/{channelId}/schedule-slots` | modify |
| `add_schedule_time_slot` | `POST /api/channels/{channelId}/schedule-time-slots` | modify |
| `bulk_add_fillers` | `POST /api/channels/bulk/fillers` | modify |
| `clear_channel_schedule` | `DELETE /api/channels/{id}/schedule` | **delete** |

## 2. Program & media lookup — 13 tools (13 read)

| Tool | Method + Path | Mutating |
|---|---|---|
| `get_show_details` | `GET /api/programming/shows/{id}` | read |
| `get_season_details` | `GET /api/programming/seasons/{id}` | read |
| `list_show_seasons` | `GET /api/programming/shows/{id}/seasons` | read |
| `get_program_grouping` | `GET /api/program_groupings/{id}` | read |
| `batch_lookup_program_groupings` | `POST /api/program_groupings/batch/lookup` | read |
| `get_program_facets` | `GET /api/programs/facets/{facetName}` | read |
| `search_programs` | `POST /api/programs/search` | read |
| `get_program_artwork` | `GET /api/programs/{id}/artwork/{artworkType}` | read |
| `get_program_descendants` | `GET /api/programs/{id}/descendants` | read |
| `get_program_external_link` | `GET /api/programs/{id}/external-link` | read |
| `get_program_stream_details` | `GET /api/programs/{id}/stream_details` | read |
| `get_credit` | `GET /api/credits/{id}` | read |
| `get_credit_artwork` | `GET /api/credits/{id}/artwork/{artworkType}` | read |

## 3. Media source & library browsing — 18 tools (17 read + 1 modify)

| Tool | Method + Path | Mutating |
|---|---|---|
| `list_source_libraries` | `GET /api/media-sources/{id}/libraries` | read |
| `get_library_status` | `GET /api/media-sources/{mediaSourceId}/{libraryId}/status` | read |
| `get_media_library` | `GET /api/media-libraries/{libraryId}` | read |
| `list_library_programs` | `GET /api/media-libraries/{libraryId}/programs` | read |
| `plex_libraries` | `GET /api/plex/{mediaSourceId}/libraries` | read |
| `plex_item_children` | `GET /api/plex/{mediaSourceId}/items/{itemId}/children` | read |
| `plex_collections` | `GET /api/plex/{mediaSourceId}/libraries/{libraryId}/collections` | read |
| `plex_playlists` | `GET /api/plex/{mediaSourceId}/libraries/{libraryId}/playlists` | read |
| `plex_user_playlists` | `GET /api/plex/{mediaSourceId}/playlists` | read |
| `plex_search` | `GET /api/plex/{mediaSourceId}/search` | read |
| `plex_filters` | `GET /api/plex/{mediaSourceId}/filters` | read |
| `plex_tags` | `GET /api/plex/{mediaSourceId}/tags` | read |
| `jellyfin_library_genres` | `GET /api/jellyfin/{mediaSourceId}/libraries/{libraryId}/genres` | read |
| `jellyfin_library_items` | `GET /api/jellyfin/{mediaSourceId}/libraries/{libraryId}/items` | read |
| `jellyfin_user_libraries` | `GET /api/jellyfin/{mediaSourceId}/user_libraries` | read |
| `emby_library_items` | `GET /api/emby/{mediaSourceId}/libraries/{libraryId}/items` | read |
| `emby_user_libraries` | `GET /api/emby/{mediaSourceId}/user_libraries` | read |
| `add_library_to_source` | `PUT /api/media-sources/{id}/libraries/{libraryId}` | modify |

## 4. Custom-show / filler / SMC sub-resources — 2 tools (2 read)

| Tool | Method + Path | Mutating |
|---|---|---|
| `list_custom_show_programs` | `GET /api/custom-shows/{id}/programs` | read |
| `list_filler_list_programs` | `GET /api/filler-lists/{id}/programs` | read |

## 5. Trash — 3 tools (2 read + 1 delete)

| Tool | Method + Path | Mutating |
|---|---|---|
| `list_trash` | `GET /api/trash` | read |
| `get_trash_status` | `GET /api/trash/status` | read |
| `clear_trash` | `DELETE /api/trash` | **delete** |

## 6. XMLTV & guide refresh — 2 tools (2 read)

| Tool | Method + Path | Mutating |
|---|---|---|
| `get_xmltv_last_refresh` | `GET /api/xmltv-last-refresh` | read |
| `get_guide_debug` | `GET /api/guide/debug` | read |

## 7. Live streaming output — 9 tools (8 read + 1 delete)

| Tool | Method + Path | Mutating |
|---|---|---|
| `get_channel_stream` | `GET /stream/channels/{id}` | read |
| `get_channel_m3u8` | `GET /stream/channels/{id}.m3u8` | read |
| `get_channel_ts` | `GET /stream/channels/{id}.ts` | read |
| `get_channel_item_stream` | `GET /stream/channels/{id}/item-stream.ts` | read |
| `get_ffmpeg_playlist` | `GET /ffmpeg/playlist` | read |
| `get_etv_channel_diagnostics` | `GET /api/etv/channels/{id}/diagnostics` | read |
| `get_etv_playout_item` | `GET /api/etv/playout-item` | read |
| `get_etv_transcode_compatibility` | `GET /api/etv/transcode_configs/{id}/compatibility` | read |
| `clear_channels_m3u_cache` | `DELETE /api/channels.m3u` | **delete** |

---

## Totals by domain
| Domain | Read | Modify | Delete | Total |
|---|---|---|---|---|
| Channel lineup & schedule | 7 | 4 | 1 | 12 |
| Program & media lookup | 13 | 0 | 0 | 13 |
| Media source & library browsing | 17 | 1 | 0 | 18 |
| Custom-show / filler sub-resources | 2 | 0 | 0 | 2 |
| Trash | 2 | 0 | 1 | 3 |
| XMLTV & guide refresh | 2 | 0 | 0 | 2 |
| Live streaming output | 8 | 0 | 1 | 9 |
| **Total** | **53** | **5** | **3** | **59** |

## Edge cases to resolve during implementation
- `artworkType` is a path-param enum confirmed from the spec: `poster | thumbnail | logo | fanart | watermark | banner | landscape`.
- `facetName` is a plain path-param string in the spec (no enum); expose as `z.string()`.
- `/api/etv/*` endpoints are ErsatzTV-specific; they register fine even when ErsatzTV isn't in use.
- Plex/Jellyfin/Emby endpoints require a runtime `mediaSourceId`.
- Media streams (`/stream/channels/{id}` family) are binary/playlist content — return playlist text for `.m3u8`/`.ts`/`/ffmpeg/playlist`, and the direct stream URL as JSON for `/stream/channels/{id}`.
- Some endpoints (e.g. `list_channel_lineups`, `plex_search`) can return large payloads.
