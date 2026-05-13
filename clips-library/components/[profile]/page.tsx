import { notFound } from "next/navigation";
import ClipsClient, { type ClipSummary } from "../ClipsClient";
import { listClips, listProfiles, isValidProfile } from "@/lib/clips";
import { getAllClipStats } from "@/lib/clipStats";
import { getCommentCounts } from "@/lib/clipComments";

export const dynamic = "force-dynamic";

interface Props {
  params: { profile: string };
}

export default async function ClipsProfilePage({ params }: Props) {
  const profile = decodeURIComponent(params.profile);
  if (!isValidProfile(profile)) notFound();

  const profiles = listProfiles();
  if (!profiles.includes(profile)) notFound();

  const stats = getAllClipStats();
  const commentCounts = getCommentCounts();
  const clips: ClipSummary[] = listClips(undefined, profile).map((c) => {
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

  return <ClipsClient clips={clips} library="clips" profile={profile} />;
}
