import type { Metadata } from "next";
import { Anatomy } from "@/components/anatomy/Anatomy";

export const metadata: Metadata = {
  title: "Anatomia · Codex of Machines",
  description: "Leonardo da Vinci's studies of the human body: the Vitruvian Man measured, and his anatomical sheets opened, with what he got right and wrong.",
};

export default function Page() {
  return <Anatomy />;
}
