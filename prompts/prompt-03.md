# Global Car Exchange – System Issues and Enhancement Requests

## 1. Customer – Sell Vehicle

**Page:** `/customer/sell-vehicle/`

**Issue: Selling Request Submission Error**

- Customers are unable to submit a vehicle selling request.
- The system displays a **"Too Many Attempts"** error.
- **Expected Behavior:** Customers should be able to submit selling requests successfully without encountering unnecessary rate-limit errors.

## 2. Marketing Specialist – Vehicle Management

**Page:** `/marketing_specialist/vehicles`

**Enhancement 1: Remove Interior Images**

- Remove the interior section from the vehicle image display.

**Enhancement 2: Adjust 360° Image Zoom**

- Zoom out the 360° vehicle images to display a wider view of the vehicle.
- Use the previous Vercel deployment as the visual reference for the correct zoom level.

## 3. Customer – Buying Requirements

**Page:** `/customer/buying-requirements/`

**Issue: Buying Guide Wording Not Updated**

- The previously requested wording revisions for the Buying Guide have not yet been implemented.
- **Expected Behavior:** Update the Buying Guide to reflect the revised wording.

## 4. Vehicle Papers – Contract

**Page:** `/vehicle-papers/b25d6eae-7558-4867-992e-37b1503cca55/contract/`

**Issue: Signed Contract Data Not Loading**

- The signed contract is not loading or fetching the required information correctly.
- The following information is missing:
  - Sales representative's signature
  - Buyer's signature
  - Buyer's full name
- **Expected Behavior:** The contract should correctly retrieve and display both signatures and the buyer's complete name.

## 5. Landing Page – Mobile Application Download

**Enhancement: Direct Mobile App Download**

- Add a **"Download Mobile App"** button to the landing page.
- Clicking the button should immediately initiate the application download.
- The button should not redirect users to another page or external link before downloading.
- **APK Asset Directory:** `public/assets/apk`
- The downloadable APK file must be retrieved from the specified asset directory.
- **Expected Behavior:** Clicking the download button should directly initiate the download of the APK file stored in `public/assets/apk`.

## 6. System-Wide – Test Data

**Enhancement: Realistic Test Data**

- Create realistic test data based on actual survey responses.
- Ensure the test data closely represents real-world users, vehicles, transactions, and other relevant system records.
- Use the survey results as the primary reference when generating the test data.

## 7. System-Wide – Sidebar Logo

**Enhancement: Theme-Adaptive Sidebar Logo**

- Replace the existing sidebar logo with the provided Global Car Exchange logo assets.
- Use the following logo files:
  - **Dark Mode:** `public/assets/logo/GCE-LOGO-DARKMODE.png`
  - **Light Mode:** `public/assets/logo/GCE-LOGO-LIGHTMODE.png`
- Ensure the sidebar automatically displays the appropriate logo based on the currently selected system theme.
- When users switch between light mode and dark mode, the sidebar logo should update accordingly.
- **Expected Behavior:**
  - Dark mode displays `GCE-LOGO-DARKMODE.png`.
  - Light mode displays `GCE-LOGO-LIGHTMODE.png`.
  - The logo updates automatically when the theme changes, without requiring a page refresh.

---

## Summary of Issues and Enhancements


| #   | Module / Page                               | Type             | Priority |
| --- | ------------------------------------------- | ---------------- | -------- |
| 1   | Customer – Sell Vehicle                     | Bug              | Critical |
| 2   | Marketing Specialist – Vehicles (Interior)  | Enhancement      | Low      |
| 3   | Marketing Specialist – Vehicles (360° Zoom) | Enhancement      | Medium   |
| 4   | Customer – Buying Requirements              | Pending Revision | Medium   |
| 5   | Vehicle Papers – Contract                   | Bug              | High     |
| 6   | Landing Page – Mobile App Download          | Enhancement      | Medium   |
| 7   | System-Wide – Test Data                     | Data Preparation | Medium   |
| 8   | System-Wide – Sidebar Logo                  | Enhancement      | Low      |


*Priorities are suggested based on functional impact and may be adjusted according to development and testing requirements.*