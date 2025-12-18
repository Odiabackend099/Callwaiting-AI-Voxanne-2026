import { Metadata } from "next";
import PlasticSurgeryPage from "./PlasticSurgeryClient";

export const metadata: Metadata = {
    title: "CALL WAITING AI LTD – AI Receptionist for Plastic Surgeons | CallWaiting AI",
    description: "Automate your plastic surgery clinic with CALL WAITING AI LTD. Handle BBL & Rhino inquiries, qualify BDD, and book consultations 24/7.",
};

export default function Page() {
    return <PlasticSurgeryPage />;
}
