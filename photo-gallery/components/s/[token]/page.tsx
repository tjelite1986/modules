import SharedAlbumClient from "./SharedAlbumClient";

export const dynamic = "force-dynamic";

export default function SharedAlbumPage({ params }: { params: { token: string } }) {
  return <SharedAlbumClient token={params.token} />;
}
