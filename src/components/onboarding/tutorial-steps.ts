// T06: the first-login tutorial, one list per kind of account. Each step names where to find the feature.

export type TutorialStep = { title: string; body: string };

const CUSTOMER_STEPS: TutorialStep[] = [
  {
    title: "Welcome to Global Exchange Car",
    body: "This short tour shows where things are. Press Next to continue or Skip to start right away.",
  },
  {
    title: "Browse the Showroom",
    body: "Open Showroom in the menu to see every car for sale, with photos, price and details. Save the ones you like to Favourites.",
  },
  {
    title: "Get recommendations",
    body: "Recommendations asks about your budget, the make, body type, number of seats and what the car is for, then lists the cars that fit.",
  },
  {
    title: "Buy a car",
    body: "Choose a car and send a request. In My Transactions, upload 2 valid IDs (front and back) and 1 proof of billing. GCE checks them before approving.",
  },
  {
    title: "Pay in full or finance",
    body: "Pay by cash or bank transfer, or choose In-House Financing. The loan calculator shows the monthly payment for each term before you decide.",
  },
  {
    title: "Stay updated",
    body: "The bell at the top shows updates on your requests and payment reminders. Use Inquiries to message GCE.",
  },
];

const STAFF_STEPS: TutorialStep[] = [
  {
    title: "Welcome to the GCE system",
    body: "This short tour shows how the staff workspace works. Press Next to continue or Skip to start right away.",
  },
  {
    title: "Your menu",
    body: "The sidebar lists only the pages your role uses. Your main tasks are on the first pages of the menu.",
  },
  {
    title: "Notifications",
    body: "The bell at the top shows the items waiting for you. Open one to go straight to the record.",
  },
  {
    title: "Approvals",
    body: "Every approval or rejection asks you to confirm first, so nothing is decided by a stray click. Rejections ask for a reason.",
  },
  {
    title: "Your account",
    body: "Use the account menu at the top right for your profile and to sign out. Layout and theme controls are next to it.",
  },
];

const SUPER_ADMIN_STEPS: TutorialStep[] = [
  {
    title: "Welcome, IT Support",
    body: "As Super Admin you maintain the system. You manage accounts and roles, and you do not see business records.",
  },
  { title: "Users", body: "Users lists every account. Check account status here when someone cannot sign in." },
  { title: "Roles", body: "Roles sets what each role may do, and assigns roles to accounts." },
  {
    title: "Settings",
    body: "Settings holds the business rules, such as GCE's financing profit. Change them only on the CEO's instruction.",
  },
];

export function tutorialSteps(role: string | null): TutorialStep[] {
  if (role === "customer") return CUSTOMER_STEPS;
  if (role === "super_admin") return SUPER_ADMIN_STEPS;
  return STAFF_STEPS;
}
