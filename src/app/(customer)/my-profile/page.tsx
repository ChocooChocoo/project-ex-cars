import { loadOwnProfile } from "@/components/profile/load-own-profile";
import { ProfileForms } from "@/components/profile/profile-forms";

export default async function ProfilePage() {
  return <ProfileForms profile={await loadOwnProfile()} />;
}
