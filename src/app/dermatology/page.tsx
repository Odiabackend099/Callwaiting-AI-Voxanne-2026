import { Metadata } from "next";
import DermatologyPage from "./DermatologyClient";

export const metadata: Metadata = {
    title: "CALL WAITING AI LTD – AI Receptionist for Dermatologists | CallWaiting AI",
    description: "Automate dermatology triage with CALL WAITING AI LTD. Separate medical from cosmetic calls, handle insurance questions, and refill prescriptions.",
};

export default function Page() {
    return <DermatologyPage />;
}
