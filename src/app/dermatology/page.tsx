import { Metadata } from "next";
import DermatologyPage from "./DermatologyClient";

export const metadata: Metadata = {
    title: "Call Waiting AI – AI Receptionist for Dermatologists | CallWaiting AI",
    description: "Automate dermatology triage with Call Waiting AI. Separate medical from cosmetic calls, handle insurance questions, and refill prescriptions.",
};

export default function Page() {
    return <DermatologyPage />;
}
