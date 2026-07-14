import { Platform } from 'react-native';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return lines.join('\n');
}

// Web downloads the CSV directly via a browser download; native has no filesystem
// download prompt, so it writes to a temp file and opens the OS share sheet instead
// (save to Files / send via WhatsApp / etc.) -- same online-only-vs-native split
// pattern as OFFLINE_SUPPORTED elsewhere in this app.
export async function exportCsv(filename: string, csv: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: filename });
  }
}
