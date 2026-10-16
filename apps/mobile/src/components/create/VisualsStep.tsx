import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AD_DESCRIPTION_MAX, AD_HEADLINE_MAX, CTA_MAX, type DraftContent } from '@shared';
import { pickAndUpload } from '@/lib/media';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { Field } from '../Field';
import { Banner, Button, Chip, Icon, IconButton, Pill, T, haptic } from '../ui';
import { ImageSlot } from './ImageSlot';
import { FieldError, Label, StepIntro, type StepProps } from './shared';

const CTAS = ['Learn more', 'Read the story', 'Have your say', 'See the facts', 'Sign up'];
const PLACEMENTS = ['Feed', 'Story', 'Search'] as const;

export function VisualsStep({ d, update, errors }: StepProps) {
  const { c } = useTheme();
  const v = d.visuals;
  const set = (p: Partial<typeof v>) => update((x) => ({ ...x, visuals: { ...x.visuals, ...p } }));
  const [placement, setPlacement] = useState<(typeof PLACEMENTS)[number]>('Feed');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const cover = v.coverImage || d.basics.coverImage;

  const addVideo = async () => {
    setUploadingVideo(true);
    const r = await pickAndUpload('video');
    setUploadingVideo(false);
    if (!r) return;
    if ('error' in r) return toast(r.error, 'error');
    set({ adVideo: r.url });
    toast('Video added');
  };

  return (
    <View style={{ gap: space.xl }}>
      <StepIntro title="Campaign & ad visuals" body="Your story page and your ads are separate. Here you choose the images and words people see before they tap." />

      <View style={{ gap: space.sm }}>
        <Label text="Campaign cover" required hint="Top of your campaign page and on every card." />
        <ImageSlot uri={cover} category={d.basics.category} onChange={(u) => update((x) => ({ ...x, visuals: { ...x.visuals, coverImage: u }, basics: { ...x.basics, coverImage: u } }))} label="Add a cover image" />
        <FieldError error={errors['visuals.coverImage']} />
      </View>

      <View style={{ gap: space.sm }}>
        <Label text="Ad images" required hint="1–6 images. Square or 4:5 works best in feeds." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {v.adImages.map((u, i) => (
            <View key={u + i}>
              <Image source={u} style={{ width: 120, height: 120, borderRadius: radius.md, backgroundColor: c.skeleton }} contentFit="cover" />
              <IconButton icon="close" label={`Remove ad image ${i + 1}`} tone="onImage" size={16} style={{ position: 'absolute', top: 4, right: 4, width: 32, height: 32 }} onPress={() => set({ adImages: v.adImages.filter((_, j) => j !== i) })} />
            </View>
          ))}
          {v.adImages.length < 6 && (
            <View style={{ width: 160 }}>
              <ImageSlot aspect={1} category={d.basics.category} label="Add ad image" onChange={(u) => u && set({ adImages: [...v.adImages, u] })} />
            </View>
          )}
        </ScrollView>
        {!!cover && v.adImages.length === 0 && <Button label="Use the cover image" icon="copy-outline" variant="quiet" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => set({ adImages: [cover] })} />}
        <FieldError error={errors['visuals.adImages']} />
      </View>

      <View style={{ gap: space.sm }}>
        <Label text="Video" hint="Optional. MP4 under 50 MB, used for video and stories placements." />
        {v.adVideo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <Icon name="videocam-outline" size={20} color={c.primary} />
            <T style={{ flex: 1 }} numberOfLines={1}>
              Video added
            </T>
            <IconButton icon="trash-outline" label="Remove video" size={18} onPress={() => set({ adVideo: undefined })} />
          </View>
        ) : (
          <Button label="Upload a video" icon="videocam-outline" variant="secondary" loading={uploadingVideo} onPress={addVideo} />
        )}
      </View>

      <Field label="Ad headline" value={v.adHeadline} onChangeText={(t) => set({ adHeadline: t })} max={AD_HEADLINE_MAX} softMax placeholder={d.basics.title.slice(0, AD_HEADLINE_MAX) || 'Short and specific'} helper="If empty, the start of your title is used." error={errors['visuals.adHeadline']} />
      <Field label="Ad description" value={v.adDescription} onChangeText={(t) => set({ adDescription: t })} max={AD_DESCRIPTION_MAX} softMax multiline placeholder={d.basics.summary || 'One line on why it matters'} error={errors['visuals.adDescription']} />
      <View style={{ gap: space.sm }}>
        <Field label="Button text" required value={v.ctaText} onChangeText={(t) => set({ ctaText: t })} max={CTA_MAX} softMax error={errors['visuals.ctaText']} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {CTAS.map((x) => (
            <Chip key={x} label={x} selected={v.ctaText === x} onPress={() => set({ ctaText: x })} />
          ))}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <Label text="Ad preview" hint="How your ad may look in each placement. Final layout depends on the platform." />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {PLACEMENTS.map((p) => (
            <Chip key={p} label={p} selected={placement === p} onPress={() => setPlacement(p)} />
          ))}
        </View>
        <AdPreview d={d} placement={placement} />
      </View>

      <QualityCheck d={d} />
    </View>
  );
}

export function AdPreview({ d, placement }: { d: DraftContent; placement: 'Feed' | 'Story' | 'Search' }) {
  const { c } = useTheme();
  const v = d.visuals;
  const img = v.adImages[0] || v.coverImage || d.basics.coverImage;
  const headline = v.adHeadline || d.basics.title.slice(0, 40) || 'Your ad headline';
  const desc = v.adDescription || d.basics.summary || 'Your ad description appears here.';
  const by = d.basics.creatorName || 'Your name';

  if (placement === 'Search')
    return (
      <View style={{ padding: space.lg, borderRadius: radius.md, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E3E3', gap: 4 }}>
        <T variant="small" style={{ color: '#202124' }}>
          <T variant="smallStrong" style={{ color: '#202124' }}>Sponsored</T> · ripple.example
        </T>
        <T style={{ color: '#1A0DAB', fontSize: 18 }} numberOfLines={1}>
          {headline}
        </T>
        <T variant="small" style={{ color: '#4D5156' }} numberOfLines={2}>
          {desc}
        </T>
      </View>
    );

  if (placement === 'Story')
    return (
      <View style={{ alignSelf: 'center', width: 220, aspectRatio: 9 / 16, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#111' }}>
        {img ? <Image source={img} style={{ position: 'absolute', inset: 0 }} contentFit="cover" /> : null}
        <View style={{ flex: 1, justifyContent: 'space-between', padding: space.md, backgroundColor: 'rgba(0,0,0,0.25)' }}>
          <T variant="smallStrong" style={{ color: '#fff' }}>
            {by} · Sponsored
          </T>
          <View style={{ gap: space.sm }}>
            <T variant="subheading" style={{ color: '#fff' }}>
              {headline}
            </T>
            <View style={{ alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: '#fff' }}>
              <T variant="smallStrong" style={{ color: '#111' }}>
                {v.ctaText || 'Learn more'}
              </T>
            </View>
          </View>
        </View>
      </View>
    );

  return (
    <View style={{ borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.primarySoft }} />
        <View>
          <T variant="smallStrong">{by}</T>
          <T variant="small" color="textMuted">
            Sponsored
          </T>
        </View>
      </View>
      <T style={{ paddingHorizontal: space.md, paddingBottom: space.sm }} numberOfLines={2}>
        {desc}
      </T>
      {img ? <Image source={img} style={{ width: '100%', aspectRatio: 1 }} contentFit="cover" /> : <View style={{ width: '100%', aspectRatio: 1, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><T color="textSubtle">No image yet</T></View>}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.md, backgroundColor: c.surfaceAlt }}>
        <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
          {headline}
        </T>
        <View style={{ paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: c.border }}>
          <T variant="smallStrong">{v.ctaText || 'Learn more'}</T>
        </View>
      </View>
    </View>
  );
}

/** Optional creative-quality prompt: simple, explainable checks. */
function QualityCheck({ d }: { d: DraftContent }) {
  const { c } = useTheme();
  const [show, setShow] = useState(false);
  const v = d.visuals;
  const headline = v.adHeadline || d.basics.title;
  const checks = [
    { ok: v.adImages.length >= 2, text: 'Two or more ad images let partners test which works best.' },
    { ok: headline.length > 0 && headline.length <= 40, text: 'Headline fits in 40 characters, so it won’t be cut off.' },
    { ok: /\d/.test(headline + v.adDescription), text: 'A specific number (a date, count or place) makes ads more concrete.' },
    { ok: !/!{1,}|FREE|URGENT/.test(headline + v.adDescription), text: 'No exclamation marks or all-caps urgency; ad policies may reject them.' },
    { ok: !!v.adDescription, text: 'A description explains why it matters before people tap.' },
  ];
  const missing = !v.adImages.length && !v.adVideo;
  return (
    <View style={{ gap: space.md }}>
      {missing && <Banner tone="warning" icon="warning-outline" body="No advertising image or video yet. Campaigns can’t be distributed without at least one." />}
      {!show ? (
        <Button label="Get feedback on my ad" icon="sparkles-outline" variant="secondary" onPress={() => { haptic.light(); setShow(true); }} />
      ) : (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <T variant="subheading">Creative check</T>
            <Pill label={`${checks.filter((x) => x.ok).length}/${checks.length}`} tone="primary" />
          </View>
          {checks.map((ch) => (
            <Pressable key={ch.text} accessibilityRole="text" style={{ flexDirection: 'row', gap: space.sm }}>
              <Icon name={ch.ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={ch.ok ? c.success : c.textSubtle} />
              <T variant="small" style={{ flex: 1 }}>
                {ch.text}
              </T>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
