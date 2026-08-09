import { redirect } from "next/navigation";

export default function Home() {
  redirect("/template/dashboard/default");
  return <>Coming Soon</>;
}
