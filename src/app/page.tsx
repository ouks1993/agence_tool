import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/permissions";

export default async function Home() {
  const user = await getOptionalUser();
  redirect(user ? "/dashboard" : "/login");
}
