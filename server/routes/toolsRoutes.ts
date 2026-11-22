import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AppLanguage } from '../core/types.ts';
import {
  GeminiConfigurationError,
  GeminiUpstreamError,
} from '../services/geminiClient.ts';
import {
  formatUpstreamErrorMessage,
  inspectWebpage,
  isPublicHttpUrl,
  performWebResearch,
  synthesizeSpeechTts,
  transcribeAndSummarizeMeeting,
  transcribeVoiceInput,
} from '../services/researchService.ts';
import {
  VideoDownloadError,
  downloadFullVideo,
  isVideoPlatformUrl,
  type VideoQualityPreset,
} from '../services/videoDownloadService.ts';

const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'video/x-msvideo': '.avi',
  'video/ogg': '.ogv',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/flac': '.flac',
  'audio/webm': '.weba',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/json': '.json',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/markdown': '.md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/html': '.html',
};

function cleanMimeType(rawContentType: string): string {
  return rawContentType.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
}

function unescapeEmbeddedUrl(raw: string): string {
  return raw
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .trim();
}

function resolveAbsoluteCandidate(candidate: string, baseUrl: string): string | null {
  try {
    const cleaned = unescapeEmbeddedUrl(candidate);
    if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) {
      return null;
    }
    const resolved = new URL(cleaned, baseUrl).toString();
    isPublicHttpUrl(resolved);
    return resolved;
  } catch {
    return null;
  }
}

function extractDirectMediaFromHtml(html: string, baseUrl: string): string | null {
  const candidates: string[] = [];

  // 1. Direct meta video tags (highest priority for video share links)
  const metaPatterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:video:secure_url|og:video:url|og:video|twitter:player:stream)["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:video:secure_url|og:video:url|og:video|twitter:player:stream)["']/gi,
    /<video[^>]+src=["']([^"']+)["']/gi,
    /<source[^>]+src=["']([^"']+)["'][^>]*type=["']video\/[^"']+["']/gi,
    /<source[^>]+type=["']video\/[^"']+["'][^>]*src=["']([^"']+)["']/gi,
    /<audio[^>]+src=["']([^"']+)["']/gi,
    /<source[^>]+src=["']([^"']+)["'][^>]*type=["']audio\/[^"']+["']/gi,
  ];
  for (const re of metaPatterns) {
    for (const match of html.matchAll(re)) {
      if (match[1]) candidates.push(match[1]);
    }
  }

  // 2. Embedded JSON/script media streams (e.g. Pinterest v720P mp4, direct .mp4 / .mp3 / .webm links)
  const directMediaRegex =
    /https?:\\?\/\\?\/[^"'\s<>\\)]+?\.(?:mp4|webm|mov|m4v|mp3|m4a|wav|ogg|aac)(?:\?[^"'\s<>\\)]*)?/gi;
  for (const match of html.matchAll(directMediaRegex)) {
    if (match[0]) candidates.push(match[0]);
  }

  // 3. Audio / document / image meta tags & direct asset URLs
  const secondaryPatterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:audio|og:audio:url|og:audio:secure_url)["'][^>]+content=["']([^"']+)["']/gi,
    /<a[^>]+href=["']([^"']+\.(?:mp4|mp3|pdf|zip|png|jpg|jpeg|webp|wav|m4a)(?:\?[^"']*)?)["']/gi,
    /<meta[^>]+(?:property|name)=["'](?:og:image:secure_url|og:image|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image:secure_url|og:image|twitter:image|twitter:image:src)["']/gi,
    /https?:\\?\/\\?\/[^"'\s<>\\)]+?\.(?:png|jpe?g|webp|pdf)(?:\?[^"'\s<>\\)]*)?/gi,
  ];
  for (const re of secondaryPatterns) {
    for (const match of html.matchAll(re)) {
      if (match[1] || match[0]) candidates.push(match[1] || match[0]);
    }
  }

  for (const rawCandidate of candidates) {
    const abs = resolveAbsoluteCandidate(rawCandidate, baseUrl);
    if (!abs) continue;
    // Skip tiny tracking pixels, favicons, or JS/CSS
    if (/\.(?:js|css|ico|woff2?)(?:\?|$)/i.test(abs) || /favicon|sprite|pixel|spacer/i.test(abs)) {
      continue;
    }
    return abs;
  }

  return null;
}

function buildFinalFilename(
  rawUrl: string,
  dispositionHeader: string,
  mimeType: string,
  fallbackSlug = 'downloaded-file'
): string {
  const dispMatch = dispositionHeader.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  let candidate = dispMatch?.[1]?.trim();

  if (!candidate) {
    try {
      const parsed = new URL(rawUrl);
      candidate = path.basename(parsed.pathname);
    } catch {
      candidate = fallbackSlug;
    }
  }

  candidate = (candidate || fallbackSlug).replace(/[\\/:*?"<>|]/g, '_').trim();
  if (!candidate || candidate === '.' || candidate === '..') {
    candidate = fallbackSlug;
  }

  const expectedExt = MIME_TO_EXT[mimeType] || '';
  const currentExt = path.extname(candidate).toLowerCase();

  if (!currentExt || (expectedExt && expectedExt !== '.html' && currentExt === '.html')) {
    const base = currentExt ? candidate.slice(0, -currentExt.length) : candidate;
    return `${base || fallbackSlug}${expectedExt || '.bin'}`;
  }

  return candidate;
}

class UpstreamDownloadError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 422, code = 'UPSTREAM_DOWNLOAD_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const MAX_STREAM_DOWNLOAD_BYTES = 500 * 1024 * 1024;

async function fetchBinaryAsset(
  targetUrl: string,
  maxBytes = MAX_DOWNLOAD_BYTES
): Promise<{
  finalUrl: string;
  mimeType: string;
  disposition: string;
  buffer: Buffer;
}> {
  const parsed = isPublicHttpUrl(targetUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const finalUrl = upstream.url || parsed.toString();
    isPublicHttpUrl(finalUrl);

    if (!upstream.ok) {
      throw new UpstreamDownloadError(
        `The remote server declined the request (HTTP ${upstream.status}). Check that the file link is public and not expired.`,
        422,
        'UPSTREAM_REJECTED'
      );
    }

    const maxMb = Math.round(maxBytes / (1024 * 1024));
    const contentLengthHeader = upstream.headers.get('content-length');
    if (contentLengthHeader && Number(contentLengthHeader) > maxBytes) {
      throw new UpstreamDownloadError(`Remote file exceeds the ${maxMb} MB download limit.`, 422, 'FILE_TOO_LARGE');
    }

    const arrayBuf = await upstream.arrayBuffer();
    if (arrayBuf.byteLength > maxBytes) {
      throw new UpstreamDownloadError(`Remote file exceeds the ${maxMb} MB download limit.`, 422, 'FILE_TOO_LARGE');
    }

    return {
      finalUrl,
      mimeType: cleanMimeType(upstream.headers.get('content-type') || 'application/octet-stream'),
      disposition: upstream.headers.get('content-disposition') || '',
      buffer: Buffer.from(arrayBuf),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sendRouteError(res: Response, error: unknown): void {
  if (
    error instanceof GeminiConfigurationError ||
    error instanceof GeminiUpstreamError
  ) {
    res.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  if (
    error instanceof UpstreamDownloadError ||
    error instanceof VideoDownloadError
  ) {
    res.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  const message = formatUpstreamErrorMessage(error, 'en');
  res.status(500).json({
    error: { code: 'TOOL_ERROR', message },
  });
}

function normalizeQualityPreset(raw: unknown): VideoQualityPreset {
  if (raw === '720p' || raw === '480p' || raw === 'audio') return raw;
  return 'best';
}

function sendAsciiSafeDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'") || 'download.bin';
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function streamDownloadedVideoFile(
  res: Response,
  videoFile: Awaited<ReturnType<typeof downloadFullVideo>>
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', videoFile.mimeType);
  res.setHeader('Content-Length', String(videoFile.sizeBytes));
  res.setHeader('Content-Disposition', sendAsciiSafeDisposition(videoFile.filename));
  res.setHeader('X-Download-Filename', encodeURIComponent(videoFile.filename));
  res.setHeader('X-Download-Mime', videoFile.mimeType);
  res.setHeader('X-Download-Size', String(videoFile.sizeBytes));
  res.setHeader('X-Source-Url', encodeURIComponent(videoFile.finalUrl));
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Disposition, X-Download-Filename, X-Download-Mime, X-Download-Size, X-Source-Url'
  );

  const stream = fs.createReadStream(videoFile.filePath);
  res.on('close', () => {
    stream.destroy();
    videoFile.cleanup();
  });
  res.on('finish', () => {
    videoFile.cleanup();
  });
  stream.on('error', () => {
    videoFile.cleanup();
    if (!res.headersSent) {
      res.status(500).json({
        error: { code: 'STREAM_ERROR', message: 'Failed while reading downloaded video.' },
      });
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

export function createToolsRouter(): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      service: 'neuron-mind',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/system/metrics', (_req: Request, res: Response) => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const procMem = process.memoryUsage();

    res.json({
      timestamp: new Date().toISOString(),
      server: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptimeSeconds: Math.round(os.uptime()),
        cpuCores: cpus.length,
        cpuModel: cpus[0]?.model ?? 'Unknown',
        loadAvg: os.loadavg(),
        totalMemoryMb: Math.round(totalMem / (1024 * 1024)),
        freeMemoryMb: Math.round(freeMem / (1024 * 1024)),
        usedMemoryMb: Math.round(usedMem / (1024 * 1024)),
        processRssMb: Math.round(procMem.rss / (1024 * 1024)),
        processHeapUsedMb: Math.round(procMem.heapUsed / (1024 * 1024)),
      },
    });
  });

  router.post('/tools/research', async (req: Request, res: Response) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const language: AppLanguage = req.body?.language === 'fa' ? 'fa' : 'en';
    const urls = Array.isArray(req.body?.urls)
      ? req.body.urls.filter((u: unknown): u is string => typeof u === 'string')
      : [];

    if (!query) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Research query cannot be empty.' },
      });
      return;
    }

    try {
      const result = await performWebResearch(query, language, urls);
      res.json(result);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  router.post('/tools/inspect-url', async (req: Request, res: Response) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const language: AppLanguage = req.body?.language === 'fa' ? 'fa' : 'en';

    if (!url) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'URL cannot be empty.' },
      });
      return;
    }

    try {
      const result = await inspectWebpage(url, prompt, language);
      res.json(result);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  router.post('/tools/download-stream', async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const quality = normalizeQualityPreset(req.body?.quality);
    const cookiesText =
      typeof req.body?.cookiesText === 'string' ? req.body.cookiesText : undefined;
    const cobaltApiUrl =
      typeof req.body?.cobaltApiUrl === 'string' ? req.body.cobaltApiUrl : undefined;

    if (!rawUrl) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'URL cannot be empty.' },
      });
      return;
    }

    try {
      isPublicHttpUrl(rawUrl);

      if (isVideoPlatformUrl(rawUrl)) {
        const videoFile = await downloadFullVideo(rawUrl, {
          quality,
          cookiesText,
          cobaltApiUrl,
        });
        streamDownloadedVideoFile(res, videoFile);
        return;
      }

      let asset = await fetchBinaryAsset(rawUrl, MAX_STREAM_DOWNLOAD_BYTES);
      if (asset.mimeType === 'text/html' || asset.mimeType === 'application/xhtml+xml') {
        const html = asset.buffer.toString('utf8');
        const extractedUrl = extractDirectMediaFromHtml(html, asset.finalUrl);

        // If the extracted fallback is only a cover image, try yt-dlp first in case the page embeds a video stream
        const looksLikeOnlyImage =
          extractedUrl && /\.(?:jpe?g|png|webp|avif|gif)(?:\?|$)/i.test(extractedUrl);
        if (!extractedUrl || looksLikeOnlyImage) {
          try {
            const videoFile = await downloadFullVideo(asset.finalUrl, {
              quality,
              cookiesText,
              cobaltApiUrl,
            });
            streamDownloadedVideoFile(res, videoFile);
            return;
          } catch {
            // Fall through to extracted image/file if one existed
          }
        }

        if (!extractedUrl) {
          res.status(422).json({
            error: {
              code: 'NO_DIRECT_MEDIA',
              message:
                'This URL returned an HTML webpage without a public downloadable file or video stream. Paste a direct media/file link or a supported video link.',
            },
          });
          return;
        }
        asset = await fetchBinaryAsset(extractedUrl, MAX_STREAM_DOWNLOAD_BYTES);
      }

      const filename = buildFinalFilename(
        asset.finalUrl,
        asset.disposition,
        asset.mimeType
      );

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('Content-Length', String(asset.buffer.byteLength));
      res.setHeader('Content-Disposition', sendAsciiSafeDisposition(filename));
      res.setHeader('X-Download-Filename', encodeURIComponent(filename));
      res.setHeader('X-Download-Mime', asset.mimeType);
      res.setHeader('X-Download-Size', String(asset.buffer.byteLength));
      res.setHeader('X-Source-Url', encodeURIComponent(asset.finalUrl));
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Disposition, X-Download-Filename, X-Download-Mime, X-Download-Size, X-Source-Url'
      );
      res.send(asset.buffer);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  router.post('/tools/download-url', async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const quality = normalizeQualityPreset(req.body?.quality);
    const cookiesText =
      typeof req.body?.cookiesText === 'string' ? req.body.cookiesText : undefined;
    const cobaltApiUrl =
      typeof req.body?.cobaltApiUrl === 'string' ? req.body.cobaltApiUrl : undefined;

    if (!rawUrl) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'URL cannot be empty.' },
      });
      return;
    }

    try {
      isPublicHttpUrl(rawUrl);

      if (isVideoPlatformUrl(rawUrl)) {
        const videoFile = await downloadFullVideo(rawUrl, {
          quality,
          cookiesText,
          cobaltApiUrl,
        });
        try {
          if (videoFile.sizeBytes > MAX_DOWNLOAD_BYTES) {
            throw new VideoDownloadError(
              'Full video exceeds 40 MB JSON buffer limit; use streaming download in Download Manager.',
              422,
              'VIDEO_USE_STREAM'
            );
          }
          const buffer = fs.readFileSync(videoFile.filePath);
          res.json({
            success: true,
            url: videoFile.finalUrl,
            filename: videoFile.filename,
            mimeType: videoFile.mimeType,
            sizeBytes: buffer.byteLength,
            base64Data: buffer.toString('base64'),
          });
        } finally {
          videoFile.cleanup();
        }
        return;
      }

      let asset = await fetchBinaryAsset(rawUrl);

      // If the pasted URL is a webpage (text/html), inspect it for direct media (mp4/mp3/jpg/png/pdf)
      if (asset.mimeType === 'text/html' || asset.mimeType === 'application/xhtml+xml') {
        const html = asset.buffer.toString('utf8');
        const extractedUrl = extractDirectMediaFromHtml(html, asset.finalUrl);
        if (!extractedUrl) {
          res.status(422).json({
            error: {
              code: 'NO_DIRECT_MEDIA',
              message:
                'This URL returned an HTML webpage without a public downloadable file or direct .mp4/.mp3/.jpg/.png stream. Paste a direct media/file link or a public page with an embedded media stream.',
            },
          });
          return;
        }
        asset = await fetchBinaryAsset(extractedUrl);
      }

      const filename = buildFinalFilename(
        asset.finalUrl,
        asset.disposition,
        asset.mimeType
      );

      res.json({
        success: true,
        url: asset.finalUrl,
        filename,
        mimeType: asset.mimeType,
        sizeBytes: asset.buffer.byteLength,
        base64Data: asset.buffer.toString('base64'),
      });
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  router.post('/agent/voice-transcribe', async (req: Request, res: Response) => {
    const audioBase64 =
      typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
    const mimeType =
      typeof req.body?.mimeType === 'string' && req.body.mimeType.trim()
        ? req.body.mimeType.trim()
        : 'audio/webm';
    const language: AppLanguage = req.body?.language === 'fa' ? 'fa' : 'en';

    if (!audioBase64) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Audio data is required.' },
      });
      return;
    }

    try {
      const result = await transcribeVoiceInput(audioBase64, mimeType, language);
      res.json(result);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  router.post('/agent/transcribe', async (req: Request, res: Response) => {
    const audioBase64 =
      typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
    const mimeType =
      typeof req.body?.mimeType === 'string' && req.body.mimeType.trim()
        ? req.body.mimeType.trim()
        : 'audio/webm';
    const language: AppLanguage = req.body?.language === 'fa' ? 'fa' : 'en';

    if (!audioBase64) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Audio data is required.' },
      });
      return;
    }

    try {
      const result = await transcribeAndSummarizeMeeting(
        audioBase64,
        mimeType,
        language
      );
      res.json(result);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  router.post('/agent/tts', async (req: Request, res: Response) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const language: AppLanguage = req.body?.language === 'fa' ? 'fa' : 'en';

    if (!text) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Text is required for TTS.' },
      });
      return;
    }

    try {
      const result = await synthesizeSpeechTts(text, language);
      res.json(result);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  return router;
}
