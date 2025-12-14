import { Metadata } from "next";
import CosmeticDentistryPage from "./CosmeticDentistryClient";

export const metadata: Metadata = {
    title: "AI Receptionist for Cosmetic Dentists | CallWaiting AI",
    description: "Capture high-value veneer and smile makeover leads with Voxanne. Qualify financing and book consultations 24/7.",
};

export default function Page() {
    return <CosmeticDentistryPage />;
}
