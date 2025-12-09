import { Metadata } from "next";
import PlasticSurgeryPage from "./PlasticSurgeryClient";

export const metadata: Metadata = {
    title: "AI Receptionist for Plastic Surgeons | CallWaiting AI",
    description: "Automate your plastic surgery clinic with Roxanne. Handle BBL & Rhino inquiries, qualify BDD, and book consultations 24/7.",
};

export default function Page() {
    return <PlasticSurgeryPage />;
}
