# Tunarr MCP Gap Analysis

**Source spec:** `http://nas.homeserver.edu:30333/openapi.json`
**Repo:** `/home/cory/git/tunarr-mcp`
**Method:** fetch the OpenAPI JSON, normalize every path's `{x}` params to `{id}`, and compare `METHOD /path` against the 56 tools the MCP server currently exposes.

## Headline

| Metric | Count |
|---|---|
| Method-endpoints in OpenAPI | 164 |
| MCP tools currently registered | 56 |
| Covered by existing tools | 62 |
| Uncovered | 102 |

102 method-endpoints have no corresponding MCP tool. They span 10 domains.

## Uncovered endpoints by domain

### Streaming (6)
- `DELETE /api/channels.m3u`
- `GET /api/etv/channels/{id}/diagnostics`
- `GET /api/etv/playout-item`
- `GET /api/etv/transcode_configs/{id}/compatibility`
- `GET /ffmpeg/playlist`
- `GET /stream/channels/{id}.m3u8`
- `GET /stream/channels/{id}.ts`

### Native (2)
- `GET /api/channels/{id}/native-playback`
- `GET /stream/channels/{id}/item-stream.ts`

### Channels (11)
- `DELETE /api/channels/{id}/schedule`
- `GET /api/channels/all/lineups`
- `GET /api/channels/{id}/fallbacks`
- `GET /api/channels/{id}/lineup`
- `GET /api/channels/{id}/now_playing`
- `GET /api/channels/{id}/programming`
- `GET /api/channels/{id}/programs`
- `POST /api/channels/bulk/fillers`
- `POST /api/channels/{channelId}/schedule-slots`
- `POST /api/channels/{channelId}/schedule-time-slots`
- `POST /api/channels/{id}/programming`

### Programs (15)
- `GET /api/program_groupings/{id}`
- `GET /api/programming/seasons/{id}`
- `GET /api/programming/shows/{id}`
- `GET /api/programming/shows/{id}/seasons`
- `GET /api/programs/facets/{facetName}`
- `GET /api/programs/{id}/artwork/{artworkType}`
- `GET /api/programs/{id}/descendants`
- `GET /api/programs/{id}/external-link`
- `GET /api/programs/{id}/stream_details`
- `POST /api/program_groupings/batch/lookup`
- `POST /api/programs/search`
- `POST /api/programs/{id}/scan`

### Custom Shows (2)
- `GET /api/custom-shows/{id}/programs`
- `POST /api/custom-shows/{id}/sync`

### Filler Lists (1)
- `GET /api/filler-lists/{id}/programs`

### Media Library (2)
- `GET /api/media-libraries/{libraryId}`
- `GET /api/media-libraries/{libraryId}/programs`

### Media Source (6)
- `GET /api/media-sources/{id}/libraries`
- `GET /api/media-sources/{mediaSourceId}/{libraryId}/status`
- `POST /api/media-sources/foreignstatus`
- `POST /api/media-sources/{id}/libraries/refresh`
- `POST /api/media-sources/{id}/libraries/{libraryId}/scan`
- `PUT /api/media-sources/{id}/libraries/{libraryId}`

### Trash (4)
- `DELETE /api/trash`
- `GET /api/trash`
- `GET /api/trash/status`
- `POST /api/trash/cancel`

### XMLTV & Guide Refresh (2)
- `GET /api/xmltv-last-refresh`
- `GET /api/guide/debug`

### Settings (6)
- `GET /api/settings/media-source`
- `POST /api/transcode_configs/{id}/copy`
- `PUT /api/settings/media-source`
- `PUT /api/transcode_configs/{id}/copy` (see media source)
- *(transcode config copy, settings media-source read/write)*

### Stream Selection (8)
- `DELETE /api/stream-selection-profiles/{id}`
- `GET /api/stream-selection-profiles`
- `GET /api/stream-selection-profiles/{id}`
- `GET /api/stream-selection-settings`
- `POST /api/stream-selection-profiles`
- `POST /api/stream-selection-profiles/preview`
- `POST /api/stream-selection-profiles/validate-expression`
- `PUT /api/stream-selection-profiles/{id}`
- `PUT /api/stream-selection-settings`

### System (11)
- `GET /api/system/debug/env`
- `GET /api/system/debug/loggers`
- `GET /api/system/debug/logs`
- `GET /api/system/debug/logs/stream`
- `GET /api/system/debug/nvidia`
- `GET /api/system/debug/vaapi`
- `GET /api/system/feature-flags`
- `GET /api/system/migration-state`
- `GET /api/system/settings`
- `POST /api/system/fixers/{fixerId}/run`
- `PUT /api/system/feature-flags`
- `PUT /api/system/onboarding`
- `PUT /api/system/settings`
- `PUT /api/system/settings/backup`

### Artwork / Credits (no tag) (4)
- `GET /api/channels/{id}/artists`
- `GET /api/channels/{id}/shows`
- `GET /api/channels/{id}/transcode_config`
- `GET /api/credits/{id}`
- `GET /api/credits/{id}/artwork/{artworkType}`

### Plex (8)
- `GET /api/plex/{mediaSourceId}/filters`
- `GET /api/plex/{mediaSourceId}/items/{itemId}/children`
- `GET /api/plex/{mediaSourceId}/libraries`
- `GET /api/plex/{mediaSourceId}/libraries/{libraryId}/collections`
- `GET /api/plex/{mediaSourceId}/libraries/{libraryId}/playlists`
- `GET /api/plex/{mediaSourceId}/playlists`
- `GET /api/plex/{mediaSourceId}/search`
- `GET /api/plex/{mediaSourceId}/tags`

### Jellyfin (3)
- `GET /api/jellyfin/{mediaSourceId}/libraries/{libraryId}/genres`
- `GET /api/jellyfin/{mediaSourceId}/libraries/{libraryId}/items`
- `GET /api/jellyfin/{mediaSourceId}/user_libraries`

### Emby (2)
- `GET /api/emby/{mediaSourceId}/libraries/{libraryId}/items`
- `GET /api/emby/{mediaSourceId}/user_libraries`

### Program Facets / Search (no tag) (3)
- `GET /api/programs/facets/{facetName}`
- `POST /api/programs/facets/{facetName}`
- `POST /api/programs/search`

### Other (no tag) (login / upload)
- `POST /api/emby/login`
- `POST /api/jellyfin/login`
- `POST /api/upload/audio`
- `POST /api/upload/image`

*(Note: a handful of these overlap tags — e.g. a `GET /api/programs/facets/{facetName}` appears under both "Programs" and "(no-tag)". The list above is the raw per-endpoint dump; dedupe by the normalized `METHOD /path` when building the tool list.)*
