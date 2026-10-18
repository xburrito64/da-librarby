// What a movie's page ("About") and an episode's card say about a file and its watching: the file,
// the picture (with its colours), sound and subtitles, and each time it was watched. Whatever isn't
// known isn't shown.
import type { FileInfo, FileRow, FileWatch, Track, Viewing } from "./api";
import { formatDuration } from "./WatchStats";

export type Row = [label: string, value: React.ReactNode];

/** "12:34" / "1:02:03" */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// Files name languages in three letters ("jpn"); the browser knows the two-letter codes.
const THREE_LETTERS: Record<string, string> = {
  jpn: "ja", eng: "en", ger: "de", deu: "de", fre: "fr", fra: "fr", spa: "es", ita: "it", por: "pt",
  rus: "ru", kor: "ko", chi: "zh", zho: "zh", dut: "nl", nld: "nl", pol: "pl", swe: "sv", nor: "no",
  dan: "da", fin: "fi", tur: "tr", ara: "ar", hin: "hi", tha: "th", vie: "vi", ind: "id", may: "ms",
  msa: "ms", heb: "he", gre: "el", ell: "el", hun: "hu", cze: "cs", ces: "cs", rum: "ro", ron: "ro", ukr: "uk",
};

let names: Intl.DisplayNames | null = null;
export function language(code: string | null) {
  if (!code || code === "und" || code === "xx") return null;
  const short = THREE_LETTERS[code.toLowerCase()] ?? code;
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "language" });
    return names.of(short) ?? code;
  } catch {
    return code;
  }
}

export function quality(info: FileInfo) {
  const w = info.width ?? 0;
  const h = info.height ?? 0;
  if (w >= 3200 || h >= 1800) return "4K";
  if (w >= 1800 || h >= 1000) return "1080p";
  if (w >= 1200 || h >= 700) return "720p";
  return h > 0 ? `${h}p` : null;
}

export function surround(channels: number | null) {
  if (!channels) return null;
  if (channels >= 8) return "7.1";
  if (channels >= 6) return "5.1";
  return channels === 1 ? "Mono" : channels === 2 ? "Stereo" : `${channels} channels`;
}

const CODECS: Record<string, string> = {
  hevc: "HEVC", h264: "H.264", av1: "AV1", vp9: "VP9", vp8: "VP8", mpeg4: "MPEG-4", mpeg2video: "MPEG-2", vc1: "VC-1",
  aac: "AAC", ac3: "Dolby Digital", eac3: "Dolby Digital Plus", truehd: "Dolby TrueHD", dts: "DTS", mlp: "MLP",
  flac: "FLAC", opus: "Opus", mp3: "MP3", mp2: "MP2", vorbis: "Vorbis", alac: "ALAC",
  pcm_s16le: "PCM", pcm_s24le: "PCM", pcm_s32le: "PCM", pcm_bluray: "PCM",
  hdmv_pgs_subtitle: "PGS", ass: "ASS", ssa: "SSA", subrip: "SRT", dvd_subtitle: "VobSub", webvtt: "WebVTT",
  mov_text: "MP4 text", dvb_subtitle: "DVB",
};
export const codec = (c: string | null) => (c ? (CODECS[c] ?? c.toUpperCase()) : null);

/** The codec with its profile: "HEVC Main 10", "AAC LC", "DTS-HD MA" (not "DTS DTS-HD MA"). */
function codecWithProfile(c: string | null, profile: string | null) {
  const name = codec(c);
  if (!profile) return name;
  if (!name || profile.toLowerCase().startsWith(name.toLowerCase())) return profile;
  return `${name} ${profile}`;
}

export function date(value: string | number | null | undefined) {
  if (value == null) return null;
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function dateTime(seconds: number) {
  const d = new Date(seconds * 1000);
  return `${date(seconds)}, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function bytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  return `${Math.round(n / 1e6)} MB`;
}

function bitrate(bits: number | null) {
  if (!bits) return undefined;
  return bits >= 1e6 ? `${(bits / 1e6).toFixed(1)} Mbit/s` : `${Math.round(bits / 1000)} kbit/s`;
}

// mpv's names for how colours are stored, as they're usually written.
const COLOURS: Record<string, string> = {
  "bt.601": "BT.601", "bt.709": "BT.709", "bt.2020-ncl": "BT.2020 (non-constant)", "bt.2020-cl": "BT.2020 (constant)",
  "bt.2100-pq": "BT.2100 PQ", "bt.2100-hlg": "BT.2100 HLG", "smpte-240m": "SMPTE 240M", rgb: "RGB", xyz: "XYZ", ycgco: "YCgCo",
  dolbyvision: "Dolby Vision",
  "bt.601-525": "BT.601 (NTSC)", "bt.601-625": "BT.601 (PAL)", "bt.470m": "BT.470 M", "bt.2020": "BT.2020",
  "dci-p3": "DCI-P3", "display-p3": "Display P3", apple: "Apple RGB", adobe: "Adobe RGB", film: "Film", aces: "ACES",
  "bt.1886": "BT.1886", srgb: "sRGB", linear: "Linear", "gamma1.8": "Gamma 1.8", "gamma2.0": "Gamma 2.0", "gamma2.2": "Gamma 2.2",
  "gamma2.4": "Gamma 2.4", "gamma2.6": "Gamma 2.6", "gamma2.8": "Gamma 2.8", pq: "PQ (SMPTE 2084)", hlg: "HLG",
  "v-log": "V-Log", "s-log1": "S-Log", "s-log2": "S-Log2", "st428": "SMPTE 428",
};
const colour = (c: string | null) => (c ? (COLOURS[c] ?? c.replace(/^bt\./, "BT.")) : null);

/** "SDR", "HDR10", "HLG", "Dolby Vision (profile 8) · HDR10". */
function dynamicRange(info: FileInfo) {
  const t = info.colorTransfer;
  const base = t === "pq" ? "HDR10" : t === "hlg" ? "HLG" : t ? "SDR" : null;
  if (info.dolbyVision) return [`Dolby Vision (profile ${info.dolbyVision})`, base !== "SDR" ? base : null].filter(Boolean).join(" · ");
  return base;
}

const list = (lines: string[]) => (
  <span className="mabout__list">
    {lines.map((l, i) => (
      <span key={i}>{l}</span>
    ))}
  </span>
);

const flags = (t: Track) => [t.default && "default", t.forced && "forced", t.hearingImpaired && "SDH"].filter(Boolean).join(", ");

function audioLine(t: Track) {
  const parts = [
    language(t.lang) ?? "Unknown",
    surround(t.channels),
    codecWithProfile(t.codec, t.profile),
    bitrate(t.bitrate),
    t.sampleRate ? `${Math.round(t.sampleRate / 100) / 10} kHz` : null,
    // A commentary says so in its title.
    t.title && /comment/i.test(t.title) ? t.title : null,
  ];
  const f = flags(t);
  return parts.filter(Boolean).join(" · ") + (f ? ` (${f})` : "");
}

function subtitleLine(t: Track) {
  const lang = language(t.lang);
  const name = t.title && lang && t.title.toLowerCase().includes(lang.toLowerCase()) ? t.title : [lang, t.title].filter(Boolean).join(" · ");
  const format = codec(t.codec);
  const parts = [name || "Unknown", format && !name.toLowerCase().includes(format.toLowerCase()) ? format : null];
  const f = flags(t);
  return parts.filter(Boolean).join(" · ") + (f ? ` (${f})` : "");
}

/** The file: its name, size, kind and bitrate, chapters, when it was added. */
export function fileRows(file: FileRow | undefined, info: FileInfo | null | undefined, withName: boolean): Row[] {
  const rows: Row[] = [];
  if (!file) return rows;
  if (withName) rows.push(["Name", file.path.split(/[\\/]/).pop() ?? file.path]);
  const size = [bytes(file.size), info?.container?.split(",")[0].replace("matroska", "MKV").toUpperCase()];
  if (info?.duration) size.push(bitrate((file.size * 8) / info.duration));
  rows.push(["Size", size.filter(Boolean).join(" · ")]);
  if (info?.duration) rows.push(["Length", clock(info.duration)]);
  if (info && info.chapters > 0) rows.push(["Chapters", info.chapters]);
  const added = date(file.addedAt);
  if (added) rows.push(["Added", added]);
  return rows;
}

/** The picture: size, codec, bit depth, frame rate, and how its colours are stored. */
export function pictureRows(info: FileInfo | null | undefined): Row[] {
  if (info === undefined) return [["Picture", "Having a look…"]];
  if (!info) return [];
  const rows: Row[] = [];
  const q = quality(info);
  if (info.width && info.height) rows.push(["Resolution", `${q} (${info.width}×${info.height})`]);
  const c = codecWithProfile(info.videoCodec, info.videoProfile);
  if (c) rows.push(["Codec", c]);
  if (info.bitDepth) rows.push(["Bit depth", `${info.bitDepth}-bit`]);
  if (info.fps) rows.push(["Frame rate", `${Math.round(info.fps * 1000) / 1000} fps`]);
  const rate = bitrate(info.videoBitrate);
  if (rate) rows.push(["Bitrate", rate]);
  const range = dynamicRange(info);
  if (range) rows.push(["Dynamic range", range]);
  const matrix = colour(info.colorMatrix);
  if (matrix) rows.push(["Colour space", matrix]);
  const primaries = colour(info.colorPrimaries);
  if (primaries) rows.push(["Primaries", primaries]);
  const transfer = colour(info.colorTransfer);
  if (transfer) rows.push(["Transfer", transfer]);
  if (info.colorRange) rows.push(["Range", info.colorRange === "limited" ? "Limited (TV)" : info.colorRange === "full" ? "Full (PC)" : info.colorRange]);
  if (info.chroma) rows.push(["Chroma", info.chroma]);
  return rows;
}

/** Each audio and subtitle track. */
export function soundRows(info: FileInfo | null | undefined): Row[] {
  if (!info) return [];
  const rows: Row[] = [];
  if (info.audio.length > 0) rows.push([info.audio.length > 1 ? "Audio tracks" : "Audio", list(info.audio.map(audioLine))]);
  if (info.subs.length > 0) rows.push(["Subtitles", list(info.subs.map(subtitleLine))]);
  return rows;
}

function viewingLine(v: Viewing) {
  const when = v.approx ? date(v.startedAt) : dateTime(v.startedAt);
  const how = v.finished ? "to the end" : v.position > 0 ? `stopped at ${clock(v.position)}` : `${Math.max(1, Math.round(v.seconds / 60))} min`;
  return (
    <span className="history__item">
      <span>{when}</span>
      <span className="history__how">{how}</span>
    </span>
  );
}

/** Where you are with it, how often and how long it was watched, and each time it was. */
export function watchingRows(file: FileRow | undefined, watched: FileWatch | null): Row[] {
  const rows: Row[] = [];
  const p = file?.progress;
  if (p?.watched && !(p.position >= 30 && p.position < p.duration * 0.9)) rows.push(["Status", "Watched"]);
  else if (p && p.position >= 30 && p.duration > 0)
    rows.push(["Status", `Stopped at ${clock(p.position)}, ${Math.max(1, Math.round((p.duration - p.position) / 60))} min left`]);
  else rows.push(["Status", "Not watched yet"]);
  const views = watched?.viewings ?? [];
  if (views.length > 0) rows.push(["Watched", views.length === 1 ? "Once" : `${views.length} times`]);
  if (watched && watched.seconds >= 60) rows.push(["Time watched", formatDuration(watched.seconds)]);
  if (views.length > 0)
    rows.push([
      "History",
      <span className="history">
        {views.map((v) => (
          <span key={`${v.startedAt}-${v.approx}`}>{viewingLine(v)}</span>
        ))}
      </span>,
    ]);
  return rows;
}

/** Groups of rows under their headings, each group left out when it has nothing to say. */
export function Groups({ groups }: { groups: [string, Row[]][] }) {
  return (
    <>
      {groups
        .filter(([, rows]) => rows.length > 0)
        .map(([heading, rows]) => (
          <div key={heading} className="mabout__group">
            <h3 className="mabout__heading">{heading}</h3>
            <dl className="mabout__rows">
              {rows.map(([label, value]) => (
                <div key={label} className="mabout__row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
    </>
  );
}
