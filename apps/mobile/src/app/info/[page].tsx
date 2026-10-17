import { router, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';
import { REACH_CONFIG, feeBreakdown, peoplePerHundred } from '@shared';
import { Accordion } from '@/components/Accordion';
import { Body, Header } from '@/components/Screen';
import { Button, Card, ListRow, T } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { space } from '@/theme';

type Section = { heading?: string; body: string[] };
type Page = { title: string; intro?: string; sections?: Section[]; faq?: { q: string; a: string }[] };

const fee = Math.round(REACH_CONFIG.platformFeeRate * 100);
const f10 = feeBreakdown(500);

const PAGES: Record<string, Page> = {
  about: {
    title: 'About',
    intro: 'Ripple is a community-funded media platform. Like a drop in still water, one message can spread in widening rings: we help important messages ripple out beyond the networks of the people who create them.',
    sections: [
      { heading: 'Why we exist', body: ['Good information often stays inside the circle that already agrees with it. Advertising can reach new people, but it is expensive for individuals and small groups.', 'We let many people chip in small amounts so a reviewed, sourced message can be shown to audiences who would not otherwise see it.'] },
      { heading: 'What we are not', body: ['We are not a donation platform. Contributions pay for distributing a message, not for the cause, person or organisation it describes. Funds are never transferred to creators.'] },
    ],
  },
  'how-it-works': {
    title: 'How it works',
    intro: 'Create. Review. Amplify. Three steps between a message and a new audience.',
    sections: [
      { heading: '1. Create', body: ['A creator writes the message, adds sources for any claims, prepares the ad visuals and chooses who it should reach. They set a funding goal for distribution.'] },
      { heading: '2. Review', body: ['Our team checks claims against the listed sources, checks images and ads against advertising policies, and confirms targeting is appropriate. We can approve, ask for changes, or decline.', 'Only approved campaigns are published and open for backing.'] },
      { heading: '3. Amplify', body: [`Backers contribute toward the goal. ${fee}% covers review, ad setup and reporting; the rest is spent on advertising. When funding closes, we prepare the ads with distribution partners and launch them.`, 'Reaching the goal does not launch ads by itself. Ads start only when approval, payment, budget and ad setup are all complete.'] },
      { heading: 'After the campaign', body: ['Creators and backers receive a report showing funds raised, ad spend, impressions, measured reach and clicks, kept separate from the original estimate.'] },
      { heading: 'About reach estimates', body: [`Before a campaign runs we can only estimate reach. Our demo model assumes about ${peoplePerHundred()} people per ₹100 contributed. It is not a guarantee: actual reach depends on ad inventory, prices, targeting, delivery and performance.`] },
    ],
  },
  partners: {
    title: 'Partners',
    intro: 'Ads are bought through standard advertising networks. This prototype uses simulated partners.',
    sections: [
      { heading: 'Distribution channels', body: ['Social feeds, stories and reels, search, news and publisher sites, and online video. Creators choose a budget split; the review team finalises it.'] },
      { heading: 'What partners see', body: ['Partners receive the approved ad creative, targeting and budget. They never receive backer names, emails or payment details.'] },
      { heading: 'Work with us', body: ['Publishers and nonprofits interested in partnering can reach us through the Contact page.'] },
    ],
  },
  faq: {
    title: 'FAQs',
    faq: [
      { q: 'Is my contribution a donation?', a: 'No. It pays to show the campaign’s message to more people. It does not go to the cause or the creator. If you want to support the cause directly, donate to it directly.' },
      { q: 'Where does my money go?', a: `For every ₹500: ${formatMoney(f10.adBudget, true)} buys advertising and ${formatMoney(f10.platformFee, true)} covers review, ad setup and reporting. Card processing (${formatMoney(f10.processingFee, true)}) is added at checkout.` },
      { q: 'Do I need an account?', a: 'No. You can browse and back campaigns as a guest. You get a receipt either way.' },
      { q: 'Will my name be public?', a: 'Not unless you choose to. Backer names are private by default, and amounts are never shown publicly.' },
      { q: 'What if the goal isn’t reached?', a: 'The team either runs a smaller campaign with what was raised or refunds backers. You’ll be notified either way.' },
      { q: 'What happens to unspent money?', a: 'Unspent advertising budget at the end of a campaign is refunded proportionally to backers.' },
      { q: 'How accurate is the reach estimate?', a: 'It’s an estimate based on typical ad prices. The final report shows what was actually delivered, separately.' },
      { q: 'Who reviews campaigns?', a: 'Our internal review team. Review checks sources and policies; it is not independent fact-checking and we don’t publish trust scores.' },
    ],
  },
  help: {
    title: 'Help',
    intro: 'Most answers are in the FAQs. For anything else, contact us.',
  },
  contact: {
    title: 'Contact',
    intro: 'We usually reply within one business day.',
    sections: [{ heading: 'Email', body: ['support@ripple.example'] }, { heading: 'Report a campaign', body: ['Use “Report” on any campaign page, or email reports@ripple.example with the campaign link.'] }],
  },
  terms: {
    title: 'Terms & funding policy',
    intro: 'A plain-language summary. This prototype does not process real payments.',
    sections: [
      { heading: 'Contributions', body: ['Contributions fund the distribution of a campaign’s message. They are not donations and are not tax-deductible.', `The platform keeps ${fee}% for review, ad setup and reporting. Card processing fees are shown before you pay.`] },
      { heading: 'Custody of funds', body: ['Funds are held by the platform and spent only on approved advertising. They are never transferred to creators.'] },
      { heading: 'Refunds', body: ['Full refund if a campaign is cancelled or not approved for distribution.', 'If the funding period ends below goal, the team either distributes a smaller campaign or refunds backers.', 'Unspent ad budget at the end of a campaign is refunded proportionally.'] },
      { heading: 'Creators', body: ['Creators confirm they have rights to all content and that claims are supported by the listed sources. Material edits to a live campaign go back to review before ads change.'] },
    ],
  },
  privacy: {
    title: 'Privacy',
    sections: [
      { heading: 'Backers', body: ['Your name is private by default. We show it only if you opt in, and we never show amounts publicly.', 'Payment details are handled by the payment provider. We store only the last four digits for your receipt.'] },
      { heading: 'Advertising', body: ['Ad partners never receive backer data. We do not target ads using sensitive categories such as health, religion or political views.'] },
      { heading: 'Your data', body: ['You can ask us to export or delete your account data at any time from Settings.'] },
    ],
  },
  guidelines: {
    title: 'Community guidelines',
    sections: [
      { heading: 'Campaigns must', body: ['Be truthful, with sources for factual claims.', 'Use images and video you have rights to.', 'Target adults (18+) and avoid sensitive targeting.'] },
      { heading: 'Campaigns must not', body: ['Promote hate, harassment or violence.', 'Make misleading health, financial or electoral claims.', 'Attack private individuals.', 'Endorse or oppose candidates (issue campaigns are allowed).'] },
      { heading: 'Enforcement', body: ['Reviewers can request changes, decline campaigns, or pause distribution. Every decision is recorded.'] },
    ],
  },
};

export default function InfoPage() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const p = PAGES[page ?? ''];
  if (!p)
    return (
      <View style={{ flex: 1 }}>
        <Header title="Not found" />
        <Body>
          <T>This page doesn’t exist.</T>
        </Body>
      </View>
    );
  return (
    <View style={{ flex: 1 }}>
      <Header title={p.title} />
      <Body>
        {!!p.intro && (
          <T variant="reading" style={{ fontSize: 19 }}>
            {p.intro}
          </T>
        )}
        {p.sections?.map((s, i) => (
          <View key={i} style={{ gap: space.sm }}>
            {s.heading && <T variant="heading">{s.heading}</T>}
            {s.body.map((b, j) => (
              <T key={j} color="textMuted" style={{ fontSize: 16, lineHeight: 24 }}>
                {b}
              </T>
            ))}
          </View>
        ))}
        {!!p.faq && (
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            {p.faq.map((x, i) => (
              <Accordion key={x.q} title={x.q} last={i === p.faq!.length - 1}>
                <T color="textMuted">{x.a}</T>
              </Accordion>
            ))}
          </Card>
        )}
        {page === 'help' && (
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            <ListRow icon="help-circle-outline" title="FAQs" onPress={() => router.push('/info/faq')} />
            <ListRow icon="book-outline" title="How it works" onPress={() => router.push('/info/how-it-works')} />
            <ListRow icon="shield-outline" title="Community guidelines" onPress={() => router.push('/info/guidelines')} />
            <ListRow icon="mail-outline" title="Contact us" onPress={() => router.push('/info/contact')} />
          </Card>
        )}
        {page === 'contact' && <Button label="Email support" icon="mail-outline" onPress={() => Linking.openURL('mailto:support@ripple.example')} />}
      </Body>
    </View>
  );
}
