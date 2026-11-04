GCE change requests batch 3 — test sheet

Tester: Cesar Bonifacio

1. 1. Any CI can open a delivery that is not theirs

   Client: Works — As the Confidential Informant I opened a delivery from Field Cases that belongs to another CI (Liza Manalo, case 022f0842). It opened normally with the schedule, buyer, vehicle, tracking, vehicle papers and contract sections; no Unauthorized page. The only controls on that page are Toggle Sidebar, Search and Back to field cases - no Mark Dispatched, no Report delay, no Record Buyer Met. On my own delivery case (5e406599) those action buttons do appear.

2. 2. Four ID images and a proof of billing

   Client: Works — Uploaded the front and back of my driver's license and passport, one at a time. The line went 1/4, 2/4, 3/4, 4/4 ID images. I tried a fifth ID (UMID front) and it said "You can upload four ID images: the front and back of two IDs" and nothing was added. Uploading the proof of billing changed the line to "proof of billing uploaded". Submit Request only appeared after I chose Cash, GCE Visit, a date and hour and pressed Save Details; then it sent and said the Sales Manager will review it within 7 days.

3. 3. Remove a wrong image and upload again

   Client: Works — Pressed Remove on the back of my passport and got "Document removed." The count dropped from 4/4 to 3/4 and the row disappeared. I uploaded the same side again and it went back to 4/4 with no duplicate row. On my approved Toyota Vios request there are no Remove buttons at all, and after I sent the Wigo request the Remove buttons disappeared too.

4. 4. Address dropdowns

   Client: Works — Opened Profile &gt; Address. Region, City and Barangay have a star, Province does not. I picked CALABARZON &gt; Laguna &gt; City of Calamba &gt; Bagong Kalsada, typed my block and lot, pressed Save details and got "Profile saved.". I reloaded and all four choices plus the block and lot were still there. Buy Now on a car already had my full address in the location box. Then I changed only the city to City of Biñan and pressed Save details; it refused with "Choose your barangay.", which is right because the barangay was cleared.

5. 5. Cash buys have no Cancel and no document upload

   Client: Works — As Sales Manager I opened a cash buy waiting for approval (Toyota Wigo #50597d23). There is no Cancel anywhere and no upload for Valid ID or Proof of Billing; only Approve and Reject. On an approved cash delivery (Suzuki Ertiga #e5499f32) still no Cancel and no uploads. A financing buy (Honda BR-V #bf4353d2) still has Cancel, Mark Sold and Buyer declined, exactly as before.

6. 6. Buyer declined disappears once the papers are out

   Client: Works — On a cash delivery whose papers are already Released to CI (Suzuki Swift #754f6cc7) there is no Buyer declined, no Declined - Legit and no Declined - Not Legit, and no Cancel. On a cash delivery with no papers requested (Suzuki Ertiga #e5499f32) both declined options are still there. On a financing buy with papers Released to CI (Toyota Vios #beb8ad50) the declined options and Cancel remain, as it should for financing.

7. 7. A delivery no longer needs a Mechanic

   Client: Works — I approved a fresh cash delivery (Toyota Wigo 2020 #0fdd2432), answered "Yes, we can deliver" and pressed Confirm and notify buyer: "Delivery terms sent to the buyer." After reloading, Delivery team shows exactly two pickers, Confidential Informant and Head Security. I searched the whole page and the word Mechanic does not appear. I picked Liza Manalo and Gregorio Villanueva, pressed Create delivery field case and got "Delivery field case created."; the new case is at the top of Field Cases and it has no Mechanic.

8. 8. Record Payment fills itself in

   Client: Works — On the approved cash delivery the form came up already filled: Amount ₱34,900.00, Payment for Downpayment, Method Cash, and I could only change the date and add a photo. I pressed Record Payment twice quickly and only one payment was written (I checked: one downpayment row). Then the form was replaced by "Recorded, waiting for the Head Accountant's check." After the accountant verified it, the next form offered the Balance ₱314,100.00. Note: this delivery is in CALABARZON so the fee was free and skipped; the balance appeared after the downpayment was verified, before the contract was signed.

9. 9. Head Accountant cleanup

   Client: Works — As Head Accountant I opened an approved transaction: there is no Mark Sold button and no Record Payment form. On the downpayment row, Verify is a solid button and Reject is an outlined button with red text, both the same 28 px size as normal buttons. I pressed Verify and got "Payment verified." The row shows Verified and the Verify/Reject buttons are gone.

10. 10. Delivery fee range and the fixed 10% down payment

   Client: Works — As a buyer in Laguna my delivery request says "Delivery fee range for your area: Free delivery" and "Delivery fee range for your area: Free delivery." After I changed my profile to Central Visayas &gt; Cebu &gt; Alcantara &gt; Cabadiangan and saved, the same request says "Delivery fee range for your area: ₱10,000 – ₱15,000." I put my address back to CALABARZON &gt; Laguna &gt; City of Calamba &gt; Bagong Kalsada afterwards. As Sales Manager, after answering Yes we can deliver, the panel shows "Delivery fee ₱0 · Free in CALABARZON", "Price Range: Free delivery" and a read-only "Down payment (10% of the vehicle price) ₱34,900.00", which is exactly 10% of the ₱349,000 car.

11. 11. The CI releases the papers from Vehicle Papers

   Client: Works — As Sales Manager I pressed Request papers release on an approved Toyota Wigo sale (#456c2535) and got "Papers requested from the Confidential Informant."; the panel then said Papers Requested. As the CI, Vehicle Papers shows that row as Papers Requested and the 3-dot menu has View papers, Print Deed of Sale, Print Policy &amp; Warranty and Mark Released. View papers shows the OR/CR note, "Physical OR/CR kept by CI" (no file) and Print links for the deed and the warranty. I pressed Mark Released and got "Papers released to the Sales Manager."; the row changed to Released. Back as Sales Manager the status said Released with a Receive papers button; pressing it gave "Papers received." and Mark Sold is available.

12. 12. Print the Deed of Sale and the Policy &amp; Warranty

   Client: Works — From Vehicle Papers, Print Deed of Sale shows Juan Dela Cruz and his address, the Toyota Wigo 2020 Silver and PHP 356,000.00. Plate, Engine and Chassis print as blank lines because the car has none recorded. Print Policy &amp; Warranty shows the DRAFT wording, the same buyer and car, and "Warranty: \_\_\_\_\_\_\_\_". In print preview the sheet is one US Letter page (816 x 1056 px), the sidebar and the buttons are hidden, and the OR/CR has no print action, only the physical copy note.

13. 13. Work schedules by role

   Client: Not sure — As Mechanic, Attendance shows Workdays 1-6, 07:00 AM to 04:00 PM with a 10-minute grace period, and my Oct 31 entry is marked Late (11:36 AM in) against those hours. But I could not test a fresh late clock-in: today is Sunday, the page says "Today is not a scheduled workday." and Clock In is disabled. As Account Manager, Staff Records says only 1 employee has no schedule (Roberto Gonzales, the CEO); his Edit form has empty start and end times because the CEO has no role hours (the sheet says that part is deferred). Everyone in the six covered roles already has Mon-Sat hours, so I had no employee with a missing schedule to check the prefill on.

