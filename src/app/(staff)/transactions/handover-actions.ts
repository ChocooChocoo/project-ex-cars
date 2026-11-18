"use client";

// Phase 5: vehicle papers custody and the contract call Laravel
// (backend/app/Http/Controllers/Trading/HandoverController.php). Same exports and results as before.

import { apiAction, laravelForm } from "@/lib/api/action";

type HandoverResult = { error: string } | { success: true };

const send = (path: string, formData: FormData, multipart = false) =>
  apiAction(
    `/staff/trading/handover/${path}`,
    multipart ? laravelForm(formData) : Object.fromEntries(formData),
  ) as Promise<HandoverResult>;

export async function requestPapersRelease(formData: FormData): Promise<HandoverResult> {
  return send("request-papers-release", formData);
}

export async function approvePapersRelease(formData: FormData): Promise<HandoverResult> {
  return send("approve-papers-release", formData);
}

export async function receivePapers(formData: FormData): Promise<HandoverResult> {
  return send("receive-papers", formData);
}

export async function releasePapersToCi(formData: FormData): Promise<HandoverResult> {
  return send("release-papers-to-ci", formData);
}

export async function handPapersToBuyer(formData: FormData): Promise<HandoverResult> {
  return send("hand-papers-to-buyer", formData);
}

export async function saveContract(formData: FormData): Promise<HandoverResult> {
  return send("save-contract", formData);
}

export async function reviewContract(formData: FormData): Promise<HandoverResult> {
  return send("review-contract", formData);
}

export async function recordBuyerMet(formData: FormData): Promise<HandoverResult> {
  return send("record-buyer-met", formData);
}

export async function reportSigning(formData: FormData): Promise<HandoverResult> {
  return send("report-signing", formData);
}

export async function recordFaceToFaceSigning(formData: FormData): Promise<HandoverResult> {
  return send("record-face-to-face-signing", formData);
}

export async function recordContractCopy(formData: FormData): Promise<HandoverResult> {
  return send("record-contract-copy", formData);
}

export async function uploadFieldDocument(formData: FormData): Promise<HandoverResult> {
  return send("upload-field-document", formData, true);
}

export async function recordFieldSignatures(formData: FormData): Promise<HandoverResult> {
  return send("record-field-signatures", formData, true);
}
