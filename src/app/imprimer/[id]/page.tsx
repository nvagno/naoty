import { PrintView } from "@/components/note/PrintView";

export default async function PrintPage({ params }: PageProps<"/imprimer/[id]">) {
  const { id } = await params;
  return <PrintView id={id} />;
}
