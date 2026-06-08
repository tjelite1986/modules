import { notFound } from "next/navigation";
import { getBook } from "@/lib/books";
import ReaderClient from "./ReaderClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BookReaderPage({ params }: Props) {
  const { slug } = await params;
  const book = getBook(slug);
  if (!book) notFound();
  return (
    <ReaderClient
      slug={book.slug}
      title={book.title}
      author={book.author}
      format={book.format}
    />
  );
}
