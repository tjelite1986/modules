import TiktokFeedClient, { type TiktokVideoSummary } from "./TiktokFeedClient";
import { isValidUsername, listProfiles, listVideosForProfile } from "@/lib/tiktok";
import { getAllTiktokStats } from "@/lib/tiktokStats";
import { getTiktokCommentCounts } from "@/lib/tiktokComments";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TiktokProfilePage({ params }: { params: { username: string } }) {
  const username = decodeURIComponent(params.username);
  if (!isValidUsername(username)) notFound();
  const profile = listProfiles().find((p) => p.username === username);
  if (!profile) notFound();

  const stats = getAllTiktokStats([username]);
  const commentCounts = getTiktokCommentCounts([username]);

  const videos: TiktokVideoSummary[] = listVideosForProfile(username).map((v) => {
    const s = stats.get(v.videoId);
    return {
      videoId: v.videoId,
      username: v.username,
      title: v.title || `${username} · ${v.videoId}`,
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

  return (
    <TiktokFeedClient
      username={username}
      displayName={profile.displayName}
      videos={videos}
    />
  );
}
