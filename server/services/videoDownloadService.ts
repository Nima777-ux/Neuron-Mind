import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { isPublicHttpUrl } from './researchService.ts';

const execFileAsync = promisify(execFile);

export type VideoQualityPreset = 'best' | '720p' | '480p' | 'audio';

export class VideoDownloadError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 422, code = 'VIDEO_DOWNLOAD_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface DownloadedVideoFile {
  filePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  finalUrl: string;
  cleanup: () => void;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const VIDEO_PLATFORM_HOSTS = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
  'dailymotion.com',
  'dai.ly',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'fb.watch',
  'x.com',
  'twitter.com',
  'twitch.tv',
  'reddit.com',
  'v.redd.it',
  'bilibili.com',
  'streamable.com',
  'rumble.com',
  'loom.com',
  'soundcloud.com',
];

const EXT_TO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
};

export function isYouTubeUrl(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return YOUTUBE_HOSTS.has(host) || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

export function isVideoPlatformUrl(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return VIDEO_PLATFORM_HOSTS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

let ytDlpInitPromise: Promise<string> | null = null;

async function ensureYtDlpBinary(): Promise<string> {
  const candidates = [
    process.env.YTDLP_PATH?.trim(),
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    path.join(os.tmpdir(), 'neuron-mind-bin', 'yt-dlp'),
  ].filter((x): x is string => Boolean(x));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // try setting +x or fall through
        try {
          fs.chmodSync(candidate, 0o755);
          return candidate;
        } catch {
          // continue checking next
        }
      }
    }
  }

  if (!ytDlpInitPromise) {
    ytDlpInitPromise = (async () => {
      const binDir = path.join(os.tmpdir(), 'neuron-mind-bin');
      const targetPath = path.join(binDir, 'yt-dlp');
      fs.mkdirSync(binDir, { recursive: true });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const resp = await fetch(
          'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
          { signal: controller.signal, redirect: 'follow' }
        );
        if (!resp.ok) {
          throw new Error(`Failed to fetch yt-dlp binary (HTTP ${resp.status}).`);
        }
        const buf = Buffer.from(await resp.arrayBuffer());
        const tmpPart = `${targetPath}.part-${Date.now()}`;
        fs.writeFileSync(tmpPart, buf, { mode: 0o755 });
        fs.renameSync(tmpPart, targetPath);
        fs.chmodSync(targetPath, 0o755);
        return targetPath;
      } finally {
        clearTimeout(timeout);
      }
    })().catch((err) => {
      ytDlpInitPromise = null;
      throw err;
    });
  }

  return ytDlpInitPromise;
}

function getFormatArgs(quality: VideoQualityPreset): string[] {
  switch (quality) {
    case '720p':
      return [
        '-f',
        'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/b',
        '--merge-output-format',
        'mp4',
      ];
    case '480p':
      return [
        '-f',
        'bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/bv*[height<=480]+ba/b[height<=480]/b',
        '--merge-output-format',
        'mp4',
      ];
    case 'audio':
      return [
        '-f',
        'ba[ext=m4a]/ba/b',
        '-x',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '0',
      ];
    case 'best':
    default:
      return [
        '-f',
        'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
        '--merge-output-format',
        'mp4',
      ];
  }
}

function findFfmpegPath(): string | null {
  const candidates = [
    process.env.FFMPEG_PATH?.trim(),
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ].filter((x): x is string => Boolean(x));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function tryCobaltDownload(
  cobaltBaseUrl: string,
  targetUrl: string,
  quality: VideoQualityPreset,
  tempDir: string
): Promise<DownloadedVideoFile | null> {
  const safeBase = isPublicHttpUrl(cobaltBaseUrl).toString().replace(/\/+$/, '');
  const qualityMap: Record<VideoQualityPreset, string> = {
    best: '1080',
    '720p': '720',
    '480p': '480',
    audio: '1080',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let resolvedMediaUrl = '';
  let resolvedFilename = '';

  try {
    const resp = await fetch(safeBase, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        videoQuality: qualityMap[quality],
        downloadMode: quality === 'audio' ? 'audio' : 'auto',
        audioFormat: 'mp3',
        filenameStyle: 'pretty',
      }),
    });
    const data = (await resp.json().catch(() => null)) as {
      status?: string;
      url?: string;
      filename?: string;
    } | null;
    if (!resp.ok || !data?.url) {
      return null;
    }
    resolvedMediaUrl = data.url;
    resolvedFilename = data.filename || (quality === 'audio' ? 'audio.mp3' : 'video.mp4');
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  const safeMediaUrl = isPublicHttpUrl(resolvedMediaUrl).toString();
  const mediaController = new AbortController();
  const mediaTimeout = setTimeout(() => mediaController.abort(), 180000);
  try {
    const mediaResp = await fetch(safeMediaUrl, {
      signal: mediaController.signal,
      redirect: 'follow',
    });
    if (!mediaResp.ok || !mediaResp.body) {
      return null;
    }
    const cleanName = resolvedFilename.replace(/[\\/:*?"<>|]/g, '_').trim() || 'video.mp4';
    const filePath = path.join(tempDir, cleanName);
    const buf = Buffer.from(await mediaResp.arrayBuffer());
    fs.writeFileSync(filePath, buf);
    const ext = path.extname(cleanName).toLowerCase();
    const mimeType =
      mediaResp.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ||
      EXT_TO_MIME[ext] ||
      'video/mp4';

    return {
      filePath,
      filename: cleanName,
      mimeType,
      sizeBytes: buf.byteLength,
      finalUrl: targetUrl,
      cleanup: () => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(mediaTimeout);
  }
}

export async function downloadFullVideo(
  rawUrl: string,
  options?: {
    quality?: VideoQualityPreset;
    cookiesText?: string;
    cobaltApiUrl?: string;
  }
): Promise<DownloadedVideoFile> {
  const safeUrl = isPublicHttpUrl(rawUrl).toString();
  const quality: VideoQualityPreset = options?.quality ?? 'best';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-video-'));
  let cleanupDone = false;

  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup errors
    }
  };

  try {
    const ytDlpPath = await ensureYtDlpBinary();
    const ffmpegPath = findFfmpegPath();
    const outputTemplate = path.join(tempDir, '%(title).110B [%(id)s].%(ext)s');

    const args: string[] = [
      '--no-playlist',
      '--no-warnings',
      '--no-progress',
      '--restrict-filenames',
      '--max-filesize',
      '500M',
      '--js-runtimes',
      `node:${process.execPath}`,
      ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
      ...getFormatArgs(quality),
      '-o',
      outputTemplate,
    ];

    const cookiesSource =
      options?.cookiesText?.trim() || process.env.YOUTUBE_COOKIES?.trim() || '';
    if (cookiesSource) {
      const cookiesFile = path.join(tempDir, 'cookies.txt');
      fs.writeFileSync(cookiesFile, cookiesSource, { mode: 0o600 });
      args.push('--cookies', cookiesFile);
    }

    const proxyUrl = process.env.YTDLP_PROXY?.trim();
    if (proxyUrl) {
      args.push('--proxy', proxyUrl);
    }

    args.push(safeUrl);

    try {
      await execFileAsync(ytDlpPath, args, {
        timeout: 180_000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (execErr) {
      const stderr =
        execErr && typeof execErr === 'object' && 'stderr' in execErr
          ? String((execErr as { stderr?: unknown }).stderr ?? '')
          : '';
      const stdout =
        execErr && typeof execErr === 'object' && 'stdout' in execErr
          ? String((execErr as { stdout?: unknown }).stdout ?? '')
          : '';
      const combined = `${stderr}\n${stdout}\n${execErr instanceof Error ? execErr.message : ''}`;

      const cobaltUrl =
        options?.cobaltApiUrl?.trim() || process.env.COBALT_API_URL?.trim() || '';
      if (cobaltUrl) {
        const cobaltResult = await tryCobaltDownload(cobaltUrl, safeUrl, quality, tempDir);
        if (cobaltResult) {
          return cobaltResult;
        }
      }

      if (
        /sign in to confirm|not a bot|use --cookies/i.test(combined) &&
        isYouTubeUrl(safeUrl)
      ) {
        throw new VideoDownloadError(
          'YouTube blocked this cloud server IP with bot verification ("Sign in to confirm you’re not a bot"). Expand "YouTube Session Options" below to paste/upload your browser cookies.txt (or add a Cobalt/proxy URL) so the full MP4 video can download.',
          422,
          'YOUTUBE_BOT_VERIFICATION'
        );
      }

      if (/file is larger than max-filesize|max-filesize/i.test(combined)) {
        throw new VideoDownloadError(
          'This full video exceeds the 500 MB per-file download limit. Choose 720p or 480p quality and retry.',
          422,
          'VIDEO_TOO_LARGE'
        );
      }

      const firstErrorLine =
        combined
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => /^ERROR:/i.test(l)) || 'Full video extraction failed for this URL.';

      throw new VideoDownloadError(
        firstErrorLine.replace(/^ERROR:\s*/i, ''),
        422,
        'VIDEO_EXTRACTION_FAILED'
      );
    }

    const files = fs
      .readdirSync(tempDir)
      .filter((name) => {
        if (name === 'cookies.txt') return false;
        if (/\.(?:part|ytdl|jpg|jpeg|png|webp|vtt|srt|json|description)$/i.test(name)) {
          return false;
        }
        const stat = fs.statSync(path.join(tempDir, name));
        return stat.isFile() && stat.size > 0;
      });

    if (files.length === 0) {
      throw new VideoDownloadError(
        'Video downloader finished without producing a video or audio file.',
        422,
        'VIDEO_EMPTY_OUTPUT'
      );
    }

    // Prefer largest produced media file
    files.sort((a, b) => {
      const sa = fs.statSync(path.join(tempDir, a)).size;
      const sb = fs.statSync(path.join(tempDir, b)).size;
      return sb - sa;
    });

    const chosenName = files[0];
    const chosenPath = path.join(tempDir, chosenName);
    const stat = fs.statSync(chosenPath);
    const ext = path.extname(chosenName).toLowerCase();
    const mimeType = EXT_TO_MIME[ext] || (quality === 'audio' ? 'audio/mpeg' : 'video/mp4');

    return {
      filePath: chosenPath,
      filename: chosenName,
      mimeType,
      sizeBytes: stat.size,
      finalUrl: safeUrl,
      cleanup,
    };
  } catch (err) {
    cleanup();
    throw err;
  }
}
