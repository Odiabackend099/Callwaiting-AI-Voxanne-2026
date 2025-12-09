import { Metadata } from "next";
import DermatologyPage from "./DermatologyClient";

export const metadata: Metadata = {
    title: "AI Receptionist for Dermatologists | CallWaiting AI",
    description: "Automate dermatology triage with Roxanne. Separate medical from cosmetic calls, handle insurance questions, and refill prescriptions.",
};

export default function Page() {
    return <DermatologyPage />;
}
