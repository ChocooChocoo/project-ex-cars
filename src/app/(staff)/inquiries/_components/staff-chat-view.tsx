"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  acceptHandoff,
  assignInquiry,
  handoffInquiry,
  markMessagesRead,
  scheduleArrangement,
  sendMessageWithAttachment,
} from "@/app/(customer)/my-inquiries/actions";
import { InquiryConversation } from "@/components/inquiries/inquiry-conversation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StaffChatViewProps {
  readonly inquiry: Record<string, unknown>;
  readonly messages: Record<string, unknown>[];
  readonly arrangement: Record<string, unknown> | null;
  readonly userRole: string;
  readonly fillHeight?: boolean;
  readonly onBack?: () => void;
}

function getActionError(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  if ("error" in result && typeof result.error === "string") return result.error;
  if ("ok" in result && result.ok === false && "message" in result && typeof result.message === "string") {
    return result.message;
  }
  return null;
}

export function StaffChatView({
  inquiry,
  messages,
  arrangement: initialArrangement,
  userRole,
  fillHeight = false,
  onBack,
}: StaffChatViewProps) {
  const router = useRouter();
  const [arrangement, setArrangement] = useState(initialArrangement);
  const [assigning, setAssigning] = useState(false);
  const [showArrangement, setShowArrangement] = useState(false);
  const [arrangementKind, setArrangementKind] = useState("gce_visit");
  const [arrangementSchedule, setArrangementSchedule] = useState("");
  const [arrangementLocation, setArrangementLocation] = useState("");

  const inquiryId = inquiry.id as string;
  const intention = inquiry.intention_kind as string;
  const state = inquiry.state as string;
  const handoffState = (inquiry.handoff_state as string | null | undefined) ?? "none";
  const hasManager =
    (inquiry.assigned_account_manager as string | null | undefined) ||
    (inquiry.assigned_sales_manager as string | null | undefined);
  const canRequestHandoff = ["ceo", "account_manager"].includes(userRole);
  const canAcceptHandoff = ["ceo", "sales_manager"].includes(userRole);

  async function handleAssign() {
    if (assigning) return;
    setAssigning(true);
    const role = intention === "buy_now" ? "sales_manager" : "account_manager";
    const result = await assignInquiry(inquiryId, role);
    setAssigning(false);
    const error = getActionError(result);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Inquiry assigned to you.");
    router.refresh();
  }

  async function handleHandoff() {
    const result = await handoffInquiry(inquiryId);
    const error = getActionError(result);
    if (error) toast.error(error);
    else toast.success("Handoff requested.");
    if (!error) router.refresh();
  }

  async function handleAcceptHandoff() {
    const result = await acceptHandoff(inquiryId);
    const error = getActionError(result);
    if (error) toast.error(error);
    else toast.success("Handoff accepted.");
    if (!error) router.refresh();
  }

  async function handleSchedule() {
    const fd = new FormData();
    fd.set("inquiry_id", inquiryId);
    fd.set("arrangement_kind", arrangementKind);
    fd.set("schedule", arrangementSchedule);
    fd.set("location", arrangementLocation);
    const result = await scheduleArrangement(fd);
    const error = getActionError(result);
    if (error) {
      toast.error(error);
      return;
    }

    if ("location" in result && typeof result.location === "string") {
      setArrangement({
        arrangement_kind: arrangementKind,
        schedule: arrangementSchedule,
        location: result.location,
      });
    } else {
      setArrangement({
        arrangement_kind: arrangementKind,
        schedule: arrangementSchedule,
        location: arrangementLocation,
      });
    }
    setShowArrangement(false);
    toast.success("Arrangement scheduled.");
    router.refresh();
  }

  const headerActions = (
    <>
      {!hasManager && (
        <Button size="sm" onClick={handleAssign} disabled={assigning} type="button">
          {assigning ? "Assigning..." : "Assign to Me"}
        </Button>
      )}
      {state === "scheduled" && handoffState === "none" && canRequestHandoff && (
        <Button size="sm" variant="outline" onClick={handleHandoff} type="button">
          Request Handoff
        </Button>
      )}
      {handoffState === "pending_handoff" && canAcceptHandoff && (
        <Button size="sm" variant="outline" onClick={handleAcceptHandoff} type="button">
          Accept Handoff
        </Button>
      )}
      {handoffState === "handed_off" && (
        <Badge variant="secondary" className="text-xs">
          Handed off to Sales Manager
        </Badge>
      )}
      {hasManager && !arrangement && (
        <Button size="sm" variant="outline" onClick={() => setShowArrangement((visible) => !visible)} type="button">
          Schedule
        </Button>
      )}
    </>
  );

  const arrangementForm = showArrangement ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">New Arrangement</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FieldGroup className="gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select value={arrangementKind} onValueChange={setArrangementKind}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="gce_visit">GCE Visit</SelectItem>
                    <SelectItem value="meetup">CALABARZON Meet-Up</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Schedule</FieldLabel>
              <Input
                type="datetime-local"
                value={arrangementSchedule}
                onChange={(event) => setArrangementSchedule(event.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Location</FieldLabel>
            <Input
              value={arrangementLocation}
              onChange={(event) => setArrangementLocation(event.target.value)}
              placeholder="GCE Office, CALABARZON"
            />
          </Field>
        </FieldGroup>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSchedule} disabled={!arrangementSchedule} type="button">
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowArrangement(false)} type="button">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  ) : null;

  return (
    <InquiryConversation
      inquiry={inquiry}
      messages={messages}
      arrangement={arrangement}
      perspective="staff"
      sendMessage={sendMessageWithAttachment}
      markMessagesRead={markMessagesRead}
      headerActions={headerActions}
      beforeMessages={arrangementForm}
      fillHeight={fillHeight}
      onBack={onBack}
    />
  );
}
