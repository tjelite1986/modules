import ClipsClient, { type ClipSummary, type ProfileCard } from "./ClipsClient";
import { listClips, listProfileSummaries } from "@/lib/clips";
import { getAllClipStats } from "@/lib/clipStats";
import { getCommentCounts } from "@/lib/clipComments";

export const dynamic = "force-dynamic";

export default async function ClipsPage() {
  const stats = getAllClipStats();
  const commentCounts = getCommentCounts();
  const profiles: ProfileCard[] = listProfileSummaries().map((p) => ({
    profile: p.profile,
    count: p.count,
    lastMtime: p.lastMtime,
    sampleSlug: p.sampleSlug,
    sampleHasPoster: p.sampleHasPoster,
    samplePosterMtime: p.samplePosterMtime,
    sampleVideoMtime: p.sampleVideoMtime,
  }));
  const clips: ClipSummary[] = listClips().map((c) => {
    const s = stats.get(c.slug);
    return {
      slug: c.slug,
      profile: c.profile,
      videoExt: c.videoExt,
      videoMtime: c.videoMtime,
      hasPoster: c.posterExt !== null,
      posterMtime: c.posterMtime,
      transcodeStatus: c.transcodeStatus,
      title: c.meta.title || c.slug.split("/").pop() || c.slug,
      description: c.meta.description ?? null,
      uploader: c.meta.uploader ?? null,
      tags: c.meta.tags ?? [],
      url: c.meta.url ?? null,
      likes: s?.likes ?? 0,
      views: s?.views ?? 0,
      comments: commentCounts.get(c.slug) ?? 0,
    };
  });

  return <ClipsClient clips={clips} profiles={profiles} />;
}
