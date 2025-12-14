import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { to, owner_name, clinic_name } = await req.json();

        // 1. Get Secrets
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        // 2. Get Backend URL (The Python Server handling TwiML)
        let backendUrl = process.env.NEXT_PUBLIC_VOICE_BACKEND_URL;

        if (!backendUrl) {
            console.error("Missing NEXT_PUBLIC_VOICE_BACKEND_URL");
            return NextResponse.json({ error: "Server configuration error: Missing Backend URL" }, { status: 500 });
        }

        // Ensure protocol
        if (!backendUrl.startsWith('http')) {
            backendUrl = `https://${backendUrl}`;
        }

        // Remove trailing slash if present
        if (backendUrl.endsWith('/')) {
            backendUrl = backendUrl.slice(0, -1);
        }

        const twimlUrl = `${backendUrl}/twilio/incoming`;

        if (!accountSid || !authToken || !fromNumber) {
            console.error("Missing Twilio Secrets");
            return NextResponse.json({ error: "Server configuration error: Missing Twilio Credentials" }, { status: 500 });
        }

        console.log(`Initiating call to ${to} from ${fromNumber} using handler ${twimlUrl}`);

        // 3. Call Twilio API via Fetch (avoiding 'twilio' npm dependency to keep build light)
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'To': to,
                'From': fromNumber,
                'Url': twimlUrl,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Twilio API Error:", errorText);
            return NextResponse.json({ error: "Failed to verify number or trigger call." }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({ success: true, sid: data.sid });

    } catch (error: any) {
        console.error("Trigger Call Exception:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
