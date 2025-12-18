import { Metadata } from "next";
import MedSpaPage from "./MedSpaClient";

export const metadata: Metadata = {
    title: "Call Waiting AI – AI Receptionist for Med Spas | CallWaiting AI",
    description: "Book more Botox and filler appointments with Call Waiting AI. Handle weekend rush, upsell memberships, and eliminate missed calls.",
};

export default function Page() {
    return <MedSpaPage />;
}
