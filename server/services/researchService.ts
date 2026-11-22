import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getServerConfig } from '../config/env.ts';
import type { AppLanguage } from '../core/types.ts';
import { GeminiConfigurationError } from './geminiClient.ts';

function getAiClient(timeoutMs = 30000): GoogleGenAI {
  const { geminiApiKey } = getServerConfig();
  if (!geminiApiKey) {
    throw new GeminiConfigurationError(
      'Gemini API key is not configured on the server.'
    );
  }
  return new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

export function formatUpstreamErrorMessage(error: unknown, language: AppLanguage = 'en'): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unexpected error');

  // Unwrap raw JSON payload returned by Google GenAI SDK if embedded
  let parsedMessage = '';
  let parsedStatus = '';
  let parsedCode: number | undefined;
  const jsonStart = raw.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const obj = JSON.parse(raw.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (obj?.error) {
        parsedMessage = obj.error.message ?? '';
        parsedStatus = obj.error.status ?? '';
        parsedCode = obj.error.code;
      }
    } catch {
      // keep raw
    }
  }

  const combined = `${raw} ${parsedStatus} ${parsedMessage}`.toLowerCase();

  if (parsedCode === 429 || combined.includes('resource_exhausted') || combined.includes('quota')) {
    return language === 'fa'
      ? 'سهمیه موقت مدل هوش مصنوعی تکمیل شده است؛ نتایج از جستجوی مستقیم وب جایگزین دریافت شدند یا چند لحظه دیگر دوباره تلاش کنید.'
      : 'Gemini API rate/quota limit reached right now. Falling back to live direct web lookup where possible, or please retry shortly.';
  }

  if (parsedCode === 504 || combined.includes('deadline_exceeded') || combined.includes('timed out') || combined.includes('aborted')) {
    return language === 'fa'
      ? 'پاسخ‌دهی وب‌سایت هدف بیش از حد طول کشید. لطفاً دوباره تلاش کنید یا لینک مستقیم‌تری وارد نمایید.'
      : 'The target webpage took too long to respond. Please try again or inspect a more direct public page URL.';
  }

  if (parsedCode === 503 || combined.includes('unavailable')) {
    return language === 'fa'
      ? 'سرویس هوش مصنوعی موقتاً شلوغ است. لطفاً چند لحظه دیگر دوباره تلاش کنید.'
      : 'AI service is temporarily busy. Please retry in a moment.';
  }

  return parsedMessage || raw;
}

function isQuotaOrTimeoutError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('504') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('timeout')
  );
}

export function isPublicHttpUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are permitted.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('Local and internal network addresses are blocked for security.');
  }

  // Block private IPv4 literals
  const ipv4Match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      throw new Error('Private IP addresses are blocked for security.');
    }
  }

  return parsed;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ResearchSource {
  title: string;
  uri: string;
}

export interface WebResearchResult {
  summary: string;
  sources: ResearchSource[];
  queriedAt: string;
}

function extractSearchKeywords(rawQuery: string): string {
  const cleaned = rawQuery
    .replace(
      /^(?:please\s+)?(?:can\s+you\s+)?(?:find|search\s+for|look\s+up|give\s+me|show\s+me|what\s+is|what\s+are|tell\s+me)\s+(?:a\s+|an\s+|the\s+)?(?:perfect|best|good|great|top)?\s*(?:webpage|website|page|site|link|article|tool)s?\s*(?:for|to|about|on)?\s*/i,
      ''
    )
    .replace(
      /^(?:لطفاً\s+)?(?:برای\s+من\s+)?(?:جستجو\s+کن|پیدا\s+کن|معرفی\s+کن)\s*/i,
      ''
    )
    .replace(/\b(?:building\s+and\s+designing|creating\s+and\s+designing)\b/gi, 'design')
    .trim();
  return cleaned.length >= 3 ? cleaned : rawQuery.trim();
}

async function fallbackWebSearch(
  query: string,
  language: AppLanguage
): Promise<WebResearchResult> {
  const sources: ResearchSource[] = [];
  const snippets: string[] = [];
  const seen = new Set<string>();
  const searchQuery = extractSearchKeywords(query);

  // 1. DuckDuckGo Instant Answer API (zero-CAPTCHA structured topics/definitions)
  try {
    const ddgResp = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`,
      {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'NeuronMind-Research/1.0' },
      }
    );
    if (ddgResp.ok) {
      const data = (await ddgResp.json()) as {
        Heading?: string;
        AbstractText?: string;
        AbstractURL?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
      };
      if (data.AbstractURL && data.AbstractText && !seen.has(data.AbstractURL)) {
        seen.add(data.AbstractURL);
        const title = data.Heading || data.AbstractURL;
        sources.push({ title, uri: data.AbstractURL });
        snippets.push(`• **${title}** — ${data.AbstractText}\n  ${data.AbstractURL}`);
      }
      for (const topic of (data.RelatedTopics ?? []).slice(0, 4)) {
        if (topic.FirstURL && topic.Text && !seen.has(topic.FirstURL)) {
          seen.add(topic.FirstURL);
          const title = topic.Text.split(' - ')[0].slice(0, 90) || topic.FirstURL;
          sources.push({ title, uri: topic.FirstURL });
          snippets.push(`• **${title}** — ${topic.Text}\n  ${topic.FirstURL}`);
        }
      }
    }
  } catch {
    // ignore DDG IA error
  }

  // 2. Wikipedia Action Search API (reliable multilingual EN/FA results)
  try {
    const wikiHost = language === 'fa' ? 'fa.wikipedia.org' : 'en.wikipedia.org';
    const wikiResp = await fetch(
      `https://${wikiHost}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&srlimit=4&utf8=&format=json`,
      {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'NeuronMind-Research/1.0' },
      }
    );
    if (wikiResp.ok) {
      const data = (await wikiResp.json()) as {
        query?: { search?: Array<{ title?: string; snippet?: string }> };
      };
      for (const item of data.query?.search ?? []) {
        if (!item.title) continue;
        const uri = `https://${wikiHost}/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
        const snippet = stripHtmlTags(item.snippet || '');
        if (!seen.has(uri)) {
          seen.add(uri);
          sources.push({ title: `${item.title} — Wikipedia`, uri });
          snippets.push(`• **${item.title}**${snippet ? ` — ${snippet}` : ''}\n  ${uri}`);
        }
      }
    }
  } catch {
    // ignore Wikipedia error
  }

  // 3. Hacker News / Algolia Search API (live community links, tools, web discussions)
  try {
    const hnResp = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(searchQuery)}&tags=story&hitsPerPage=6`,
      {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'NeuronMind-Research/1.0' },
      }
    );
    if (hnResp.ok) {
      const hnData = (await hnResp.json()) as {
        hits?: Array<{ title?: string; url?: string; objectID?: string; points?: number }>;
      };
      for (const hit of hnData.hits ?? []) {
        const uri = hit.url || (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : '');
        const title = hit.title?.trim();
        if (title && uri && !seen.has(uri)) {
          seen.add(uri);
          sources.push({ title, uri });
          snippets.push(`• **${title}**\n  ${uri}`);
        }
      }
    }
  } catch {
    // ignore HN error
  }

  // 4. GitHub Repositories API fallback if still fewer than 3 results
  if (sources.length < 3) {
    try {
      const ghResp = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&per_page=4`,
        {
          signal: AbortSignal.timeout(6000),
          headers: {
            'User-Agent': 'NeuronMind-Research/1.0',
            Accept: 'application/vnd.github+json',
          },
        }
      );
      if (ghResp.ok) {
        const ghData = (await ghResp.json()) as {
          items?: Array<{ full_name?: string; html_url?: string; description?: string }>;
        };
        for (const repo of ghData.items ?? []) {
          if (repo.html_url && repo.full_name && !seen.has(repo.html_url)) {
            seen.add(repo.html_url);
            sources.push({ title: repo.full_name, uri: repo.html_url });
            snippets.push(
              `• **${repo.full_name}**${repo.description ? ` — ${repo.description}` : ''}\n  ${repo.html_url}`
            );
          }
        }
      }
    } catch {
      // ignore GitHub error
    }
  }

  if (sources.length === 0) {
    throw new Error(
      language === 'fa'
        ? 'در حال حاضر دسترسی به جستجوی وب با محدودیت مواجه است. لطفاً چند لحظه دیگر دوباره تلاش کنید.'
        : 'Web search is temporarily rate-limited across upstream providers. Please retry in a few moments.'
    );
  }

  const header =
    language === 'fa'
      ? `نتایج زنده جستجوی وب برای «${query}» (کلمات کلیدی: ${searchQuery}):`
      : `Live Web Search Results for "${query}" (keywords: ${searchQuery}):`;

  return {
    summary: `${header}\n\n${snippets.join('\n\n')}`,
    sources,
    queriedAt: new Date().toISOString(),
  };
}

export async function performWebResearch(
  query: string,
  language: AppLanguage,
  urls: string[] = []
): Promise<WebResearchResult> {
  const ai = getAiClient(30000);
  const { geminiModel } = getServerConfig();

  const safeUrls = urls
    .map((u) => {
      try {
        return isPublicHttpUrl(u).toString();
      } catch {
        return null;
      }
    })
    .filter((u): u is string => Boolean(u));

  const langLabel = language === 'fa' ? 'Persian (Farsi)' : 'English';
  const urlSection =
    safeUrls.length > 0
      ? `\nAlso inspect and compare these specific URLs if helpful:\n${safeUrls.join('\n')}`
      : '';

  const candidateModels = Array.from(
    new Set([geminiModel, 'gemini-3.1-flash-lite'])
  );

  for (const modelName of candidateModels) {
    try {
      const isGemini4 = modelName.startsWith('gemini-4-');
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Research the following query carefully using live web search and cite verifiable facts clearly in ${langLabel}:\n\n${query}${urlSection}`,
        config: {
          tools:
            safeUrls.length > 0
              ? [{ googleSearch: {} }, { urlContext: {} }]
              : [{ googleSearch: {} }],
          ...(isGemini4 ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        },
      });

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const sources: ResearchSource[] = [];

      for (const chunk of chunks) {
        const web = chunk.web;
        if (web?.uri && !seenUris.has(web.uri)) {
          seenUris.add(web.uri);
          sources.push({
            title: web.title || web.uri,
            uri: web.uri,
          });
        }
      }

      return {
        summary:
          response.text?.trim() ||
          (language === 'fa'
            ? 'نتیجه متنی از جستجو دریافت نشد.'
            : 'No text summary was returned from web search.'),
        sources,
        queriedAt: new Date().toISOString(),
      };
    } catch {
      // try next valid model, then fall back to live direct web search
    }
  }

  // Fallback to live Bing + DuckDuckGo + Wikipedia search when Gemini search quota/model errors occur
  return fallbackWebSearch(query, language);
}

interface ExtractedPageInfo {
  finalUrl: string;
  title: string;
  description: string;
  siteName: string;
  ogImage?: string;
  ogVideo?: string;
  headings: string[];
  navHints: string[];
  textExcerpt: string;
}

function extractMetaContent(html: string, attrName: string, attrValue: string): string {
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp(
    `<meta[^>]*${attrName}=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    'i'
  );
  const re2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attrName}=["']${escaped}["'][^>]*>`,
    'i'
  );
  const match = html.match(re1) || html.match(re2);
  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : '';
}

function extractJsonLdSummary(html: string): { title?: string; description?: string; keywords?: string } {
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1]) as Record<string, unknown> | Array<Record<string, unknown>>;
      const item = Array.isArray(parsed) ? parsed[0] : parsed;
      if (item && typeof item === 'object') {
        const title =
          (typeof item.headline === 'string' && item.headline) ||
          (typeof item.name === 'string' && item.name) ||
          undefined;
        const description =
          (typeof item.description === 'string' && item.description) ||
          (typeof item.articleBody === 'string' && item.articleBody.slice(0, 400)) ||
          undefined;
        const keywords = typeof item.keywords === 'string' ? item.keywords : undefined;
        if (title || description) return { title, description, keywords };
      }
    } catch {
      // ignore malformed ld+json
    }
  }
  return {};
}

function extractHtmlDetails(html: string, finalUrl: string): ExtractedPageInfo {
  const ld = extractJsonLdSummary(html);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? stripHtmlTags(titleMatch[1]) : '';
  const ogTitle = extractMetaContent(html, 'property', 'og:title');
  const twitterTitle = extractMetaContent(html, 'name', 'twitter:title');
  const title = ld.title || ogTitle || rawTitle || twitterTitle || finalUrl;

  const description =
    extractMetaContent(html, 'name', 'description') ||
    extractMetaContent(html, 'property', 'og:description') ||
    extractMetaContent(html, 'name', 'twitter:description') ||
    ld.description ||
    '';

  const siteName = extractMetaContent(html, 'property', 'og:site_name') || new URL(finalUrl).hostname;
  const ogImage =
    extractMetaContent(html, 'property', 'og:image:secure_url') ||
    extractMetaContent(html, 'property', 'og:image') ||
    extractMetaContent(html, 'name', 'twitter:image') ||
    undefined;
  const ogVideo =
    extractMetaContent(html, 'property', 'og:video:secure_url') ||
    extractMetaContent(html, 'property', 'og:video:url') ||
    extractMetaContent(html, 'property', 'og:video') ||
    undefined;

  const headings: string[] = [];
  const headingMatches = html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
  for (const m of headingMatches) {
    const clean = stripHtmlTags(m[1]);
    if (clean && !headings.includes(clean)) {
      headings.push(clean);
      if (headings.length >= 12) break;
    }
  }

  const navHints: string[] = [];
  const searchForms = Array.from(
    html.matchAll(/<(?:input|form|a)[^>]*?(?:search|placeholder|aria-label|href)[^>]*>/gi)
  ).slice(0, 25);
  for (const m of searchForms) {
    const tag = m[0];
    if (/search|جستجو/i.test(tag)) {
      const placeholder = tag.match(/placeholder=["']([^"']+)["']/i)?.[1];
      const aria = tag.match(/aria-label=["']([^"']+)["']/i)?.[1];
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      const hint = placeholder || aria || href;
      if (hint && !navHints.includes(hint)) {
        navHints.push(decodeHtmlEntities(hint));
      }
    }
  }

  // Strip scripts, styles, SVGs, noscript (including any unclosed trailing blocks)
  const cleanedBody = html
    .replace(/<script[\s\S]*?(?:<\/script>|$)/gi, ' ')
    .replace(/<style[\s\S]*?(?:<\/style>|$)/gi, ' ')
    .replace(/<noscript[\s\S]*?(?:<\/noscript>|$)/gi, ' ')
    .replace(/<svg[\s\S]*?(?:<\/svg>|$)/gi, ' ');
  const rawVisible = stripHtmlTags(cleanedBody)
    // Remove accidental inline CSS selector blocks like `.foo{...}`
    .replace(/(?:[.#@][\w:-]+\s*)+\{[^}]{2,500}\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const textExcerpt = (rawVisible || ld.description || ld.keywords || '').slice(0, 7000);

  return {
    finalUrl,
    title,
    description,
    siteName,
    ogImage,
    ogVideo,
    headings,
    navHints,
    textExcerpt,
  };
}

async function fetchPublicWebpageHtml(safeUrl: string): Promise<ExtractedPageInfo | null> {
  try {
    const resp = await fetch(safeUrl, {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
      },
    });
    const finalUrl = resp.url || safeUrl;
    isPublicHttpUrl(finalUrl);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/') && !contentType.includes('html') && !contentType.includes('json') && !contentType.includes('xml')) {
      return {
        finalUrl,
        title: finalUrl,
        description: `Direct resource (${contentType})`,
        siteName: new URL(finalUrl).hostname,
        headings: [],
        navHints: [],
        textExcerpt: `Resource Content-Type: ${contentType}`,
      };
    }
    const rawText = (await resp.text()).slice(0, 2000000);
    return extractHtmlDetails(rawText, finalUrl);
  } catch {
    return null;
  }
}

export async function inspectWebpage(
  url: string,
  prompt: string,
  language: AppLanguage
): Promise<{ url: string; analysis: string; sources: ResearchSource[] }> {
  const safeUrl = isPublicHttpUrl(url).toString();
  const langLabel = language === 'fa' ? 'Persian (Farsi)' : 'English';
  const userQuestion =
    prompt || 'Summarize the key information, headings, links, and facts on this page.';

  // 1. Fast direct HTTP metadata & text fetch (< 10s) to avoid slow Gemini urlContext 504 timeouts
  const extracted = await fetchPublicWebpageHtml(safeUrl);
  const ai = getAiClient(25000);
  const { geminiModel } = getServerConfig();
  const candidateModels = Array.from(
    new Set([geminiModel, 'gemini-3.1-flash-lite'])
  );

  if (extracted) {
    const contextBlock = [
      `URL: ${extracted.finalUrl}`,
      `Site: ${extracted.siteName}`,
      `Title: ${extracted.title}`,
      extracted.description ? `Description: ${extracted.description}` : '',
      extracted.headings.length > 0 ? `Headings: ${extracted.headings.join(' | ')}` : '',
      extracted.navHints.length > 0 ? `Search/Nav UI hints: ${extracted.navHints.join(' | ')}` : '',
      extracted.ogVideo ? `Embedded Video URL: ${extracted.ogVideo}` : '',
      extracted.ogImage ? `Preview Image URL: ${extracted.ogImage}` : '',
      extracted.textExcerpt ? `Visible Page Excerpt:\n${extracted.textExcerpt}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    for (const modelName of candidateModels) {
      try {
        const isGemini4 = modelName.startsWith('gemini-4-');
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `Based on the fetched webpage details below, answer the user's question clearly and helpfully in ${langLabel}. If the user asks about site UI controls like Search on well-known platforms (e.g. Pinterest, GitHub, YouTube) and the extracted DOM confirms the page type, explain both what this specific page contains and how to reach that feature cleanly.\n\nQuestion: ${userQuestion}\n\n---\n${contextBlock}`,
          config: {
            ...(isGemini4 ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          },
        });
        const text = response.text?.trim();
        if (text) {
          return {
            url: extracted.finalUrl,
            analysis: text,
            sources: [{ title: extracted.title || extracted.finalUrl, uri: extracted.finalUrl }],
          };
        }
      } catch {
        // try next model or fall back to structured metadata analysis
      }
    }

    // Direct clean metadata report if Gemini quota is exhausted
    const isPinterest = extracted.finalUrl.toLowerCase().includes('pinterest.');
    const pinterestTip = isPinterest
      ? language === 'fa'
        ? 'راهنمای جستجو در پینترست: نوار جستجو در بالای صفحه (آیکون ذره‌بین یا کادر Search) قرار دارد. همچنین می‌توانید مستقیم به آدرس https://www.pinterest.com/search/pins/?q=کلیدواژه بروید.'
        : 'How to reach Search on Pinterest: Use the Search bar at the very top of the page (or tap the magnifying glass icon at the bottom on mobile). You can also open https://www.pinterest.com/search/pins/?q=your+topic directly.'
      : '';

    const fallbackAnalysis =
      language === 'fa'
        ? [
            `عنوان صفحه: ${extracted.title}`,
            `وب‌سایت: ${extracted.siteName}`,
            extracted.description ? `توضیحات: ${extracted.description}` : '',
            extracted.headings.length > 0 ? `سرفصل‌ها:\n- ${extracted.headings.join('\n- ')}` : '',
            extracted.navHints.length > 0
              ? `بخش‌های جستجو/ناوبری یافت‌شده: ${extracted.navHints.join('، ')}`
              : '',
            pinterestTip,
            extracted.textExcerpt ? `بخشی از متن صفحه:\n${extracted.textExcerpt.slice(0, 800)}` : '',
          ]
            .filter(Boolean)
            .join('\n\n')
        : [
            `Page Title: ${extracted.title}`,
            `Site: ${extracted.siteName}`,
            extracted.description ? `Description: ${extracted.description}` : '',
            extracted.headings.length > 0 ? `Headings:\n- ${extracted.headings.join('\n- ')}` : '',
            extracted.navHints.length > 0
              ? `Detected Search / Nav Elements: ${extracted.navHints.join(', ')}`
              : '',
            pinterestTip,
            extracted.textExcerpt ? `Page Text Excerpt:\n${extracted.textExcerpt.slice(0, 800)}` : '',
          ]
            .filter(Boolean)
            .join('\n\n');

    return {
      url: extracted.finalUrl,
      analysis: fallbackAnalysis,
      sources: [{ title: extracted.title || extracted.finalUrl, uri: extracted.finalUrl }],
    };
  }

  // 2. Fallback to urlContext with 20s timeout if direct fetch was blocked
  let lastError: unknown;
  for (const modelName of candidateModels) {
    try {
      const isGemini4 = modelName.startsWith('gemini-4-');
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Read the webpage ${safeUrl} using urlContext and answer the following in ${langLabel}:\n${userQuestion}`,
        config: {
          tools: [{ urlContext: {} }],
          ...(isGemini4 ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        },
      });
      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources: ResearchSource[] = [];
      const seen = new Set<string>();
      for (const chunk of chunks) {
        if (chunk.web?.uri && !seen.has(chunk.web.uri)) {
          seen.add(chunk.web.uri);
          sources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
      }
      if (!seen.has(safeUrl)) {
        sources.unshift({ title: safeUrl, uri: safeUrl });
      }
      return {
        url: safeUrl,
        analysis: response.text?.trim() || '',
        sources,
      };
    } catch (err) {
      lastError = err;
      if (!isQuotaOrTimeoutError(err)) break;
    }
  }

  throw new Error(formatUpstreamErrorMessage(lastError, language));
}

export interface MeetingAnalysisResult {
  transcript: string;
  summary: string;
  decisions: string[];
  actionItems: Array<{ title: string; owner?: string; priority: 'low' | 'medium' | 'high' }>;
}

export async function transcribeVoiceInput(
  audioBase64: string,
  mimeType: string,
  language: AppLanguage
): Promise<{ transcript: string }> {
  const ai = getAiClient(25000);
  const { geminiModel } = getServerConfig();
  const candidates = Array.from(
    new Set(['gemini-3.5-transcribe', geminiModel, 'gemini-3.1-flash-lite'])
  );

  const hintLang =
    language === 'fa'
      ? 'The user may speak Persian (Farsi), English, or both.'
      : 'The user may speak English, Persian (Farsi), or both.';

  let lastError: unknown;
  for (const model of candidates) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: audioBase64,
            },
          },
          {
            text: `Transcribe the spoken voice input accurately into plain text in the original spoken language. ${hintLang} Return ONLY the spoken words without timestamps, speaker labels, quotes, markdown, or extra commentary. If no speech is audible, return an empty string.`,
          },
        ],
      });
      const transcript = (response.text ?? '').trim();
      return { transcript };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to transcribe voice audio.');
}

export async function transcribeAndSummarizeMeeting(
  audioBase64: string,
  mimeType: string,
  language: AppLanguage
): Promise<MeetingAnalysisResult> {
  const ai = getAiClient(45000);
  const { geminiModel } = getServerConfig();

  const transcriptResponse = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: [
      {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      },
      {
        text: 'Generate an accurate verbatim transcript of this audio. Preserve spoken English and Persian words faithfully, noting speaker shifts where clear.',
      },
    ],
  });

  const transcript = transcriptResponse.text?.trim() || '';
  if (!transcript) {
    throw new Error('No speech could be transcribed from the audio file.');
  }

  const langLabel = language === 'fa' ? 'Persian (Farsi)' : 'English';
  const analysisResponse = await ai.models.generateContent({
    model: geminiModel,
    contents: `Analyze this meeting transcript and extract a concise summary, key decisions, and actionable tasks in ${langLabel}:\n\n${transcript}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                owner: { type: Type.STRING },
                priority: { type: Type.STRING },
              },
              required: ['title', 'priority'],
            },
          },
        },
        required: ['summary', 'decisions', 'actionItems'],
      },
    },
  });

  let parsed: {
    summary?: string;
    decisions?: string[];
    actionItems?: Array<{ title?: string; owner?: string; priority?: string }>;
  } = {};

  try {
    parsed = JSON.parse(analysisResponse.text || '{}');
  } catch {
    parsed = { summary: analysisResponse.text || '', decisions: [], actionItems: [] };
  }

  return {
    transcript,
    summary: parsed.summary?.trim() || transcript.slice(0, 400),
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map((item) => ({
          title: String(item.title ?? '').trim() || 'Follow up',
          owner: item.owner ? String(item.owner) : undefined,
          priority:
            item.priority === 'high' || item.priority === 'low'
              ? item.priority
              : 'medium',
        }))
      : [],
  };
}

function wrapPcmAsWav(pcmBytes: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBytes.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBytes]);
}

export async function synthesizeSpeechTts(
  text: string,
  _language: AppLanguage
): Promise<{ audioBase64: string; mimeType: string }> {
  const ai = getAiClient(30000);
  const cleanText = text.trim().slice(0, 2500);
  if (!cleanText) {
    throw new Error('Text for speech synthesis cannot be empty.');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: cleanText,
    config: {
      responseModalities: ['AUDIO'],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const rawMime = part.inlineData.mimeType || 'audio/wav';
      const rawBuf = Buffer.from(part.inlineData.data, 'base64');
      if (rawMime.includes('L16') || rawMime.includes('pcm')) {
        const rateMatch = rawMime.match(/rate=(\d+)/);
        const rate = rateMatch ? Number(rateMatch[1]) : 24000;
        const wav = wrapPcmAsWav(rawBuf, rate, 1, 16);
        return {
          audioBase64: wav.toString('base64'),
          mimeType: 'audio/wav',
        };
      }
      return {
        audioBase64: part.inlineData.data,
        mimeType: rawMime,
      };
    }
  }

  throw new Error('Audio synthesis returned no audio data.');
}
