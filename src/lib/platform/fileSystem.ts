import { getCapacitorBridge, isTauriRuntime } from './detectPlatform';

export interface ImportedTextFile {
  title: string;
  content: string;
  extension: string;
}

function stripExtension(filename: string): { title: string; extension: string } {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) {
    return { title: filename, extension: 'txt' };
  }
  return {
    title: filename.slice(0, lastDot),
    extension: filename.slice(lastDot + 1).toLowerCase(),
  };
}

function sanitizeFilename(title: string): string {
  const clean = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ');
  return clean || 'neuron-mind-document';
}

export async function importTextDocument(): Promise<ImportedTextFile | null> {
  if (typeof window === 'undefined') return null;

  if (isTauriRuntime() && window.__TAURI_INTERNALS__?.invoke) {
    try {
      const selectedPath = await window.__TAURI_INTERNALS__.invoke<
        string | null
      >('plugin:dialog|open', {
        options: {
          multiple: false,
          directory: false,
          filters: [
            {
              name: 'Documents',
              extensions: ['txt', 'md', 'markdown', 'json', 'csv'],
            },
          ],
        },
      });
      if (!selectedPath) return null;
      const content = await window.__TAURI_INTERNALS__.invoke<string>(
        'plugin:fs|read_text_file',
        { path: selectedPath }
      );
      const basename = selectedPath.split(/[\\/]/).pop() ?? 'Imported Note.txt';
      const { title, extension } = stripExtension(basename);
      return { title, content: content ?? '', extension };
    } catch {
      // Fall back to standard browser file picker if Tauri plugin is unavailable
    }
  }

  return new Promise<ImportedTextFile | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.markdown,.json,.csv,text/plain,text/markdown,application/json';

    let settled = false;
    const finish = (value: ImportedTextFile | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      try {
        const content = await file.text();
        const { title, extension } = stripExtension(file.name);
        finish({ title, content, extension });
      } catch {
        finish(null);
      }
    });

    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

export async function exportTextDocument(
  title: string,
  content: string
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const baseName = sanitizeFilename(title);
  const fileName = `${baseName}.txt`;

  if (isTauriRuntime() && window.__TAURI_INTERNALS__?.invoke) {
    try {
      const savePath = await window.__TAURI_INTERNALS__.invoke<string | null>(
        'plugin:dialog|save',
        {
          options: {
            defaultPath: fileName,
            filters: [{ name: 'Text / Markdown', extensions: ['txt', 'md'] }],
          },
        }
      );
      if (!savePath) return false;
      await window.__TAURI_INTERNALS__.invoke('plugin:fs|write_text_file', {
        path: savePath,
        contents: content,
      });
      return true;
    } catch {
      // Fall back to browser download below
    }
  }

  const cap = getCapacitorBridge();
  if (cap?.isNativePlatform?.() && cap.Plugins?.Filesystem && cap.Plugins?.Share) {
    try {
      const written = await cap.Plugins.Filesystem.writeFile({
        path: fileName,
        data: content,
        directory: 'CACHE',
        encoding: 'utf8',
      });
      await cap.Plugins.Share.share({
        title: baseName,
        text: content.slice(0, 500),
        url: written.uri,
      });
      return true;
    } catch {
      // Fall through to web download
    }
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
