import PhotosClient, {
  type PhotoSummary,
  type PhotoProfileCard,
  type StoryGroupSummary,
  type HighlightGroupSummary,
} from "../photos/PhotosClient";
import {
  listPhotos,
  listProfileSummaries,
  listStoryGroups,
  listHighlightGroups,
} from "@/lib/photos";
import { getAllClipStats } from "@/lib/clipStats";
import { getCommentCounts } from "@/lib/clipComments";

export const dynamic = "force-dynamic";

// Browse tab of InstaElite. Renders the same Photo browser the standalone
// /photos route had — the Manage tab (under /instagram/manage) handles
// adding profiles + triggering syncs. /photos is kept as a redirect for
// any old links/bookmarks.
export default async function InstaeliteBrowsePage() {
  const stats = getAllClipStats("photos");
  const commentCounts = getCommentCounts("photos");
  const storyGroups: StoryGroupSummary[] = listStoryGroups().map((g) => ({
    profile: g.profile,
    count: g.count,
    latestMtime: g.latestMtime,
    stories: g.stories.map((s) => ({
      slug: s.slug,
      kind: s.kind,
      ext: s.ext,
      mtime: s.mtime,
      hasPoster: s.posterExt !== null,
      posterMtime: s.posterMtime,
    })),
  }));
  const highlightGroups: HighlightGroupSummary[] = listHighlightGroups().map((g) => ({
    profile: g.profile,
    name: g.name,
    count: g.count,
    latestMtime: g.latestMtime,
    items: g.items.map((p) => ({
      slug: p.slug,
      kind: p.kind,
      ext: p.ext,
      mtime: p.mtime,
      hasPoster: p.posterExt !== null,
      posterMtime: p.posterMtime,
    })),
  }));
  const profiles: PhotoProfileCard[] = listProfileSummaries().map((p) => ({
    profile: p.profile,
    count: p.count,
    lastMtime: p.lastMtime,
    sampleSlug: p.sampleSlug,
    sampleKind: p.sampleKind,
    sampleHasPoster: p.sampleHasPoster,
    samplePosterMtime: p.samplePosterMtime,
    sampleMtime: p.sampleMtime,
  }));
  const photos: PhotoSummary[] = listPhotos().map((p) => {
    const s = stats.get(p.slug);
    return {
      slug: p.slug,
      profile: p.profile,
      kind: p.kind,
      ext: p.ext,
      mtime: p.mtime,
      hasPoster: p.posterExt !== null,
      posterMtime: p.posterMtime,
      title: p.meta.title || p.slug,
      description: p.meta.description ?? null,
      uploader: p.meta.uploader ?? null,
      tags: p.meta.tags ?? [],
      url: p.meta.url ?? null,
      likes: s?.likes ?? 0,
      views: s?.views ?? 0,
      comments: commentCounts.get(p.slug) ?? 0,
      items: p.items?.map((it) => ({
        kind: it.kind,
        ext: it.ext,
        mtime: it.mtime,
        hasPoster: it.hasPoster,
        posterMtime: it.posterMtime,
      })),
    };
  });

  return (
    <PhotosClient
      photos={photos}
      profiles={profiles}
      storyGroups={storyGroups}
      highlightGroups={highlightGroups}
    />
  );
}
