import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { api } from './api';

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

export type PickResult = { url: string; kind: 'image' | 'video'; width?: number; height?: number } | { error: string } | null;

/** Pick from the library, validate on device, upload. Server validates again. */
export async function pickAndUpload(kind: 'image' | 'video' = 'image', opts: { aspect?: [number, number] } = {}): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { error: 'Allow photo access in Settings to add images.' };
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [kind === 'image' ? 'images' : 'videos'],
    quality: 0.8,
    allowsEditing: kind === 'image' && !!opts.aspect,
    aspect: opts.aspect,
    // iPhone videos are often hundreds of MB; export a compressed H.264 copy so it fits the 50 MB limit.
    // (Deprecated upstream but still the only way to compress library picks; Android returns the original.)
    ...(kind === 'video' && { videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }),
  });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const mime = a.mimeType ?? (kind === 'image' ? 'image/jpeg' : 'video/mp4');
  if (kind === 'image' && !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return { error: 'Use a JPG, PNG or WebP image.' };
  // The picker often leaves out the size (especially for videos); read it from the file so a too-big upload never starts.
  const size = a.fileSize ?? fileSize(a.uri);
  if (size && size > (kind === 'image' ? MAX_IMAGE : MAX_VIDEO))
    return { error: kind === 'image' ? 'Images must be under 8 MB.' : 'Videos must be under 50 MB.' };
  if (kind === 'image' && a.width && a.width < 600) return { error: 'This image is too small. Use one at least 600 pixels wide.' };

  const form = new FormData();
  const name = a.fileName ?? `upload.${mime.split('/')[1]}`;
  if (Platform.OS === 'web') form.append('file', await (await fetch(a.uri)).blob(), name);
  else form.append('file', { uri: a.uri, name, type: mime } as any);
  try {
    const up = await api<{ url: string; kind: 'image' | 'video' }>('/uploads', { form });
    return { ...up, width: a.width, height: a.height };
  } catch (e: any) {
    // A dropped connection mid-upload is almost always a file that's too large or a weak network, not the server being down.
    if (e?.status === 0) return { error: kind === 'video' ? 'The video didn’t finish uploading. Try a shorter clip (under 50 MB) or a stronger connection.' : 'The image didn’t finish uploading. Check your connection and try again.' };
    return { error: e.message ?? 'Upload failed. Try again.' };
  }
}

function fileSize(uri: string) {
  if (Platform.OS === 'web') return undefined;
  try {
    return new File(uri).size ?? undefined;
  } catch {
    return undefined;
  }
}

/** Demo stand-in for an image-generation tool: curated, licence-free photos by category. */
export const GENERATED_IMAGES: Record<string, string[]> = {
  Environment: ['1441974231531-c6227db76b6e', '1509391366360-2e959784a276', '1519331379826-f10be5486c6f'],
  Health: ['1576091160399-112ba8d25d1d', '1488459716781-31db52582fe9', '1469571486292-0ba58a3f068b'],
  Science: ['1532094349884-543bc11b234d', '1449824913935-59a10b8d2000'],
  Education: ['1503676260728-1c00da094a0b', '1580582932707-520aed937b7b', '1507842217343-583bb7270b66'],
  'Public Policy': ['1494172961521-33799ddd43a5', '1544620347-c4fd4a3d5957'],
  'Economic Policy': ['1530267981375-f0de937f5f13', '1453614512568-c4024d13c247'],
  Community: ['1559027615-cd4628902d4a', '1469571486292-0ba58a3f068b', '1416879595882-3373a0480b5b'],
  'Arts & Culture': ['1503095396549-807759245b35', '1541701494587-cb58502866ab'],
  Business: ['1453614512568-c4024d13c247', '1449824913935-59a10b8d2000'],
  Other: ['1500382017468-9049fed747ef', '1505852679233-d9fd70aff56d'],
};
export const unsplash = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
