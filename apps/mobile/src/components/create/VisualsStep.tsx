import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SAMPLE_VIDEOS, AD_DESCRIPTION_MAX, AD_HEADLINE_MAX, CTA_MAX, type DraftContent } from '@shared';
import { pickAndUpload } from '@/lib/media';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { Field } from '../Field';
import { Banner, Button, Chip, Icon, IconButton, Pill, T, haptic } from '../ui';
import { ImageSlot } from './ImageSlot';
import { FieldError, Label, StepIntro, type StepProps } from './shared';
import { CampaignVideo } from '../CampaignVideo';
import { AdMock, adFromDraft, PLACEMENTS, type Placement } from '../AdPreview';

const CTAS = ['Learn more', 'Read the story', 'Have your say', 'See the facts', 'Sign up'];

export function VisualsStep({ d, update, errors }: StepProps) {
  const { c } = useTheme();
  const v = d.visuals;
  const set = (p: Partial<typeof v>) => update((x) => ({ ...x, visuals: { ...x.visuals, ...p } }));
  const [placement, setPlacement] = useState<Placement>('Feed');
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
            <View style={{ width: 120 }}>
              <ImageSlot compact aspect={1} category={d.basics.category} label="Add image" onChange={(u) => u && set({ adImages: [...v.adImages, u] })} />
            </View>
          )}
        </ScrollView>
        {!!cover && v.adImages.length === 0 && <Button label="Use the cover image" icon="copy-outline" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => set({ adImages: [cover] })} />}
        <FieldError error={errors['visuals.adImages']} />
      </View>

      <View style={{ gap: space.sm }}>
        <Label text="Video" hint="Optional. MP4 under 50 MB, used for video and stories placements." />
        {v.adVideo ? (
          // The chosen video plays inline, with a remove control on top.
          <View>
            <CampaignVideo uri={v.adVideo} />
            <IconButton icon="trash-outline" label="Remove video" tone="onImage" size={18} style={{ position: 'absolute', top: 8, right: 8 }} onPress={() => set({ adVideo: undefined })} />
          </View>
        ) : (
          <>
            <Button label="Upload your own" icon="videocam-outline" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} loading={uploadingVideo} onPress={addVideo} />
            <T variant="small" color="textMuted">
              Or start with a free stock video
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {SAMPLE_VIDEOS.map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Use video: ${s.title}`}
                  onPress={() => {
                    haptic.light();
                    set({ adVideo: s.url });
                    toast('Video added');
                  }}
                  style={({ pressed }) => ({ width: 128, gap: 4, opacity: pressed ? 0.7 : 1 })}>
                  <View>
                    <Image source={s.thumb} style={{ width: 128, height: 72, borderRadius: radius.sm + 2, backgroundColor: c.skeleton }} contentFit="cover" />
                    <View style={{ position: 'absolute', top: 24, left: 52, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="play-forward-outline" size={12} color="#fff" />
                    </View>
                  </View>
                  <T variant="small" numberOfLines={1} style={{ fontSize: 12 }}>
                    {s.title}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
          </>
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

/** The draft's ad in one placement (shared mock, also used on the public campaign page). */
export function AdPreview({ d, placement }: { d: DraftContent; placement: Placement }) {
  return <AdMock ad={adFromDraft(d)} placement={placement} />;
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
        <Button label="Check my ad" icon="checkmark-done-outline" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => { haptic.light(); setShow(true); }} />
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
