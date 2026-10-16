/**
 * Demo data. Every seeded campaign is flagged isDemo so the app can label
 * figures as sample data. Run with `npm run seed` (wipes the database).
 */
import { emptyDraft, feeBreakdown, estimateReach, channelFactor, type DraftContent, type StoryBlock, type CampaignStatus } from '../../../shared';
import { db } from './lib/db';
import { simulateDelivery } from './lib/lifecycle';

const img = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
const IMG = {
  water: '1548839140-29a749e1cf4d', bus: '1544620347-c4fd4a3d5957', tractor: '1530267981375-f0de937f5f13',
  snow: '1517299321609-52687d1bc55a', forest: '1441974231531-c6227db76b6e', books: '1503676260728-1c00da094a0b',
  library: '1507842217343-583bb7270b66', produce: '1488459716781-31db52582fe9', doctor: '1576091160399-112ba8d25d1d',
  lab: '1532094349884-543bc11b234d', solar: '1509391366360-2e959784a276', ballot: '1494172961521-33799ddd43a5',
  soil: '1416879595882-3373a0480b5b', theatre: '1503095396549-807759245b35', cafe: '1453614512568-c4024d13c247',
  beach: '1618477461853-cf6ed80faba5', park: '1519331379826-f10be5486c6f', volunteer: '1559027615-cd4628902d4a',
  solarAerial: '1497435334941-8c899ee9e8e9', veg: '1464226184884-fa280b87c399', bins: '1532996122724-e3c354a0b15b',
  field: '1500382017468-9049fed747ef', hands: '1469571486292-0ba58a3f068b', classroom: '1580582932707-520aed937b7b',
  street: '1449824913935-59a10b8d2000',
};

let n = 0;
const bid = () => `b${++n}`;
const h = (text: string): StoryBlock => ({ id: bid(), type: 'heading', text });
const p = (text: string): StoryBlock => ({ id: bid(), type: 'paragraph', text });
const pic = (key: keyof typeof IMG, caption: string, credit = 'Unsplash'): StoryBlock => ({ id: bid(), type: 'image', uri: img(IMG[key]), caption, credit });
const stat = (value: string, label: string, sourceId?: string): StoryBlock => ({ id: bid(), type: 'stat', value, label, sourceId });
const quote = (text: string, attribution: string): StoryBlock => ({ id: bid(), type: 'quote', text, attribution });

type Seed = {
  slug: string;
  owner: 'alex' | 'community';
  status: CampaignStatus;
  featured?: boolean;
  goal: number;
  raised: number;
  backers: number;
  publishedDaysAgo?: number;
  content: Omit<DraftContent, 'goal' | 'acceptedRules'>;
  note?: string;
};

const base = emptyDraft();
/** Sample amounts below are written in round numbers and scaled to rupees. */
const INR = 80;

const seeds: Seed[] = [
  {
    slug: 'clean-water-public-schools', owner: 'community', status: 'FUNDING', featured: true, goal: 8000, raised: 5240, backers: 212, publishedDaysAgo: 12,
    content: {
      basics: { title: 'Clean drinking water in every public school', category: 'Health', creatorName: 'Marisol Everett', creatorType: 'Individual', summary: 'A district-by-district push to replace lead service lines in the thirty oldest public schools in the county.' },
      story: {
        headline: 'Our oldest schools still drink through lead pipes',
        intro: 'Thirty public schools in this county were built before 1960. Most of them still take water through lead service lines, and the replacement plan has no date attached to it.',
        blocks: [
          h('What is happening'),
          p('Lead service lines were standard when these buildings went up. Testing catches some problems, but filters and flushing are a stopgap. The only lasting fix is replacing the line from the main to the building.'),
          stat('30', 'schools in the county built before 1960 and still on original service lines (district facilities list, 2025)', 's1'),
          pic('water', 'Fountains in older buildings are often the last to be tested and the first to be switched off.'),
          h('Why it matters'),
          p('There is no known safe level of lead exposure for children. Federal funding for line replacement exists, but districts have to apply, and they apply when parents ask.'),
          quote('We did not know the school was on the list until a parent asked at a board meeting.', 'PTA member, Lincoln Elementary'),
          h('What we are asking'),
          p('We want every parent in the district to know whether their child’s school is on the list and to ask the board to commit to a replacement date.'),
        ],
        sources: [
          { id: 's1', title: 'Basic information about lead in drinking water', url: 'https://www.epa.gov/ground-water-and-drinking-water/basic-information-about-lead-drinking-water', publisher: 'US EPA' },
          { id: 's2', title: 'Childhood lead poisoning prevention', url: 'https://www.cdc.gov/lead-prevention/', publisher: 'CDC' },
        ],
        actions: ['Check whether your child’s school is on the list', 'Attend the next school board meeting', 'Share this with another parent'],
      },
      visuals: { coverImage: img(IMG.water), adImages: [img(IMG.water, 800)], adHeadline: 'Is your school on the lead list?', adDescription: 'Thirty county schools still use lead service lines. See the list and ask for a replacement date.', ctaText: 'See the list' },
      reach: { locations: ['Franklin County, OH'], ageRange: [25, 55], interests: ['Parenting', 'Education', 'Public health'], channels: { social_feed: 60, news: 40 }, durationDays: 21 },
    },
  },
  {
    slug: 'redraw-the-bus-network', owner: 'community', status: 'FUNDING', featured: true, goal: 12000, raised: 9100, backers: 341, publishedDaysAgo: 18,
    content: {
      basics: { title: 'Redraw the bus network around where people actually work', category: 'Public Policy', creatorName: 'Devin Okonkwo', creatorType: 'Individual', summary: 'Most routes still converge downtown, but the jobs moved to the ring road a decade ago. This is the case for redrawing them.' },
      story: {
        headline: 'The buses go where the jobs used to be',
        intro: 'Our bus map was drawn in 1987. Since then, the warehouses, hospitals and retail parks moved out to the ring road. The routes did not follow.',
        blocks: [
          h('The commute nobody planned for'),
          p('A shift worker living in the north end and working at the logistics park takes two buses through downtown and spends over an hour each way. A direct crosstown route would take twenty minutes.'),
          stat('68 min', 'average one-way trip from the north end to the ring road employment zone (agency trip planner sample)', 's1'),
          pic('bus', 'Routes that converge downtown work for 9-to-5 office jobs, not for night shifts on the edge of town.'),
          h('What a redesign looks like'),
          p('Other cities have redrawn their networks around frequent crosstown lines without increasing operating budgets. The transit board reviews its network next spring and is taking public comment now.'),
        ],
        sources: [
          { id: 's1', title: 'Transit agency trip planner methodology', url: 'https://www.transit.dot.gov/research-innovation', publisher: 'Federal Transit Administration' },
          { id: 's2', title: 'Bus network redesign case studies', url: 'https://www.transit.dot.gov/', publisher: 'FTA' },
        ],
        actions: ['Submit a public comment before the March board meeting', 'Map your own commute and share it'],
      },
      visuals: { coverImage: img(IMG.bus), adImages: [img(IMG.bus, 800)], adHeadline: 'Your bus map is from 1987', adDescription: 'The jobs moved to the ring road. The routes didn’t. Tell the transit board before spring.', ctaText: 'Have your say' },
      reach: { locations: ['Columbus, OH'], ageRange: [18, 65], interests: ['Commuting', 'Local news'], channels: { social_feed: 50, stories: 30, search: 20 }, durationDays: 30 },
    },
  },
  {
    slug: 'farmers-right-to-repair', owner: 'community', status: 'FUNDING', goal: 15000, raised: 4300, backers: 129, publishedDaysAgo: 6,
    content: {
      basics: { title: 'Let farmers repair the equipment they own', category: 'Economic Policy', creatorName: 'Hannah Breit', creatorType: 'Individual', summary: 'Software locks mean a dealer technician has to authorise repairs farmers used to do themselves. A state bill would change that.' },
      story: {
        headline: 'A broken sensor can stop a harvest',
        intro: 'Modern tractors run on software. When a sensor fails, many can only be reset by an authorised dealer, even if the farmer has the part and the skill.',
        blocks: [
          h('Waiting in the middle of harvest'),
          p('Dealer service windows of several days are common in peak season. For a crop that has to come in this week, that wait is expensive.'),
          pic('tractor', 'Repairs that once took an afternoon in the barn now often need a dealer laptop.'),
          h('What the bill does'),
          p('The proposed bill requires manufacturers to make diagnostic tools, manuals and parts available to owners and independent shops on fair terms. It does not let anyone change emissions or safety software.'),
        ],
        sources: [{ id: 's1', title: 'Nixing the Fix: FTC report to Congress on repair restrictions', url: 'https://www.ftc.gov/reports/nixing-fix-ftc-report-congress-repair-restrictions', publisher: 'Federal Trade Commission' }],
        actions: ['Ask your state representative where they stand', 'Share your own repair story'],
      },
      visuals: { coverImage: img(IMG.tractor), adImages: [img(IMG.tractor, 800)], adHeadline: 'Fix what you own', adDescription: 'Farmers can’t repair their own tractors. A state bill would change that.', ctaText: 'Learn more' },
      reach: { locations: ['Iowa', 'Nebraska'], ageRange: [25, 70], interests: ['Agriculture', 'Rural life'], channels: { social_feed: 70, video: 30 }, durationDays: 30 },
    },
  },
  {
    slug: 'winter-shelter-hours', owner: 'community', status: 'FUNDING', featured: true, goal: 6000, raised: 5880, backers: 264, publishedDaysAgo: 24,
    content: {
      basics: { title: 'Keep the winter shelter open past 7am', category: 'Community', creatorName: 'Eastside Shelter Network', creatorType: 'Nonprofit', summary: 'The shelter closes at 7am year-round under a rule written in 1998. Extending hours during freeze warnings costs less than one night of emergency calls.' },
      story: {
        headline: 'The coldest hour of the night is the hour we close',
        intro: 'Our shelter closes its doors at 7am every day of the year. On freeze-warning mornings, that is the coldest part of the day, and the library does not open until 10.',
        blocks: [
          h('A rule from 1998'),
          p('The closing time was set in a 1998 operating agreement and has never been revisited. Staff and volunteers are already on site; keeping the hall open three more hours on freeze days is mostly a question of permission.'),
          stat('3 hrs', 'between the shelter closing and the public library opening on weekdays'),
          pic('snow', 'Freeze warnings were issued on 41 mornings last winter.'),
          h('What we are asking for'),
          p('We are asking the city council to amend the operating agreement so the shelter can stay open until 10am whenever a freeze warning is in effect.'),
          quote('People wait outside the library in the dark. We have a warm room twenty metres away.', 'Volunteer coordinator'),
        ],
        sources: [
          { id: 's1', title: 'Emergency shelter program guidance', url: 'https://www.hudexchange.info/programs/esg/', publisher: 'HUD Exchange' },
          { id: 's2', title: 'NWS freeze warning definitions', url: 'https://www.weather.gov/safety/cold', publisher: 'National Weather Service' },
        ],
        actions: ['Email your council member before the December vote', 'Volunteer for a morning shift'],
      },
      visuals: { coverImage: img(IMG.snow), adImages: [img(IMG.snow, 800)], adHeadline: 'Open until 10 on freeze days', adDescription: 'The shelter closes at 7am, the coldest hour. One rule change keeps the doors open.', ctaText: 'Ask the council' },
      reach: { locations: ['Spokane, WA'], ageRange: [18, 65], interests: ['Local news', 'Volunteering'], channels: { social_feed: 60, news: 40 }, durationDays: 14 },
    },
  },
  {
    slug: 'library-hours-working-parents', owner: 'community', status: 'FUNDING', goal: 5000, raised: 2150, backers: 97, publishedDaysAgo: 9,
    content: {
      basics: { title: 'Library hours that fit working parents', category: 'Education', creatorName: 'Friends of Northside Library', creatorType: 'Community group', summary: 'Northside closes at 5pm on weekdays, before most parents can get there. One evening a week would change that.' },
      story: {
        headline: 'Open when families can actually come',
        intro: 'The Northside branch serves the youngest neighbourhood in the city and closes at 5pm on weekdays. Story time is at 10am on Tuesdays.',
        blocks: [
          h('Who is missing out'),
          p('Families where both parents work day shifts cannot use the branch on weekdays at all. Saturday hours are crowded and short.'),
          pic('library', 'The branch has space and staff; the schedule was set when the neighbourhood looked very different.'),
          p('We are asking the library board to pilot one late evening each week for six months and publish the visitor numbers.'),
        ],
        sources: [{ id: 's1', title: 'Public library hours and access research', url: 'https://www.ala.org/research', publisher: 'American Library Association' }],
        actions: ['Sign up to speak at the library board meeting', 'Tell us which evening works best for you'],
      },
      visuals: { coverImage: img(IMG.library), adImages: [img(IMG.library, 800)], adHeadline: 'One late night at Northside', adDescription: 'Help us ask for one evening a week at the library, for working parents.', ctaText: 'Add your voice' },
      reach: { locations: ['Minneapolis, MN'], ageRange: [25, 50], interests: ['Parenting', 'Reading'], channels: { social_feed: 100 }, durationDays: 21 },
    },
  },
  {
    slug: 'air-quality-block-by-block', owner: 'community', status: 'FUNDING', goal: 9000, raised: 1620, backers: 58, publishedDaysAgo: 3,
    content: {
      basics: { title: 'Show where the air is worst, block by block', category: 'Science', creatorName: 'Open Air Sensors Project', creatorType: 'Nonprofit', summary: 'There is one official air monitor for the whole city. Low-cost sensors near schools would show the difference between streets.' },
      story: {
        headline: 'One monitor for 400,000 people',
        intro: 'The city’s only regulatory air monitor sits on the roof of a building by the river. It tells us nothing about the difference between a quiet street and the one next to the freight route.',
        blocks: [
          h('What low-cost sensors can and cannot do'),
          p('Low-cost sensors are less precise than regulatory monitors, but a calibrated network can show patterns: which blocks spike at rush hour, which schools sit downwind of idling trucks.'),
          stat('1', 'regulatory PM2.5 monitor inside city limits'),
          pic('street', 'Pollution can vary sharply between neighbouring streets.'),
          p('We publish every reading openly and explain the limits of the data alongside it.'),
        ],
        sources: [{ id: 's1', title: 'Air Sensor Toolbox', url: 'https://www.epa.gov/air-sensor-toolbox', publisher: 'US EPA' }],
        actions: ['Host a sensor at your school or business', 'Look up readings near you'],
      },
      visuals: { coverImage: img(IMG.street), adImages: [img(IMG.street, 800)], adHeadline: 'How clean is your street’s air?', adDescription: 'One monitor covers the whole city. Open sensors show the difference between blocks.', ctaText: 'See the map' },
      reach: { locations: ['Pittsburgh, PA'], ageRange: [18, 65], interests: ['Environment', 'Science', 'Parenting'], channels: { social_feed: 50, search: 50 }, durationDays: 30 },
    },
  },
  {
    slug: 'main-street-theatre', owner: 'community', status: 'FUNDING', goal: 4000, raised: 1200, backers: 61, publishedDaysAgo: 15,
    content: {
      basics: { title: 'Bring the community theatre back to Main Street', category: 'Arts & Culture', creatorName: 'Lantern Street Players', creatorType: 'Community group', summary: 'The old Rialto has sat empty for six years. The council is deciding its future this winter.' },
      story: {
        headline: 'An empty stage in the middle of town',
        intro: 'The Rialto hosted school plays, touring shows and the town’s only cinema for seventy years. It has been empty since 2019.',
        blocks: [
          p('The council will choose between selling the building and leasing it to a community arts trust. We think more people would want a say if they knew the decision was coming.'),
          pic('theatre', 'Community theatres bring people downtown on evenings when most shops are closed.'),
        ],
        sources: [{ id: 's1', title: 'Arts and economic prosperity research', url: 'https://www.arts.gov/impact/research', publisher: 'National Endowment for the Arts' }],
        actions: ['Comment on the council’s Rialto consultation'],
      },
      visuals: { coverImage: img(IMG.theatre), adImages: [img(IMG.theatre, 800)], adHeadline: 'What happens to the Rialto?', adDescription: 'The council decides this winter. Have your say on the town’s old theatre.', ctaText: 'Have your say' },
      reach: { locations: ['Asheville, NC'], ageRange: [18, 75], interests: ['Theatre', 'Local events'], channels: { social_feed: 70, stories: 30 }, durationDays: 21 },
    },
  },
  {
    slug: 'small-business-permits', owner: 'community', status: 'FUNDING', goal: 7500, raised: 6100, backers: 188, publishedDaysAgo: 20,
    content: {
      basics: { title: 'Make small-business permits take days, not months', category: 'Business', creatorName: 'Main Street Merchants Alliance', creatorType: 'Business', summary: 'Opening a café here takes eleven separate approvals. A single online permit desk would cut that to one.' },
      story: {
        headline: 'Eleven forms to open a café',
        intro: 'A new food business in our city needs eleven separate approvals from five departments. Most owners pay rent for months before they can open.',
        blocks: [
          stat('11', 'separate approvals needed to open a café (Merchants Alliance survey of 42 owners)'),
          pic('cafe', 'Every month of waiting is a month of rent with no customers.'),
          p('A single permit desk with one application and one inspector visit is already used in several nearby cities. We are asking the council to fund a pilot.'),
        ],
        sources: [{ id: 's1', title: 'Starting a business: licenses and permits', url: 'https://www.sba.gov/business-guide/launch-your-business/apply-licenses-permits', publisher: 'US Small Business Administration' }],
        actions: ['Share how long your permits took', 'Support the pilot at the next council session'],
      },
      visuals: { coverImage: img(IMG.cafe), adImages: [img(IMG.cafe, 800)], adHeadline: 'Open in days, not months', adDescription: 'Eleven forms to open a café. One permit desk would fix that.', ctaText: 'Learn more' },
      reach: { locations: ['Sacramento, CA'], ageRange: [21, 65], interests: ['Small business', 'Entrepreneurship'], channels: { social_feed: 60, search: 40 }, durationDays: 30 },
    },
  },
  {
    slug: 'register-to-vote-five-minutes', owner: 'community', status: 'FUNDING', goal: 9000, raised: 3800, backers: 143, publishedDaysAgo: 8,
    content: {
      basics: { title: 'Register to vote in under five minutes', category: 'Public Policy', creatorName: 'Civic Basics', creatorType: 'Nonprofit', summary: 'A nonpartisan reminder for first-time voters, with the official registration link and deadlines for each state.' },
      story: {
        headline: 'The deadline comes before the election',
        intro: 'In many states the registration deadline is weeks before election day. First-time voters often find out too late.',
        blocks: [
          pic('ballot', 'This campaign links only to official government registration pages.'),
          p('This is a nonpartisan campaign. It does not mention candidates or parties and links only to the official government portal.'),
        ],
        sources: [{ id: 's1', title: 'Register to vote', url: 'https://vote.gov/', publisher: 'vote.gov' }],
        actions: ['Check your registration status', 'Remind one first-time voter'],
      },
      visuals: { coverImage: img(IMG.ballot), adImages: [img(IMG.ballot, 800)], adHeadline: 'Registered yet? Takes 5 min', adDescription: 'Check your state’s deadline and register on the official site.', ctaText: 'Check now' },
      reach: { locations: ['United States'], ageRange: [18, 24], interests: ['Students', 'Civic engagement'], channels: { social_feed: 40, stories: 40, search: 20 }, durationDays: 30 },
    },
  },
  {
    slug: 'renters-community-solar', owner: 'community', status: 'DISTRIBUTION_PREP', goal: 6000, raised: 6000, backers: 230, publishedDaysAgo: 33,
    content: {
      basics: { title: 'Let renters join community solar', category: 'Environment', creatorName: 'Sunshare Tenants Union', creatorType: 'Community group', summary: 'Community solar lets people without a roof buy into a shared array. Most renters have never heard of it.' },
      story: {
        headline: 'You don’t need a roof to go solar',
        intro: 'Community solar subscriptions let renters get credit on their electricity bill from a shared solar farm. Enrollment in our state is open, but few tenants know.',
        blocks: [pic('solarAerial', 'Shared arrays are built on land or warehouse roofs and split among subscribers.'), p('This campaign explains how subscriptions work and links to the state’s list of approved providers.')],
        sources: [{ id: 's1', title: 'Community solar basics', url: 'https://www.energy.gov/communitysolar/community-solar-basics', publisher: 'US Department of Energy' }],
        actions: ['Check if your utility has a community solar program'],
      },
      visuals: { coverImage: img(IMG.solarAerial), adImages: [img(IMG.solarAerial, 800)], adHeadline: 'Solar for renters is real', adDescription: 'No roof needed. See how community solar works in your state.', ctaText: 'How it works' },
      reach: { locations: ['Colorado'], ageRange: [21, 45], interests: ['Renting', 'Energy savings'], channels: { social_feed: 70, search: 30 }, durationDays: 30 },
    },
  },
  // ---- Alex Rivera's campaigns (demo creator) ----
  {
    slug: 'free-mental-health-line', owner: 'alex', status: 'FUNDING', goal: 5000, raised: 3780, backers: 151, publishedDaysAgo: 10,
    content: {
      basics: { title: 'The free crisis line most people don’t know exists', category: 'Health', creatorName: 'Alex Rivera', creatorType: 'Creator', summary: 'Anyone can call or text 988 for free, confidential support. Awareness is still low among the people who need it most.' },
      story: {
        headline: 'Three digits worth remembering',
        intro: 'Since 2022, anyone in the US can call or text 988 to reach the Suicide & Crisis Lifeline. Many people still do not know it exists.',
        blocks: [
          pic('doctor', 'Calls and texts are free and confidential.'),
          h('Why awareness matters'),
          p('A short number only helps if people remember it in a hard moment. This campaign puts it in front of young adults in the places they already scroll.'),
        ],
        sources: [{ id: 's1', title: '988 Suicide & Crisis Lifeline', url: 'https://988lifeline.org/', publisher: '988 Lifeline' }],
        actions: ['Save 988 in your phone', 'Share it with someone you care about'],
      },
      visuals: { coverImage: img(IMG.doctor), adImages: [img(IMG.doctor, 800)], adHeadline: 'Call or text 988', adDescription: 'Free, confidential support, any time. Save the number.', ctaText: 'Learn more' },
      reach: { locations: ['United States'], ageRange: [18, 34], interests: ['Wellbeing', 'Students'], channels: { social_feed: 40, stories: 40, video: 20 }, durationDays: 30 },
    },
  },
  {
    slug: 'shade-trees-hottest-blocks', owner: 'alex', status: 'PROMOTING', featured: true, goal: 10000, raised: 10000, backers: 402, publishedDaysAgo: 45,
    content: {
      basics: { title: 'Plant shade trees on the hottest blocks first', category: 'Environment', creatorName: 'Greener Grid Collective', creatorType: 'Community group', summary: 'Neighbourhoods with the fewest trees run several degrees hotter in summer. The city’s planting plan should start there.' },
      story: {
        headline: 'Trees are cooling infrastructure',
        intro: 'On a summer afternoon, blocks with little tree cover can be several degrees hotter than leafy streets a mile away. The city plants trees every year, but not where the heat is worst.',
        blocks: [
          h('The heat map'),
          p('Satellite heat maps line up closely with tree canopy maps. The hottest blocks tend to be the ones with the most asphalt and the fewest street trees.'),
          pic('park', 'Mature street trees shade pavement and lower surface temperatures.'),
          h('What we asked for'),
          p('We asked the parks department to rank this year’s planting by heat exposure instead of by request volume. The department agreed to publish the ranking.'),
        ],
        sources: [
          { id: 's1', title: 'Heat islands', url: 'https://www.epa.gov/heatislands', publisher: 'US EPA' },
          { id: 's2', title: 'Urban forests', url: 'https://www.fs.usda.gov/managing-land/urban-forests', publisher: 'USDA Forest Service' },
        ],
        actions: ['Request a street tree for your block'],
      },
      visuals: { coverImage: img(IMG.park), adImages: [img(IMG.park, 800), img(IMG.forest, 800)], adHeadline: 'Plant where it’s hottest', adDescription: 'The hottest blocks have the fewest trees. Help the city plant there first.', ctaText: 'See the map' },
      reach: { locations: ['Phoenix, AZ'], ageRange: [18, 65], interests: ['Gardening', 'Local news', 'Environment'], channels: { social_feed: 50, news: 30, video: 20 }, durationDays: 30 },
    },
  },
  {
    slug: 'beach-cleanup-habit', owner: 'alex', status: 'COMPLETED', goal: 3000, raised: 3240, backers: 167, publishedDaysAgo: 90,
    content: {
      basics: { title: 'Turn one cleanup day into a monthly habit', category: 'Environment', creatorName: 'Coastal Commons', creatorType: 'Nonprofit', summary: 'Our annual beach cleanup draws hundreds of people. This campaign invited them back every month.' },
      story: {
        headline: 'The beach needs more than one Saturday a year',
        intro: 'Every September, hundreds of volunteers clear the shoreline. By October the debris is back. We wanted to turn a single event into a habit.',
        blocks: [pic('beach', 'Volunteers sorting debris at the north beach.'), p('The campaign promoted a monthly first-Saturday cleanup to people within 20 miles of the coast.')],
        sources: [{ id: 's1', title: 'Marine debris program', url: 'https://marinedebris.noaa.gov/', publisher: 'NOAA' }],
        actions: ['Join the first-Saturday cleanup'],
      },
      visuals: { coverImage: img(IMG.beach), adImages: [img(IMG.beach, 800)], adHeadline: 'First Saturdays at the beach', adDescription: 'Join a monthly cleanup. Gloves and bags provided.', ctaText: 'Join us' },
      reach: { locations: ['San Diego, CA'], ageRange: [16, 65].map((x) => Math.max(18, x)) as [number, number], interests: ['Outdoors', 'Volunteering'], channels: { social_feed: 70, stories: 30 }, durationDays: 21 },
    },
  },
  {
    slug: 'recycling-that-gets-recycled', owner: 'alex', status: 'CHANGES_REQUESTED', goal: 4000, raised: 0, backers: 0,
    note: 'Source 2 link returns a 404. The statistic "90% of plastic is never recycled" needs a source that supports that exact figure, or rephrase it to match the EPA source.',
    content: {
      basics: { title: 'Recycling that actually gets recycled', category: 'Environment', creatorName: 'Alex Rivera', creatorType: 'Creator', summary: 'Most of what goes in the blue bin in our county is landfilled. A clear guide to what is accepted would fix most of it.' },
      story: {
        headline: 'Wishful recycling fills landfills',
        intro: 'When the wrong items go in the bin, whole loads get rejected. A one-page guide could change that.',
        blocks: [stat('90%', 'of plastic is never recycled', 's2'), pic('bins', 'Contaminated loads are often sent to landfill.')],
        sources: [
          { id: 's1', title: 'How do I recycle common recyclables', url: 'https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables', publisher: 'US EPA' },
          { id: 's2', title: 'County recycling audit', url: 'https://example.org/county-recycling-audit-2024', publisher: 'County' },
        ],
        actions: ['Print the guide for your kitchen'],
      },
      visuals: { coverImage: img(IMG.bins), adImages: [img(IMG.bins, 800)], adHeadline: 'Does it go in the blue bin?', adDescription: 'Most rejected loads come from a handful of items. Here is the list.', ctaText: 'Get the guide' },
      reach: { locations: ['Travis County, TX'], ageRange: [25, 65], interests: ['Home', 'Sustainability'], channels: { social_feed: 100 }, durationDays: 21 },
    },
  },
  {
    slug: 'fresh-produce-corner-stores', owner: 'alex', status: 'SUBMITTED', goal: 3500, raised: 0, backers: 0,
    content: {
      basics: { title: 'Fresh produce at every corner store', category: 'Health', creatorName: 'Alex Rivera', creatorType: 'Creator', summary: 'A city program pays for refrigerators so corner stores can stock fruit and vegetables. Few store owners have applied.' },
      story: {
        headline: 'The fridge is free. Most stores have not asked.',
        intro: 'The healthy corner store program covers the cost of a produce fridge and the first month of stock. Only twelve stores have applied.',
        blocks: [pic('produce', 'Small stores are often the closest food shop in neighbourhoods without a supermarket.'), p('This campaign targets store owners and the neighbours who shop there.')],
        sources: [{ id: 's1', title: 'Food Access Research Atlas', url: 'https://www.ers.usda.gov/data-products/food-access-research-atlas/', publisher: 'USDA ERS' }],
        actions: ['Tell your local store about the program'],
      },
      visuals: { coverImage: img(IMG.produce), adImages: [img(IMG.produce, 800), img(IMG.veg, 800)], adHeadline: 'Free fridge for your store', adDescription: 'The city pays for a produce fridge and first stock. Apply in 10 minutes.', ctaText: 'Apply now' },
      reach: { locations: ['Baltimore, MD'], ageRange: [21, 70], interests: ['Small business', 'Food'], channels: { social_feed: 60, search: 40 }, durationDays: 30 },
    },
  },
];

async function main() {
  await db.$transaction([
    db.notification.deleteMany(), db.complaint.deleteMany(), db.feedback.deleteMany(), db.follow.deleteMany(), db.save.deleteMany(),
    db.report.deleteMany(), db.campaignUpdate.deleteMany(), db.reviewDecision.deleteMany(), db.contribution.deleteMany(),
    db.campaign.deleteMany(), db.user.deleteMany(),
  ]);

  const alex = await db.user.create({ data: { name: 'Alex Rivera', email: 'alex@demo.campaigns', isGuest: false } });
  const reviewer = await db.user.create({ data: { name: 'Sam Patel (Review team)', email: 'review@demo.campaigns', role: 'REVIEWER', isGuest: false } });
  const community = await db.user.create({ data: { name: 'Community creators', email: 'creators@demo.campaigns', isGuest: false } });
  const backers = await Promise.all(['Jordan K.', 'Priya S.', 'Mateo R.'].map((name) => db.user.create({ data: { name, isGuest: false } })));

  const now = Date.now();
  const day = 864e5;
  const ids: Record<string, string> = {};

  for (const s of seeds) {
    const goal = s.goal * INR;
    const raised = s.raised * INR;
    const content: DraftContent = { ...base, ...s.content, goal, acceptedRules: s.status !== 'DRAFT' };
    const live = !['DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'REJECTED'].includes(s.status);
    const publishedAt = live ? new Date(now - (s.publishedDaysAgo ?? 10) * day) : null;
    const submittedAt = s.status !== 'DRAFT' ? new Date((publishedAt?.getTime() ?? now) - 2 * day) : null;
    const c = await db.campaign.create({
      data: {
        slug: s.slug, ownerId: s.owner === 'alex' ? alex.id : community.id, status: s.status, featured: !!s.featured, isDemo: true,
        title: content.basics.title, summary: content.basics.summary, category: content.basics.category, creatorName: content.basics.creatorName,
        creatorType: content.basics.creatorType, coverImage: content.visuals.coverImage ?? '', content: content as any, goal,
        raised, backerCount: s.backers, submittedAt, publishedAt,
        endsAt: publishedAt ? new Date(publishedAt.getTime() + 30 * day) : null,
        budgetApproved: ['DISTRIBUTION_PREP', 'PROMOTING', 'COMPLETED'].includes(s.status),
        adSetupReady: ['PROMOTING', 'COMPLETED'].includes(s.status),
        createdAt: new Date((submittedAt?.getTime() ?? now) - 3 * day),
      },
    });
    ids[s.slug] = c.id;

    // Audit trail consistent with the current status.
    const trail: [string, CampaignStatus, string | null, string][] = [];
    if (submittedAt) trail.push(['SUBMITTED', 'SUBMITTED', null, s.owner === 'alex' ? alex.name : content.basics.creatorName]);
    if (s.status === 'CHANGES_REQUESTED') trail.push(['CHANGES_REQUESTED', 'CHANGES_REQUESTED', s.note ?? null, reviewer.name]);
    if (live) {
      trail.push(['APPROVED', 'APPROVED', 'Sources checked; targeting within policy.', reviewer.name]);
      trail.push(['TRANSITION', 'FUNDING', 'Published and open for backing', reviewer.name]);
    }
    if (['FUNDED', 'DISTRIBUTION_PREP', 'PROMOTING', 'COMPLETED'].includes(s.status)) trail.push(['TRANSITION', 'FUNDED', 'Funding goal reached', 'System']);
    if (['DISTRIBUTION_PREP', 'PROMOTING', 'COMPLETED'].includes(s.status)) trail.push(['TRANSITION', 'DISTRIBUTION_PREP', 'Budget approved', reviewer.name]);
    if (['PROMOTING', 'COMPLETED'].includes(s.status)) trail.push(['TRANSITION', 'PROMOTING', 'Ads approved by distribution partners', reviewer.name]);
    if (s.status === 'COMPLETED') trail.push(['TRANSITION', 'COMPLETED', 'Flight ended', 'System']);
    let prev: string | null = 'DRAFT';
    for (const [i, [action, to, note, actor]] of trail.entries()) {
      await db.reviewDecision.create({
        data: { campaignId: c.id, action, fromStatus: prev, toStatus: to, note, actorName: actor, createdAt: new Date((submittedAt?.getTime() ?? now) + i * day * 0.8) },
      });
      prev = to;
    }

    if (['PROMOTING', 'COMPLETED'].includes(s.status)) {
      await db.report.create({ data: { campaignId: c.id, startedAt: new Date(now - (s.status === 'COMPLETED' ? 50 : 6) * day) } });
      if (s.status === 'COMPLETED') await simulateDelivery(c.id, 1);
      else {
        await simulateDelivery(c.id, 0.3);
        await simulateDelivery(c.id, 0.25);
      }
    }
  }

  // Updates
  await db.campaignUpdate.createMany({
    data: [
      { campaignId: ids['winter-shelter-hours'], title: 'Council vote scheduled for 12 December', body: 'The amendment is on the agenda. Public comment opens at 6pm; you can also email comments in advance.', createdAt: new Date(now - 2 * day) },
      { campaignId: ids['shade-trees-hottest-blocks'], title: 'Ads are live in Phoenix', body: 'Distribution started this week across social feeds, local news sites and short video. First delivery numbers are in the report.', createdAt: new Date(now - 5 * day) },
      { campaignId: ids['beach-cleanup-habit'], title: 'Final report is out', body: 'Thank you to everyone who backed this. The January cleanup had 3x the usual turnout. Full numbers are in the report.', createdAt: new Date(now - 30 * day) },
      { campaignId: ids['redraw-the-bus-network'], title: 'Transit board added a public hearing', body: 'The board added a second hearing on 4 March after hundreds of comments came in.', createdAt: new Date(now - 4 * day) },
    ],
  });

  // Alex as a backer: payment history with one failure.
  const mk = async (slug: string, usdAmount: number, status: string, daysAgo: number, user = alex, show = false, failure?: string) => {
    const amount = usdAmount * INR;
    const c = await db.campaign.findUniqueOrThrow({ where: { id: ids[slug] } });
    const f = feeBreakdown(amount);
    await db.contribution.create({
      data: {
        campaignId: c.id, userId: user.id, amount, platformFee: f.platformFee, processingFee: f.processingFee, total: f.total,
        estimatedReach: estimateReach(amount, channelFactor((c.content as any).reach.channels)), status, failureReason: failure ?? null,
        showName: show, displayName: show ? user.name : null, receiptNo: `RC-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        provider: 'RAZORPAY_TEST', cardLast4: null, createdAt: new Date(now - daysAgo * day),
      },
    });
  };
  await mk('redraw-the-bus-network', 25, 'SUCCEEDED', 7);
  await mk('winter-shelter-hours', 10, 'SUCCEEDED', 3);
  await mk('library-hours-working-parents', 15, 'FAILED', 2, alex, false, 'Your card was declined. No money was taken.');
  await mk('beach-cleanup-habit', 20, 'SUCCEEDED', 70);
  await mk('winter-shelter-hours', 50, 'SUCCEEDED', 5, backers[0], true);
  await mk('winter-shelter-hours', 25, 'SUCCEEDED', 4, backers[1], true);
  await mk('clean-water-public-schools', 40, 'SUCCEEDED', 6, backers[2], true);

  for (const slug of ['redraw-the-bus-network', 'winter-shelter-hours', 'beach-cleanup-habit', 'clean-water-public-schools']) {
    await db.follow.create({ data: { userId: alex.id, campaignId: ids[slug] } });
  }
  await db.save.create({ data: { userId: alex.id, campaignId: ids['air-quality-block-by-block'] } });
  await db.save.create({ data: { userId: alex.id, campaignId: ids['farmers-right-to-repair'] } });

  // Seed feedback so the reviewer view has data.
  for (const [q, a, k] of [['VISUALS', 'YES', 14], ['VISUALS', 'SOMEWHAT', 6], ['VISUALS', 'NO', 2], ['MIND_CHANGED', 'YES', 5], ['MIND_CHANGED', 'SOMEWHAT', 11], ['MIND_CHANGED', 'NO', 7]] as const) {
    for (let i = 0; i < k; i++) await db.feedback.create({ data: { campaignId: ids['shade-trees-hottest-blocks'], question: q, answer: a } });
  }

  // Alex's activity feed.
  const notes: [string, string, string, string | null, number, boolean][] = [
    ['REVIEW', 'Changes requested', 'A reviewer asked for edits to "Recycling that actually gets recycled": one source link is broken.', ids['recycling-that-gets-recycled'], 0.2, false],
    ['SUBMISSION', 'Submission received', '"Fresh produce at every corner store" is in the review queue. We usually respond within 1–2 business days.', ids['fresh-produce-corner-stores'], 0.6, false],
    ['MILESTONE', '75% funded', '"The free crisis line most people don’t know exists" has raised ₹3,02,400 of ₹4,00,000.', ids['free-mental-health-line'], 1, false],
    ['PROMOTION', 'Distribution update', '"Plant shade trees on the hottest blocks first" has been shown to new audiences in Phoenix. See the report.', ids['shade-trees-hottest-blocks'], 1.5, true],
    ['UPDATE', 'Update: Keep the winter shelter open past 7am', 'Council vote scheduled for 12 December', ids['winter-shelter-hours'], 2, true],
    ['CONTRIBUTION', 'Payment unsuccessful', 'Your card was declined for "Library hours that fit working parents". No money was taken.', ids['library-hours-working-parents'], 2, true],
    ['CONTRIBUTION', 'Contribution confirmed', '₹2,000.00 toward distributing "Redraw the bus network around where people actually work".', ids['redraw-the-bus-network'], 7, true],
    ['REPORT', 'Final report available', '"Turn one cleanup day into a monthly habit" finished distribution. See where the money went.', ids['beach-cleanup-habit'], 30, true],
    ['SECURITY', 'New sign-in', 'Your account was signed in on a new device. If this was not you, contact support.', null, 12, true],
  ];
  for (const [kind, title, body, campaignId, daysAgo, read] of notes) {
    await db.notification.create({ data: { userId: alex.id, kind, title, body, campaignId, read, dedupeKey: `seed:${title}:${daysAgo}`, createdAt: new Date(now - daysAgo * day) } });
  }

  console.log(`Seeded ${seeds.length} campaigns. Demo creator: alex@demo.campaigns · Reviewer: review@demo.campaigns`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
