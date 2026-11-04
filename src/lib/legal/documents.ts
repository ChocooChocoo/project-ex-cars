// T06: the documents a new account must read before agreeing at registration.
// Draft wording for Global Exchange Car; GCE replaces it with the text approved by its counsel.

export type LegalDocument = { title: string; sections: { heading: string; body: string }[] };

export const TERMS_AND_CONDITIONS: LegalDocument = {
  title: "Terms and Conditions",
  sections: [
    {
      heading: "1. About these terms",
      body: "These terms apply to your use of the Global Exchange Car (GCE) website and system, including the showroom, vehicle requests, sell offers, purchases and In-House Financing. By creating an account you agree to them.",
    },
    {
      heading: "2. Your account",
      body: "Give your real name and correct contact details. Keep your password private; you are responsible for activity on your account. GCE may suspend an account that gives false information or misuses the system.",
    },
    {
      heading: "3. Listings and prices",
      body: "GCE tries to keep vehicle details, photos and prices accurate, but a listing is not an offer until GCE confirms your request. Prices may change until a transaction is approved.",
    },
    {
      heading: "4. Buying a vehicle",
      body: "A purchase starts with your request and the documents GCE asks for: two valid government IDs and one proof of billing. GCE reviews them before approving the sale. The delivery fee and the initial downpayment are paid before a car is dispatched.",
    },
    {
      heading: "5. In-House Financing",
      body: "Financing adds GCE's financing profit to the vehicle price and is paid in monthly installments over the term you choose. Missed installments may lead to penalties or recovery of the vehicle, as stated in your financing agreement.",
    },
    {
      heading: "6. Selling a vehicle to GCE",
      body: "When you offer a car, GCE inspects it before making a final offer. The offer may change if the inspection finds issues. You confirm that you own the car and that its papers are genuine.",
    },
    {
      heading: "7. Payments",
      body: "Online payments go through PayMongo. A payment counts once GCE verifies it. Keep your receipts.",
    },
    {
      heading: "8. Changes to these terms",
      body: "GCE may update these terms. The current version is always shown at registration, and continued use of your account means you accept it.",
    },
  ],
};

export const COMPANY_POLICY: LegalDocument = {
  title: "Company Policy",
  sections: [
    {
      heading: "1. Privacy and your data",
      body: "GCE collects the details you give and the documents you upload to process your transactions, in line with the Data Privacy Act of 2012 (RA 10173). Your IDs and proof of billing are seen only by the GCE staff who verify them.",
    },
    {
      heading: "2. Vehicle records",
      body: "Each vehicle's VIN, plate, engine and chassis numbers stay in GCE's records and are not shown in the public showroom.",
    },
    {
      heading: "3. Viewings, meet-ups and deliveries",
      body: "Schedule viewings and meet-ups through the system. Repeated no-shows may limit you to viewings at the GCE office. GCE staff identify themselves at every meet-up and delivery.",
    },
    {
      heading: "4. Fair dealing",
      body: "GCE does not accept stolen vehicles, forged papers or payments from unlawful sources, and reports them to the authorities.",
    },
    {
      heading: "5. Communication",
      body: "GCE contacts you through in-app messages, notifications and the email on your account, including reminders before each financing payment is due.",
    },
    {
      heading: "6. Questions and complaints",
      body: "Send questions or complaints through the Inquiries page.",
    },
  ],
};
