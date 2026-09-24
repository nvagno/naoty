import { NoteEditor } from "@/components/note/NoteEditor";

export default async function NotePage({ params, searchParams }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  const { nouvelle } = await searchParams;
  return <NoteEditor key={id} id={id} isNew={nouvelle === "1"} />;
}
