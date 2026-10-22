/**
 * Utility for managing the official School Logo and School Name across all reports,
 * ensuring high-fidelity rendering, image resizing, and cross-component reactivity.
 */

export const SCHOOL_LOGO_STORAGE_KEY = 'diario_school_logo_v1';
export const SCHOOL_NAME_STORAGE_KEY = 'diario_school_name';
export const INCLUDE_LOGO_STORAGE_KEY = 'diario_include_school_logo_v1';

export const DEFAULT_SCHOOL_NAME = 'Escola Municipal Santos Dumont';

/**
 * Built-in default educational crest SVG fallback
 */
export const DEFAULT_SCHOOL_CREST_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="gradShield" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="gradGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <circle cx="80" cy="80" r="76" fill="none" stroke="url(#gradGold)" stroke-width="4" stroke-dasharray="8 4"/>
  <path d="M 80 14 C 118 14 138 32 138 72 C 138 114 96 142 80 148 C 64 142 22 114 22 72 C 22 32 42 14 80 14 Z" fill="url(#gradShield)" stroke="url(#gradGold)" stroke-width="3"/>
  <path d="M 40 76 C 40 102 58 118 80 126 C 102 118 120 102 120 76" fill="none" stroke="#fcd34d" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <path d="M 80 38 L 118 52 L 80 66 L 42 52 Z" fill="#fbbf24"/>
  <path d="M 54 58 L 54 78 C 54 88 80 94 80 94 C 80 94 106 88 106 78 L 106 58" fill="#d97706" opacity="0.9"/>
  <line x1="112" y1="54" x2="114" y2="76" stroke="#fbbf24" stroke-width="2.5"/>
  <circle cx="114" cy="78" r="3" fill="#fbbf24"/>
  <path d="M 80 86 C 88 82 102 82 112 85 L 112 110 C 102 107 88 107 80 111 C 72 107 58 107 48 110 L 48 85 C 58 82 72 82 80 86 Z" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="80" y1="87" x2="80" y2="111" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="48" cy="42" r="2.5" fill="#fbbf24"/>
  <circle cx="112" cy="42" r="2.5" fill="#fbbf24"/>
  <circle cx="80" cy="134" r="2.5" fill="#fbbf24"/>
</svg>
`)}`;

let cachedDefaultCrestPng: string | null = null;

/**
 * Generates a crisp PNG data URL of the educational crest via Canvas
 * ensuring 100% native compatibility with jsPDF and print views.
 */
export function getDefaultSchoolCrest(): string {
  if (cachedDefaultCrestPng) return cachedDefaultCrestPng;
  if (typeof document === 'undefined') return DEFAULT_SCHOOL_CREST_SVG;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return DEFAULT_SCHOOL_CREST_SVG;

    // Outer Gold Ring
    ctx.beginPath();
    ctx.arc(120, 120, 112, 0, Math.PI * 2);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner Accent Ring
    ctx.beginPath();
    ctx.arc(120, 120, 104, 0, Math.PI * 2);
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Shield
    ctx.beginPath();
    ctx.moveTo(120, 24);
    ctx.bezierCurveTo(176, 24, 204, 48, 204, 108);
    ctx.bezierCurveTo(204, 172, 144, 212, 120, 222);
    ctx.bezierCurveTo(96, 212, 36, 172, 36, 108);
    ctx.bezierCurveTo(36, 48, 64, 24, 120, 24);
    ctx.closePath();

    const grad = ctx.createLinearGradient(120, 24, 120, 222);
    grad.addColorStop(0, '#1e3a8a');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Graduation Cap
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(120, 56);
    ctx.lineTo(176, 76);
    ctx.lineTo(120, 96);
    ctx.lineTo(64, 76);
    ctx.closePath();
    ctx.fill();

    // Cap neck
    ctx.beginPath();
    ctx.moveTo(82, 85);
    ctx.lineTo(82, 114);
    ctx.bezierCurveTo(82, 128, 120, 136, 120, 136);
    ctx.bezierCurveTo(120, 136, 158, 128, 158, 114);
    ctx.lineTo(158, 85);
    ctx.fillStyle = '#d97706';
    ctx.fill();

    // Open Book
    ctx.beginPath();
    ctx.moveTo(120, 130);
    ctx.bezierCurveTo(132, 124, 152, 124, 168, 128);
    ctx.lineTo(168, 166);
    ctx.bezierCurveTo(152, 162, 132, 162, 120, 168);
    ctx.bezierCurveTo(108, 162, 88, 162, 72, 166);
    ctx.lineTo(72, 128);
    ctx.bezierCurveTo(88, 124, 108, 124, 120, 130);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Book center line
    ctx.beginPath();
    ctx.moveTo(120, 130);
    ctx.lineTo(120, 168);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Gold Stars
    ctx.fillStyle = '#fbbf24';
    const drawStar = (cx: number, cy: number, r: number) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    drawStar(72, 60, 4);
    drawStar(168, 60, 4);
    drawStar(120, 200, 4);

    cachedDefaultCrestPng = canvas.toDataURL('image/png');
    return cachedDefaultCrestPng;
  } catch (e) {
    return DEFAULT_SCHOOL_CREST_SVG;
  }
}

export const DEFAULT_SCHOOL_CREST = DEFAULT_SCHOOL_CREST_SVG;

/**
 * Retrieves the currently saved school logo base64 string
 */
export function getSchoolLogo(): string | null {
  try {
    const stored = localStorage.getItem(SCHOOL_LOGO_STORAGE_KEY);
    if (stored === 'none') {
      return null;
    }
    if (stored && stored.startsWith('data:image')) {
      return stored;
    }
    // Default to the official crest if not yet specified
    return getDefaultSchoolCrest();
  } catch (_) {
    return null;
  }
}

/**
 * Saves a new school logo and triggers global update event
 */
export function setSchoolLogo(logoBase64: string | null): void {
  try {
    if (logoBase64) {
      localStorage.setItem(SCHOOL_LOGO_STORAGE_KEY, logoBase64);
    } else {
      localStorage.setItem(SCHOOL_LOGO_STORAGE_KEY, 'none');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('diario_school_config_changed', {
        detail: { key: 'logo', value: logoBase64 }
      }));
    }
  } catch (err) {
    console.warn('Erro ao salvar logo da escola:', err);
  }
}

/**
 * Retrieves the currently saved school name
 */
export function getSchoolName(): string {
  try {
    return localStorage.getItem(SCHOOL_NAME_STORAGE_KEY) || DEFAULT_SCHOOL_NAME;
  } catch (_) {
    return DEFAULT_SCHOOL_NAME;
  }
}

/**
 * Saves a new school name and triggers global update event
 */
export function setSchoolName(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem(SCHOOL_NAME_STORAGE_KEY, trimmed);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('diario_school_config_changed', {
        detail: { key: 'name', value: trimmed }
      }));
    }
  } catch (err) {
    console.warn('Erro ao salvar nome da escola:', err);
  }
}

/**
 * Retrieves the user's preference for whether to include the school logo in reports
 * Defaults to true
 */
export function getIncludeSchoolLogoPreference(): boolean {
  try {
    const val = localStorage.getItem(INCLUDE_LOGO_STORAGE_KEY);
    if (val === null) return true; // Default is ON
    return val === 'true';
  } catch (_) {
    return true;
  }
}

/**
 * Saves the preference for including school logo in reports
 */
export function setIncludeSchoolLogoPreference(include: boolean): void {
  try {
    localStorage.setItem(INCLUDE_LOGO_STORAGE_KEY, String(include));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('diario_school_config_changed', {
        detail: { key: 'includeLogo', value: include }
      }));
    }
  } catch (_) {}
}

/**
 * Subscribes to changes to school logo or school name across components
 */
export function subscribeSchoolConfig(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener('diario_school_config_changed', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('diario_school_config_changed', handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * Compresses and resizes an uploaded image file into a compact base64 PNG/JPEG
 * suitable for localStorage and high-DPI PDF generation (max dimensions ~360x360px).
 */
export async function resizeImageFileToBase64(file: File, maxDim = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    // If SVG, convert or read directly as data URL
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const svgDataUrl = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const dim = 360;
          canvas.width = dim;
          canvas.height = dim;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, dim, dim);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(svgDataUrl);
          }
        };
        img.onerror = () => resolve(svgDataUrl);
        img.src = svgDataUrl;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Keep PNG transparency if original is PNG, otherwise JPEG 0.9
        const isPng = file.type === 'image/png';
        const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.9);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(event.target?.result as string);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}
