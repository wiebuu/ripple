import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { GENERATED_IMAGES, pickAndUpload, unsplash } from '@/lib/media';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { Sheet } from '../Sheet';
import { Button, Icon, IconButton, T } from '../ui';
import { RippleLoader } from '@/components/brand/RippleMark';

/**
 * Image field: upload from the library (validated on device and server) or
 * pick a generated image. The generator is a labelled demo stand-in.
 */
export function ImageSlot({ uri, onChange, category, aspect = 16 / 9, label = 'Add image' }: { uri?: string; onChange: (uri: string | undefined) => void; category?: string; aspect?: number; label?: string }) {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState(false);

  const upload = async () => {
    setBusy(true);
    const r = await pickAndUpload('image', { aspect: aspect > 1.5 ? [16, 9] : [4, 3] });
    setBusy(false);
    if (!r) return;
    if ('error' in r) return toast(r.error, 'error');
    onChange(r.url);
    toast('Image added');
  };

  const options = GENERATED_IMAGES[category || 'Other'] ?? GENERATED_IMAGES.Other;

  return (
    <View style={{ gap: space.sm }}>
      {uri ? (
        <View>
          <Image source={uri} style={{ width: '100%', aspectRatio: aspect, borderRadius: radius.md, backgroundColor: c.skeleton }} contentFit="cover" accessibilityLabel="Selected image" />
          <View style={{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6 }}>
            <IconButton icon="swap-horizontal" label="Replace image" tone="onImage" size={18} onPress={upload} />
            <IconButton icon="trash-outline" label="Remove image" tone="onImage" size={18} onPress={() => onChange(undefined)} />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={upload}
          style={({ pressed }) => ({ aspectRatio: aspect, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
          {busy ? <RippleLoader /> : <Icon name="image-outline" size={28} color={c.textMuted} />}
          <T variant="smallStrong">{busy ? 'Uploading…' : label}</T>
          <T variant="small" color="textSubtle">
            JPG, PNG or WebP · under 8 MB · at least 600px wide
          </T>
        </Pressable>
      )}
      <Button label="Generate an image" icon="sparkles-outline" variant="quiet" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => setGen(true)} />
      <Sheet visible={gen} onClose={() => setGen(false)} title="Generate an image">
        <T variant="small" color="textMuted">
          Demo mode: this prototype offers licence-free photos matched to your category instead of calling an image-generation service.
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {options.map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel="Use this image"
              onPress={() => {
                onChange(unsplash(id));
                setGen(false);
                toast('Image added');
              }}>
              <Image source={unsplash(id, 400)} style={{ width: 200, aspectRatio: aspect, borderRadius: radius.md, backgroundColor: c.skeleton }} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}
