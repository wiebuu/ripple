/**
 * Free stock videos (Mixkit License: free for commercial use, no attribution required),
 * offered as ready-made campaign videos and used by the demo campaigns. 360p MP4s, under 2 MB each.
 */
const mixkit = (id: number) => ({ url: `https://assets.mixkit.co/videos/${id}/${id}-360.mp4`, thumb: `https://assets.mixkit.co/videos/${id}/${id}-thumb-360-0.jpg` });

export const SAMPLE_VIDEOS = [
  { id: 'community-hug', title: 'People coming together', ...mixkit(4709) },
  { id: 'planting', title: 'Planting a seedling', ...mixkit(46092) },
  { id: 'laptop', title: 'Working on a laptop', ...mixkit(242) },
  { id: 'coding', title: 'Building software', ...mixkit(46635) },
  { id: 'city-train', title: 'City train', ...mixkit(1606) },
  { id: 'classroom', title: 'Classroom', ...mixkit(35954) },
  { id: 'library', title: 'Library', ...mixkit(21595) },
  { id: 'friends-table', title: 'Friends at a table', ...mixkit(5333) },
] as const;

export type SampleVideo = (typeof SAMPLE_VIDEOS)[number];
export const sampleVideo = (id: SampleVideo['id']) => SAMPLE_VIDEOS.find((v) => v.id === id)!;
/** Poster image for a video URL, when it's one of the samples. */
export const videoThumb = (url?: string) => SAMPLE_VIDEOS.find((v) => v.url === url)?.thumb;
