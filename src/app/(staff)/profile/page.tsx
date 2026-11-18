"use client";

import { useSession } from "@/components/auth/session-provider";
import { toOwnProfile } from "@/components/profile/load-own-profile";
import { ProfileForms } from "@/components/profile/profile-forms";

export default function ProfilePage() {
  return <ProfileForms profile={toOwnProfile(useSession())} />;
}
