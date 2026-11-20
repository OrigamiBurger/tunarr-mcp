import type {
  Channel,
  FfmpegInfo,
  GuideStatus,
  HealthEntry,
  LineupItem,
  MediaSource,
  SessionsMap,
  SmartCollection,
  SystemHealth,
  TerminalProgram,
  TranscodeConfig,
  VersionInfo,
} from "./types/tunarr.js";

function isJsonResponse(contentType?: string): boolean {
  return !!contentType?.includes("application/json");
}

class TunarrError extends Error {
  public status: number;
  public body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "TunarrError";
    this.status = status;
    this.body = body;
  }
}

async function responseToJson(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (isJsonResponse(contentType)) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  // For non-JSON responses (e.g. 204 No Content), return null
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function ensureOk(res: Response): Promise<unknown> {
  if (!res.ok) {
    const body = await responseToJson(res);
    throw new TunarrError(
      `Tunarr request failed: ${res.status} ${res.statusText}`,
      res.status,
      body,
    );
  }
  // 204 No Content — nothing to return
  if (res.status === 204) {
    return null;
  }
  return responseToJson(res);
}

export class TunarrClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor({
    baseUrl,
    apiKey,
  }: {
    /** Base URL of the Tunarr server, e.g. "http://tunarr:8409". Required. */
    baseUrl: string;
    /** Optional API key sent as `Authorization: Bearer <key>`. */
    apiKey?: string;
  }) {
    if (!baseUrl || !baseUrl.trim()) {
      throw new Error(
        "TunarrClient requires a baseUrl for the Tunarr server (TUNARR_URL)",
      );
    }
    // Strip trailing slash for consistent URL building
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey?.trim() || undefined;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.headers({
      Accept: "application/json",
    });

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return ensureOk(res) as Promise<T>;
  }

  // ─── Channels ─────────────────────────────────────────────────────────────

  async getChannels(): Promise<Channel[]> {
    return this.request<Channel[]>("GET", "/api/channels");
  }

  async getChannel(id: string): Promise<Channel> {
    return this.request<Channel>("GET", `/api/channels/${encodeURIComponent(id)}`);
  }

  async createChannel(body: Record<string, unknown>): Promise<Channel> {
    return this.request<Channel>("POST", "/api/channels", body);
  }

  async updateChannel(
    id: string,
    body: Record<string, unknown>,
  ): Promise<Channel> {
    return this.request<Channel>(
      "PUT",
      `/api/channels/${encodeURIComponent(id)}`,
      body,
    );
  }

  async deleteChannel(id: string): Promise<void> {
    await this.request<void>("DELETE", `/api/channels/${encodeURIComponent(id)}`);
  }

  // ─── Media Sources ────────────────────────────────────────────────────────

  async getMediaSources(): Promise<MediaSource[]> {
    return this.request<MediaSource[]>("GET", "/api/media-sources");
  }

  async getMediaSource(id: string): Promise<MediaSource> {
    return this.request<MediaSource>(
      "GET",
      `/api/media-sources/${encodeURIComponent(id)}`,
    );
  }

  async createMediaSource(body: Record<string, unknown>): Promise<MediaSource> {
    return this.request<MediaSource>("POST", "/api/media-sources", body);
  }

  async updateMediaSource(
    id: string,
    body: Record<string, unknown>,
  ): Promise<MediaSource> {
    return this.request<MediaSource>(
      "PUT",
      `/api/media-sources/${encodeURIComponent(id)}`,
      body,
    );
  }

  async deleteMediaSource(id: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/media-sources/${encodeURIComponent(id)}`,
    );
  }

  async scanMediaSource(id: string): Promise<void> {
    await this.request<void>(
      "POST",
      `/api/media-sources/${encodeURIComponent(id)}/scan`,
    );
  }

  async getMediaSourceStatus(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/media-sources/${encodeURIComponent(id)}/status`,
    );
  }

  // ─── Programs ─────────────────────────────────────────────────────────────

  async listPrograms(id: string): Promise<TerminalProgram> {
    return this.request<TerminalProgram>(
      "GET",
      `/api/programs/${encodeURIComponent(id)}`,
    );
  }

  async getProgramChildren(id: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      "GET",
      `/api/programs/${encodeURIComponent(id)}/children`,
    );
  }

  async batchLookupPrograms(externalIds: string[]): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/api/programming/batch/lookup",
      { externalIds },
    );
  }

  async lookupProgramming(externalId: string): Promise<TerminalProgram> {
    return this.request<TerminalProgram>(
      "GET",
      `/api/programming/${encodeURIComponent(externalId)}`,
    );
  }

  // ─── Channel Schedule ─────────────────────────────────────────────────────

  async getChannelSchedule(channelId: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/channels/${encodeURIComponent(channelId)}/schedule`,
    );
  }

  // ─── Guide ────────────────────────────────────────────────────────────────

  async getGuideStatus(): Promise<GuideStatus> {
    return this.request<GuideStatus>("GET", "/api/guide/status");
  }

  async getGuideChannels(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/api/guide/channels");
  }

  async getGuideChannel(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/guide/channels/${encodeURIComponent(id)}`,
    );
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async getSessions(): Promise<SessionsMap> {
    return this.request<SessionsMap>("GET", "/api/sessions");
  }

  async getSession(channelId?: string): Promise<unknown[]> {
    if (channelId) {
      return this.request<unknown[]>(
        "GET",
        `/api/channels/${encodeURIComponent(channelId)}/sessions`,
      );
    }
    const all = await this.getSessions();
    // Flatten: merge all channel sessions into a single array
    return Object.values(all).flat();
  }

  async deleteSessions(channelId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/channels/${encodeURIComponent(channelId)}/sessions`,
    );
  }

  // ─── System ───────────────────────────────────────────────────────────────

  async getSystemHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>("GET", "/api/system/health");
  }

  async getVersion(): Promise<VersionInfo> {
    return this.request<VersionInfo>("GET", "/api/version");
  }

  async getFfmpegInfo(): Promise<FfmpegInfo> {
    return this.request<FfmpegInfo>("GET", "/api/ffmpeg-info");
  }

  // ─── Settings (generic) ───────────────────────────────────────────────────

  async getSettings(type: string): Promise<unknown> {
    return this.request<unknown>(`GET`, `/api/${type}-settings`);
  }

  async updateSettings(
    type: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(`PUT`, `/api/${type}-settings`, body);
  }

  // ─── Transcode Configs ────────────────────────────────────────────────────

  async getTranscodeConfigs(): Promise<TranscodeConfig[]> {
    return this.request<TranscodeConfig[]>("GET", "/api/transcode_configs");
  }

  async createTranscodeConfig(
    body: Record<string, unknown>,
  ): Promise<TranscodeConfig> {
    return this.request<TranscodeConfig>(
      "POST",
      "/api/transcode_configs",
      body,
    );
  }

  async updateTranscodeConfig(
    id: string,
    body: Record<string, unknown>,
  ): Promise<TranscodeConfig> {
    return this.request<TranscodeConfig>(
      "PUT",
      `/api/transcode_configs/${encodeURIComponent(id)}`,
      body,
    );
  }

  async deleteTranscodeConfig(id: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/transcode_configs/${encodeURIComponent(id)}`,
    );
  }

  // ─── Custom Shows ─────────────────────────────────────────────────────────

  async getCustomShows(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/api/custom-shows");
  }

  async getCustomShow(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/custom-shows/${encodeURIComponent(id)}`,
    );
  }

  async createCustomShow(body: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>("POST", "/api/custom-shows", body);
  }

  async updateCustomShow(
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "PUT",
      `/api/custom-shows/${encodeURIComponent(id)}`,
      body,
    );
  }

  async deleteCustomShow(id: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/custom-shows/${encodeURIComponent(id)}`,
    );
  }

  // ─── Filler Lists ─────────────────────────────────────────────────────────

  async getFillerLists(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/api/filler-lists");
  }

  async getFillerList(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/filler-lists/${encodeURIComponent(id)}`,
    );
  }

  async createFillerList(body: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>("POST", "/api/filler-lists", body);
  }

  async updateFillerList(
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "PUT",
      `/api/filler-lists/${encodeURIComponent(id)}`,
      body,
    );
  }

  async deleteFillerList(id: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/filler-lists/${encodeURIComponent(id)}`,
    );
  }

  // ─── Smart Collections ────────────────────────────────────────────────────

  async getSmartCollections(): Promise<SmartCollection[]> {
    return this.request<SmartCollection[]>("GET", "/api/smart_collections");
  }

  async getSmartCollection(id: string): Promise<SmartCollection> {
    return this.request<SmartCollection>(
      "GET",
      `/api/smart_collections/${encodeURIComponent(id)}`,
    );
  }

  async createSmartCollection(
    body: Record<string, unknown>,
  ): Promise<SmartCollection> {
    return this.request<SmartCollection>(
      "POST",
      "/api/smart_collections",
      body,
    );
  }

  async updateSmartCollection(
    id: string,
    body: Record<string, unknown>,
  ): Promise<SmartCollection> {
    return this.request<SmartCollection>(
      "PUT",
      `/api/smart_collections/${encodeURIComponent(id)}`,
      body,
    );
  }

  async deleteSmartCollection(id: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/smart_collections/${encodeURIComponent(id)}`,
    );
  }

  // ─── Streaming URLs ─────────────────────────────────────────────────────────

  async getM3uPlaylist(): Promise<string> {
    const url = `${this.baseUrl}/api/channels.m3u`;
    const res = await fetch(url, {
      headers: this.headers({ Accept: "text/plain" }),
    });
    if (!res.ok) {
      throw new TunarrError(
        `Tunarr request failed: ${res.status} ${res.statusText}`,
        res.status,
        null,
      );
    }
    return res.text();
  }

  async getXmltvPlaylist(): Promise<string> {
    const url = `${this.baseUrl}/api/xmltv.xml`;
    const res = await fetch(url, {
      headers: this.headers({ Accept: "text/plain" }),
    });
    if (!res.ok) {
      throw new TunarrError(
        `Tunarr request failed: ${res.status} ${res.statusText}`,
        res.status,
        null,
      );
    }
    return res.text();
  }

  async getChannelStreamUrl(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/channels/${encodeURIComponent(id)}/stream`,
    );
  }

  // ─── System State & Tasks ──────────────────────────────────────────────────

  async getSystemState(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/system/state");
  }

  async listTasks(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/api/tasks");
  }

  async runTask(taskId: string): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/api/tasks/${encodeURIComponent(taskId)}/run`,
    );
  }

  // ─── Channels: Programs & Schedule ────────────────────────────────────────

  async getChannelPrograms(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/channels/${encodeURIComponent(id)}/programs`,
    );
  }

  async getChannelLineup(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/channels/${encodeURIComponent(id)}/lineup`,
    );
  }

  async getChannelNowPlaying(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/channels/${encodeURIComponent(id)}/now_playing`,
    );
  }

  async getChannelProgramming(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/channels/${encodeURIComponent(id)}/programming`,
    );
  }

  async getChannelFallbacks(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/channels/${encodeURIComponent(id)}/fallbacks`,
    );
  }

  async getChannelNativePlayback(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/channels/${encodeURIComponent(id)}/native-playback`,
    );
  }

  async listChannelLineups(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/channels/all/lineups");
  }

  async addProgramToChannel(
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/api/channels/${encodeURIComponent(id)}/programming`,
      body,
    );
  }

  async addScheduleSlot(
    channelId: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/api/channels/${encodeURIComponent(channelId)}/schedule-slots`,
      body,
    );
  }

  async addScheduleTimeSlot(
    channelId: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/api/channels/${encodeURIComponent(channelId)}/schedule-time-slots`,
      body,
    );
  }

  async bulkAddFillers(body: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>("POST", "/api/channels/bulk/fillers", body);
  }

  async clearChannelSchedule(id: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api/channels/${encodeURIComponent(id)}/schedule`,
    );
  }

  // ─── Semantic (task-oriented) helpers ─────────────────────────────────────
  // These orchestrate multiple raw endpoints behind a single, goal-oriented
  // method so callers don't have to assemble Tunarr DTO contracts directly.

  /**
   * Resolve a show by any of its identifiers (Tunarr UUID, external id,
   * Plex/TVDB/TMDB id, or free-text title) to a small resolved-program DTO
   * suitable for use in a channel lineup or custom show. The returned id is a
   * Tunarr-internal id that the lineup DTO accepts.
   */
  async resolveShow(
    id: string,
  ): Promise<{ id: string; title: string; type: string; externalId?: string }[]> {
    const show = await this.getShowDetails(id);
    if (!show || typeof show !== "object") {
      return [];
    }
    const s = show as Record<string, unknown>;
    const identifiers = Array.isArray(s.identifiers)
      ? (s.identifiers as Array<{ type?: string; id?: string }>)
      : [];
    return [
      {
        id: (s.uuid as string) ?? id,
        title: (s.title as string) ?? "Unknown",
        type: (s.type as string) ?? "show",
        externalId:
          (identifiers.find((i) => i.type === "tmdb")?.id as string) ??
          (s.externalId as string),
      },
    ];
  }

  /**
   * Create a channel backed by a show and attach its first season's episodes
   * as the channel's initial lineup. Returns the created channel, the resolved
   * show, and the new channel id.
   */
  async createChannelFromShow(
    channelId: string,
    channelName: string,
    showId: string,
    opts: {
      channelNumber?: number;
      transcodeConfigId?: string;
      lineUp?: "ordered" | "chronological" | "random" | "next";
    } = {},
  ): Promise<{
    createdChannel: unknown;
    resolvedShow: unknown;
    channelId: string;
  }> {
    const resolvedShow = await this.resolveShow(showId);
    if (resolvedShow.length === 0) {
      throw new Error(
        `Could not resolve show "${showId}" — verify the ID with get_show_details or lookup_program.`,
      );
    }

    const channelIdResolved = channelId ?? crypto.randomUUID();
    const transcodeConfigId =
      opts.transcodeConfigId ?? (await this.pickDefaultTranscodeConfigId());

    const createdChannel = await this.createChannel({
      type: "new",
      channel: {
        id: channelIdResolved,
        name: channelName,
        number: opts.channelNumber ?? 0,
        groupTitle: channelName,
        startTime: 0,
        duration: 12,
        stealth: false,
        disableFillerOverlay: false,
        guideMinimumDuration: 15,
        streamMode: "hls",
        subtitlesEnabled: true,
        useEtvNext: true,
        offline: { mode: "pic" },
        icon: { path: "", width: 0, duration: 0, position: "bottom-right" },
      },
      transcodeConfigId,
    });

    const lineUp = opts.lineUp ?? "ordered";
    await this.addProgramToChannel(channelIdResolved, {
      type: "manual",
      lineup: [
        {
          type: "content",
          id: resolvedShow[0].id,
          duration: 12,
          season: { order: lineUp, direction: "asc" },
        },
      ],
      append: false,
    });

    return {
      createdChannel,
      resolvedShow,
      channelId: channelIdResolved,
    };
  }

  /**
   * Attach a show to an existing channel without disturbing its current lineup.
   * Uses append=true so the show's episodes are added at the end of the lineup.
   */
  async addShowToChannel(
    channelId: string,
    showId: string,
    opts: { lineUp?: "ordered" | "chronological" | "random" | "next" } = {},
  ): Promise<{ attached: unknown; resolvedShow: unknown }> {
    const resolvedShow = await this.resolveShow(showId);
    if (resolvedShow.length === 0) {
      throw new Error(
        `Could not resolve show "${showId}" — verify the ID with get_show_details or lookup_program.`,
      );
    }
    const lineUp = opts.lineUp ?? "ordered";
    const attached = await this.addProgramToChannel(channelId, {
      type: "manual",
      lineup: [
        {
          type: "content",
          id: resolvedShow[0].id,
          duration: 12,
          season: { order: lineUp, direction: "asc" },
        },
      ],
      append: true,
    });
    return { attached, resolvedShow };
  }

  /**
   * List the episodes that belong to a show. When a season id is supplied the
   * episodes for that season are returned; otherwise every season is resolved
   * and its episodes are returned.
   */
  async getEpisodeList(
    showId: string,
    seasonId?: string,
  ): Promise<unknown> {
    await this.resolveShow(showId);
    if (seasonId) {
      return this.getSeasonDetails(seasonId);
    }
    const seasons = await this.listShowSeasons(showId);
    if (Array.isArray(seasons) && seasons.length > 0) {
      const perSeason: unknown[] = [];
      for (const season of seasons) {
        const seasonUuid =
          (season as Record<string, unknown>).uuid as string | undefined;
        if (seasonUuid) {
          perSeason.push(await this.getSeasonDetails(seasonUuid));
        }
      }
      return perSeason;
    }
    return seasons;
  }

  private async pickDefaultTranscodeConfigId(): Promise<string> {
    const configs = await this.getTranscodeConfigs();
    if (Array.isArray(configs) && configs.length > 0) {
      return (configs[0] as { id?: string }).id ?? "";
    }
    return "";
  }

  // ─── Programs & Credits ───────────────────────────────────────────────────

  async getShowDetails(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/programming/shows/${encodeURIComponent(id)}`,
    );
  }

  async getSeasonDetails(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/programming/seasons/${encodeURIComponent(id)}`,
    );
  }

  async listShowSeasons(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/programming/shows/${encodeURIComponent(id)}/seasons`,
    );
  }

  async getProgramGrouping(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/program_groupings/${encodeURIComponent(id)}`,
    );
  }

  async batchLookupProgramGroupings(
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      "/api/program_groupings/batch/lookup",
      body,
    );
  }

  async getProgramFacets(facetName: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/programs/facets/${encodeURIComponent(facetName)}`,
    );
  }

  async searchPrograms(body: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>("POST", "/api/programs/search", body);
  }

  async getProgramArtwork(
    id: string,
    artworkType: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/programs/${encodeURIComponent(id)}/artwork/${encodeURIComponent(artworkType)}`,
    );
  }

  async getProgramDescendants(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/programs/${encodeURIComponent(id)}/descendants`,
    );
  }

  async getProgramExternalLink(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/programs/${encodeURIComponent(id)}/external-link`,
    );
  }

  async getProgramStreamDetails(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/programs/${encodeURIComponent(id)}/stream_details`,
    );
  }

  async getCredit(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/credits/${encodeURIComponent(id)}`,
    );
  }

  async getCreditArtwork(
    id: string,
    artworkType: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/credits/${encodeURIComponent(id)}/artwork/${encodeURIComponent(artworkType)}`,
    );
  }

  // ─── Media Libraries & Source Browsing ────────────────────────────────────

  async listSourceLibraries(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/media-sources/${encodeURIComponent(id)}/libraries`,
    );
  }

  async getLibraryStatus(
    mediaSourceId: string,
    libraryId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/media-sources/${encodeURIComponent(mediaSourceId)}/${encodeURIComponent(libraryId)}/status`,
    );
  }

  async getMediaLibrary(libraryId: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/media-libraries/${encodeURIComponent(libraryId)}`,
    );
  }

  async listLibraryPrograms(libraryId: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/media-libraries/${encodeURIComponent(libraryId)}/programs`,
    );
  }

  async addLibraryToSource(
    id: string,
    libraryId: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "PUT",
      `/api/media-sources/${encodeURIComponent(id)}/libraries/${encodeURIComponent(libraryId)}`,
      body,
    );
  }

  async plexLibraries(mediaSourceId: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/plex/${encodeURIComponent(mediaSourceId)}/libraries`,
    );
  }

  async plexItemChildren(
    mediaSourceId: string,
    itemId: string,
    parentType: string,
  ): Promise<unknown> {
    const params = new URLSearchParams({ parentType });
    return this.request<unknown>(
      "GET",
      `/api/plex/${encodeURIComponent(mediaSourceId)}/items/${encodeURIComponent(itemId)}/children?${params.toString()}`,
    );
  }

  async plexCollections(
    mediaSourceId: string,
    libraryId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/plex/${encodeURIComponent(mediaSourceId)}/libraries/${encodeURIComponent(libraryId)}/collections`,
    );
  }

  async plexPlaylists(
    mediaSourceId: string,
    libraryId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/plex/${encodeURIComponent(mediaSourceId)}/libraries/${encodeURIComponent(libraryId)}/playlists`,
    );
  }

  async plexUserPlaylists(mediaSourceId: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/plex/${encodeURIComponent(mediaSourceId)}/playlists`,
    );
  }

  async plexSearch(
    mediaSourceId: string,
    key: string,
    opts?: {
      searchParam?: string;
      offset?: number;
      limit?: number;
      parentType?: string;
    },
  ): Promise<unknown> {
    const params = new URLSearchParams({ key });
    if (opts) {
      if (opts.searchParam !== undefined) {
        params.set("searchParam", opts.searchParam);
      }
      if (opts.offset !== undefined) {
        params.set("offset", String(opts.offset));
      }
      if (opts.limit !== undefined) {
        params.set("limit", String(opts.limit));
      }
      if (opts.parentType !== undefined) {
        params.set("parentType", opts.parentType);
      }
    }
    return this.request<unknown>(
      "GET",
      `/api/plex/${encodeURIComponent(mediaSourceId)}/search?${params.toString()}`,
    );
  }

  async plexFilters(
    mediaSourceId: string,
    key: string,
  ): Promise<unknown> {
    const params = new URLSearchParams({ key });
    return this.request<unknown>(
      "GET",
      `/api/plex/${encodeURIComponent(mediaSourceId)}/filters?${params.toString()}`,
    );
  }

  async plexTags(
    mediaSourceId: string,
    libraryKey: string,
    itemKey: string,
  ): Promise<unknown> {
    const params = new URLSearchParams({ libraryKey, itemKey });
    return this.request<unknown>(
      "GET",
      `/api/plex/${encodeURIComponent(mediaSourceId)}/tags?${params.toString()}`,
    );
  }

  async jellyfinLibraryGenres(
    mediaSourceId: string,
    libraryId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/jellyfin/${encodeURIComponent(mediaSourceId)}/libraries/${encodeURIComponent(libraryId)}/genres`,
    );
  }

  async jellyfinLibraryItems(
    mediaSourceId: string,
    libraryId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/jellyfin/${encodeURIComponent(mediaSourceId)}/libraries/${encodeURIComponent(libraryId)}/items`,
    );
  }

  async jellyfinUserLibraries(mediaSourceId: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/jellyfin/${encodeURIComponent(mediaSourceId)}/user_libraries`,
    );
  }

  async embyLibraryItems(
    mediaSourceId: string,
    libraryId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/emby/${encodeURIComponent(mediaSourceId)}/libraries/${encodeURIComponent(libraryId)}/items`,
    );
  }

  async embyUserLibraries(mediaSourceId: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/emby/${encodeURIComponent(mediaSourceId)}/user_libraries`,
    );
  }

  // ─── Custom Shows & Filler Lists ────────────────────────────────────────────

  async getCustomShowPrograms(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/custom-shows/${encodeURIComponent(id)}/programs`,
    );
  }

  async getFillerListPrograms(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/filler-lists/${encodeURIComponent(id)}/programs`,
    );
  }

  // ─── Trash ──────────────────────────────────────────────────────────────────

  async listTrash(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/trash");
  }

  async getTrashStatus(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/trash/status");
  }

  async clearTrash(): Promise<void> {
    await this.request<void>("DELETE", "/api/trash");
  }

  // ─── Guide ────────────────────────────────────────────────────────────────

  async getXmltvLastRefresh(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/xmltv-last-refresh");
  }

  async getGuideDebug(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/guide/debug");
  }

  // ─── Streaming (raw) ──────────────────────────────────────────────────────

  async getDirectChannelStreamUrl(id: string): Promise<string> {
    return `${this.baseUrl}/stream/channels/${encodeURIComponent(id)}`;
  }

  async getChannelM3u8(id: string): Promise<string> {
    const url = `${this.baseUrl}/stream/channels/${encodeURIComponent(id)}.m3u8`;
    const res = await fetch(url, {
      headers: this.headers({ Accept: "text/plain" }),
    });
    if (!res.ok) {
      throw new TunarrError(
        `Tunarr request failed: ${res.status} ${res.statusText}`,
        res.status,
        null,
      );
    }
    return res.text();
  }

  async getChannelTs(id: string): Promise<string> {
    const url = `${this.baseUrl}/stream/channels/${encodeURIComponent(id)}.ts`;
    const res = await fetch(url, {
      headers: this.headers({ Accept: "text/plain" }),
    });
    if (!res.ok) {
      throw new TunarrError(
        `Tunarr request failed: ${res.status} ${res.statusText}`,
        res.status,
        null,
      );
    }
    return res.text();
  }

  async getChannelItemStream(id: string, t: string): Promise<string> {
    const params = new URLSearchParams({ t });
    const url = `${this.baseUrl}/stream/channels/${encodeURIComponent(id)}/item-stream.ts?${params.toString()}`;
    const res = await fetch(url, {
      headers: this.headers({ Accept: "text/plain" }),
    });
    if (!res.ok) {
      throw new TunarrError(
        `Tunarr request failed: ${res.status} ${res.statusText}`,
        res.status,
        null,
      );
    }
    return res.text();
  }

  async getFfmpegPlaylist(channel: string, mode: string): Promise<string> {
    const params = new URLSearchParams({ channel, mode });
    const url = `${this.baseUrl}/ffmpeg/playlist?${params.toString()}`;
    const res = await fetch(url, {
      headers: this.headers({ Accept: "text/plain" }),
    });
    if (!res.ok) {
      throw new TunarrError(
        `Tunarr request failed: ${res.status} ${res.statusText}`,
        res.status,
        null,
      );
    }
    return res.text();
  }

  async getEtvChannelDiagnostics(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/etv/channels/${encodeURIComponent(id)}/diagnostics`,
    );
  }

  async getEtvPlayoutItem(): Promise<unknown> {
    return this.request<unknown>("GET", "/api/etv/playout-item");
  }

  async getEtvTranscodeCompatibility(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/api/etv/transcode_configs/${encodeURIComponent(id)}/compatibility`,
    );
  }

  async clearChannelsM3uCache(): Promise<void> {
    await this.request<void>("DELETE", "/api/channels.m3u");
  }
}
