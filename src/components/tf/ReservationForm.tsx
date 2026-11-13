import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type ResForm = {
  customer_name: string; customer_phone: string; customer_email: string; party_size: number;
  booking_date: string; arrival_time: string; eta: string; seating_preference: string;
  dietary_notes: string; special_requests: string; deposit_paid: boolean;
};

export const SEATING = ["No preference", "Window", "Booth", "Patio", "Bar", "Quiet corner"];

export function emptyRes(date: string): ResForm {
  return { customer_name: "", customer_phone: "", customer_email: "", party_size: 2, booking_date: date, arrival_time: "19:00", eta: "", seating_preference: "No preference", dietary_notes: "", special_requests: "", deposit_paid: false };
}

/** Converts the form to a DB payload. ETA is a time on the booking date. */
export function toPayload(f: ResForm) {
  return {
    customer_name: f.customer_name.trim(), customer_phone: f.customer_phone || null, customer_email: f.customer_email || null,
    party_size: f.party_size, booking_date: f.booking_date, arrival_time: f.arrival_time,
    eta_time: f.eta ? new Date(`${f.booking_date}T${f.eta}`).toISOString() : null,
    seating_preference: f.seating_preference, dietary_notes: f.dietary_notes || null, special_requests: f.special_requests || null,
    deposit_paid: f.deposit_paid,
  };
}

export function ReservationFields({ value, onChange }: { value: ResForm; onChange: (f: ResForm) => void }) {
  const [f, setF] = [value, onChange];
  const set = <K extends keyof ResForm>(k: K, v: ResForm[K]) => setF({ ...f, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Fld label="Customer name" className="sm:col-span-2"><Input required value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></Fld>
      <Fld label="Phone"><Input type="tel" value={f.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} /></Fld>
      <Fld label="Email"><Input type="email" value={f.customer_email} onChange={(e) => set("customer_email", e.target.value)} /></Fld>
      <Fld label="Guests"><Input type="number" min={1} max={30} value={f.party_size} onChange={(e) => set("party_size", Math.max(1, Math.min(30, Number(e.target.value) || 1)))} /></Fld>
      <Fld label="Date"><Input type="date" required value={f.booking_date} onChange={(e) => set("booking_date", e.target.value)} /></Fld>
      <Fld label="Arrival time"><Input type="time" required value={f.arrival_time} onChange={(e) => set("arrival_time", e.target.value)} /></Fld>
      <Fld label="Estimated arrival (ETA)"><Input type="time" value={f.eta} onChange={(e) => set("eta", e.target.value)} /></Fld>
      <Fld label="Seating preference" className="sm:col-span-2">
        <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.seating_preference} onChange={(e) => set("seating_preference", e.target.value)}>
          {SEATING.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Fld>
      <Fld label="Dietary requirements" className="sm:col-span-2"><Input value={f.dietary_notes} onChange={(e) => set("dietary_notes", e.target.value)} placeholder="e.g. Nut allergy, 2× vegetarian" /></Fld>
      <Fld label="Special requests" className="sm:col-span-2"><Textarea value={f.special_requests} onChange={(e) => set("special_requests", e.target.value)} /></Fld>
      <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
        <div><div className="text-sm font-medium">Deposit paid</div><div className="text-xs text-muted-foreground">Mark when the booking deposit has been received</div></div>
        <Switch checked={f.deposit_paid} onCheckedChange={(v) => set("deposit_paid", v)} />
      </div>
    </div>
  );
}

function Fld({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className}`}><Label>{label}</Label>{children}</div>;
}

export function useResForm(init: ResForm) {
  return useState<ResForm>(init);
}
