import { useMemo, useSyncExternalStore } from 'react';
import type { Language } from '../types';

// ─── Popup i18n ──────────────────────────────────────────────────────────────
// Flat string dictionaries keyed by language. Components read strings through
// the `useI18n()` hook, which re-renders them when the language changes.

const en = {
  // Header
  'header.active': 'Active',
  'header.off': 'Off',

  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.sites': 'Sites',
  'nav.statistics': 'Statistics',
  'nav.settings': 'Settings',
  'nav.data': 'Import / Export',

  // Loading
  'loading.settings': 'Loading settings',
  'loading.text': 'Loading…',

  // Monitoring card
  'monitoring.detecting': 'Detecting videos…',
  'monitoring.noPage': 'No webpage detected',
  'monitoring.unreachable': 'Content script unreachable',
  'monitoring.oneVideo': '1 video detected',
  'monitoring.videos': '{count} videos detected',
  'monitoring.openSite': 'Open a video website',
  'monitoring.add': 'Add',
  'monitoring.monitoring': 'Monitoring',
  'monitoring.idle': 'Idle',

  // Profile select
  'profile.label': 'Profile',
  'profile.hint': 'Speed preset for this site',
  'profile.custom': 'Custom',

  // Speed controls
  'speed.current': 'Current Speed',
  'speed.custom': 'Custom (> 0)',
  'speed.quickPresets': 'Quick speed presets',
  'speed.setQuick': 'Set speed to {speed}x',
  'speed.dial': 'Playback speed dial',
  'speed.unsupportedHint':
    'Open a supported video website — or add its domain in Sites — to control its speed.',

  // Dashboard stats
  'stats.watched': 'Watched',
  'stats.videos': 'Videos',
  'stats.avgSpeed': 'Avg. Speed',
  'stats.timeSaved': 'Time Saved',
  'stats.thisWeek': 'This week',
  'stats.allSessions': 'All sessions',
  'stats.savedTooltip': 'Time saved compared to watching everything at 1x speed',

  // Sites page
  'sites.supported': 'Supported websites',
  'sites.speedFor': 'Speed for {site}',
  'sites.removeSite': 'Remove {site}',
  'sites.resetTo1x': 'Reset to 1x',
  'sites.custom': 'Custom websites',
  'sites.customHint': 'Add a domain to apply a fixed speed to its videos.',
  'sites.domainPlaceholder': 'example.com',
  'sites.domainLabel': 'Custom website domain',
  'sites.add': 'Add',
  'sites.empty': 'No custom domains yet.',

  // Statistics page
  'statistics.breakdown': 'Breakdown',
  'statistics.today': 'Today',
  'statistics.thisWeek': 'This week',
  'statistics.allTime': 'All time',
  'statistics.watched': 'Watched',
  'statistics.saved': 'Saved',
  'statistics.sessions': 'Sessions',

  // Settings page
  'settings.enable': 'Enable Extension',
  'settings.enableSub': 'Apply the saved speed on supported sites',
  'settings.overlay': 'Speed Overlay',
  'settings.overlaySub': 'Show the current speed on each video',
  'settings.language': 'Language',
  'settings.languageSub': 'Popup display language',
  'settings.profiles': 'Speed profiles',
  'settings.addProfile': 'Add',
  'settings.profileHint':
    'Assign a profile to a website from the Dashboard to reuse its speed.',
  'settings.dangerZone': 'Danger zone',
  'settings.resetStats': 'Reset statistics',
  'settings.resetting': 'Resetting…',

  // Data page
  'data.title': 'Backup & restore',
  'data.hint':
    'Export your settings, profiles and statistics to a JSON file, or import a previous backup. Replace overwrites everything; Merge keeps the larger of each statistic.',
  'data.replace': 'Replace',
  'data.merge': 'Merge',
  'data.export': 'Export',
  'data.reset': 'Reset',
  'data.importing': 'Importing…',
  'data.exporting': 'Exporting…',
  'data.resetting': 'Resetting…',

  // Status messages
  'status.saveFailed': 'Save failed: {error}',
  'status.invalidDomain': 'Enter a valid domain, such as example.com.',
  'status.alreadySupported': 'This website is already supported automatically.',
  'status.alreadyAdded': 'This domain is already in your custom sites.',
  'status.domainAdded': '{domain} added.',
  'status.domainRemoved': '{domain} removed.',
  'status.exportFailed': 'Export failed: {error}',
  'status.exportDone': 'Export complete.',
  'status.importFailed': 'Import failed: {error}',
  'status.importDone':
    'Imported ({mode}) — {sessions} sessions, {watched} watched, {saved} saved.',
  'status.statsReset': 'Statistics reset.',
  'status.resetFailed': 'Reset failed: {error}',

  // Duration units
  'duration.hours': '{value}h',
  'duration.minutes': '{value}m',
  'duration.seconds': '{value}s',
} as const;

export type TranslationKey = keyof typeof en;

const vi: Record<TranslationKey, string> = {
  // Header
  'header.active': 'Đang bật',
  'header.off': 'Đã tắt',

  // Navigation
  'nav.dashboard': 'Bảng điều khiển',
  'nav.sites': 'Trang web',
  'nav.statistics': 'Thống kê',
  'nav.settings': 'Cài đặt',
  'nav.data': 'Nhập / Xuất',

  // Loading
  'loading.settings': 'Đang tải cài đặt',
  'loading.text': 'Đang tải…',

  // Monitoring card
  'monitoring.detecting': 'Đang tìm video…',
  'monitoring.noPage': 'Chưa phát hiện trang web',
  'monitoring.unreachable': 'Không kết nối được content script',
  'monitoring.oneVideo': 'Đã phát hiện 1 video',
  'monitoring.videos': 'Đã phát hiện {count} video',
  'monitoring.openSite': 'Mở một trang web video',
  'monitoring.add': 'Thêm',
  'monitoring.monitoring': 'Đang theo dõi',
  'monitoring.idle': 'Nghỉ',

  // Profile select
  'profile.label': 'Hồ sơ',
  'profile.hint': 'Tốc độ mẫu cho trang này',
  'profile.custom': 'Tùy chỉnh',

  // Speed controls
  'speed.current': 'Tốc độ hiện tại',
  'speed.custom': 'Tùy chỉnh (> 0)',
  'speed.quickPresets': 'Nút tốc độ nhanh',
  'speed.setQuick': 'Đặt tốc độ thành {speed}x',
  'speed.dial': 'Núm chỉnh tốc độ',
  'speed.unsupportedHint':
    'Mở một trang web video được hỗ trợ — hoặc thêm tên miền của nó trong mục Trang web — để điều chỉnh tốc độ.',

  // Dashboard stats
  'stats.watched': 'Đã xem',
  'stats.videos': 'Video',
  'stats.avgSpeed': 'Tốc độ TB',
  'stats.timeSaved': 'Thời gian tiết kiệm',
  'stats.thisWeek': 'Tuần này',
  'stats.allSessions': 'Tất cả phiên',
  'stats.savedTooltip':
    'Thời gian tiết kiệm so với xem mọi thứ ở tốc độ 1x',

  // Sites page
  'sites.supported': 'Trang web được hỗ trợ',
  'sites.speedFor': 'Tốc độ cho {site}',
  'sites.removeSite': 'Xóa {site}',
  'sites.resetTo1x': 'Đặt lại về 1x',
  'sites.custom': 'Trang web tùy chỉnh',
  'sites.customHint':
    'Thêm tên miền để áp dụng tốc độ cố định cho video trên trang đó.',
  'sites.domainPlaceholder': 'example.com',
  'sites.domainLabel': 'Tên miền trang web tùy chỉnh',
  'sites.add': 'Thêm',
  'sites.empty': 'Chưa có tên miền tùy chỉnh nào.',

  // Statistics page
  'statistics.breakdown': 'Chi tiết',
  'statistics.today': 'Hôm nay',
  'statistics.thisWeek': 'Tuần này',
  'statistics.allTime': 'Toàn bộ',
  'statistics.watched': 'Đã xem',
  'statistics.saved': 'Tiết kiệm',
  'statistics.sessions': 'Số phiên',

  // Settings page
  'settings.enable': 'Bật tiện ích',
  'settings.enableSub': 'Áp dụng tốc độ đã lưu trên các trang được hỗ trợ',
  'settings.overlay': 'Huy hiệu tốc độ',
  'settings.overlaySub': 'Hiện tốc độ hiện tại trên mỗi video',
  'settings.language': 'Ngôn ngữ',
  'settings.languageSub': 'Ngôn ngữ hiển thị của popup',
  'settings.profiles': 'Hồ sơ tốc độ',
  'settings.addProfile': 'Thêm',
  'settings.profileHint':
    'Gán hồ sơ cho một trang web từ Bảng điều khiển để dùng lại tốc độ của nó.',
  'settings.dangerZone': 'Vùng nguy hiểm',
  'settings.resetStats': 'Đặt lại thống kê',
  'settings.resetting': 'Đang đặt lại…',

  // Data page
  'data.title': 'Sao lưu & khôi phục',
  'data.hint':
    'Xuất cài đặt, hồ sơ và thống kê ra tệp JSON, hoặc nhập bản sao lưu trước đó. Thay thế sẽ ghi đè toàn bộ; Trộn sẽ giữ giá trị lớn hơn của từng thống kê.',
  'data.replace': 'Thay thế',
  'data.merge': 'Trộn',
  'data.export': 'Xuất',
  'data.reset': 'Đặt lại',
  'data.importing': 'Đang nhập…',
  'data.exporting': 'Đang xuất…',
  'data.resetting': 'Đang đặt lại…',

  // Status messages
  'status.saveFailed': 'Lưu thất bại: {error}',
  'status.invalidDomain': 'Nhập tên miền hợp lệ, ví dụ example.com.',
  'status.alreadySupported': 'Trang web này đã được hỗ trợ tự động.',
  'status.alreadyAdded': 'Tên miền này đã có trong danh sách tùy chỉnh.',
  'status.domainAdded': 'Đã thêm {domain}.',
  'status.domainRemoved': 'Đã xóa {domain}.',
  'status.exportFailed': 'Xuất thất bại: {error}',
  'status.exportDone': 'Xuất hoàn tất.',
  'status.importFailed': 'Nhập thất bại: {error}',
  'status.importDone':
    'Đã nhập ({mode}) — {sessions} phiên, đã xem {watched}, tiết kiệm {saved}.',
  'status.statsReset': 'Đã đặt lại thống kê.',
  'status.resetFailed': 'Đặt lại thất bại: {error}',

  // Duration units
  'duration.hours': '{value}g',
  'duration.minutes': '{value}p',
  'duration.seconds': '{value}s',
};

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, vi };

// ─── Reactive language store ─────────────────────────────────────────────────
// App sets the language once settings load; useI18n() subscribes to it so
// every component re-renders on change without prop drilling.

let currentLanguage: Language = 'en';
const listeners = new Set<() => void>();

export function setLanguage(language: Language): void {
  if (currentLanguage === language) return;
  currentLanguage = language;
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Language {
  return currentLanguage;
}

/** Looks up a string and substitutes `{name}` placeholders. */
function translate(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  let text = dictionaries[language][key];
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export interface I18n {
  readonly language: Language;
  t(key: TranslationKey, params?: Record<string, string | number>): string;
}

export function useI18n(): I18n {
  const language = useSyncExternalStore(subscribe, getSnapshot);
  // Stable identity per language so components can use `t` in effect deps.
  return useMemo(
    () => ({
      language,
      t(key: TranslationKey, params?: Record<string, string | number>) {
        return translate(language, key, params);
      },
    }),
    [language],
  );
}

// ─── Duration formatting ─────────────────────────────────────────────────────

/**
 * Formats a duration in seconds for compact display, using the active
 * language's unit labels. E.g. 95 → "1m 35s" (en) / "1p 35s" (vi).
 */
export function formatDuration(seconds: number): string {
  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(currentLanguage, key, params);
  if (!Number.isFinite(seconds) || seconds <= 0) return t('duration.seconds', { value: 0 });
  const total = Math.round(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  if (h > 0) {
    return m > 0
      ? `${t('duration.hours', { value: h })} ${t('duration.minutes', { value: m })}`
      : t('duration.hours', { value: h });
  }
  if (m > 0) {
    return s > 0
      ? `${t('duration.minutes', { value: m })} ${t('duration.seconds', { value: s })}`
      : t('duration.minutes', { value: m });
  }
  return t('duration.seconds', { value: s });
}
