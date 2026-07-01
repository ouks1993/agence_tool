import { redirect } from "next/navigation";

/**
 * The user's personal account (display name, email, language, theme, and
 * payment preferences) lives on /settings. /profile is kept as a permanent
 * redirect so any existing links/bookmarks resolve to the real account page.
 */
export default function ProfilePage() {
  redirect("/settings");
}
