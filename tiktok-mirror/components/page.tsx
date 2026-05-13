import TiktokOverviewClient from "./TiktokOverviewClient";
import type { TiktokVideoSummary } from "./[username]/TiktokFeedClient";
import { listAllVideos, listProfiles } from "@/lib/tiktok";
import { getAllTiktokStats } from "@/lib/tiktokStats";
import { getTiktokCommentCounts } from "@/lib/tiktokComments";

export const dynamic = "force-dynamic";

export default function TiktokPage() {
  const profiles = listProfiles();
  const stats = getAllTiktokStats();
  const commentCounts = getTiktokCommentCounts();

  const videos: TiktokVideoSummary[] = listAllVideos(300).map((v) => {
    const s = stats.get(v.videoId);
    return {
      videoId: v.videoId,
      username: v.username,
      title: v.title || `${v.username} · ${v.videoId}`,
      description: v.description,
      duration: v.duration,
      uploadDate: v.uploadDate,
      hasPoster: v.hasPoster,
      posterMtime: v.posterMtime,
      hasVideo: v.hasVideo,
      videoMtime: v.videoMtime,
      url: v.url,
      likes: s?.likes ?? 0,
      views: s?.views ?? 0,
      comments: commentCounts.get(v.videoId) ?? 0,
    };
  });

  return <TiktokOverviewClient profiles={profiles} videos={videos} />;
}
