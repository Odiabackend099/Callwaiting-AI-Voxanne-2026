#!/bin/bash

curl -X POST "https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "metadata": {
        "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"
      }
    },
    "message": {
      "toolCall": {
        "function": {
          "name": "bookClinicAppointment",
          "arguments": {
            "appointmentDate": "2026-01-20",
            "appointmentTime": "18:00",
            "patientEmail": "test@example.com",
            "patientName": "Test Patient"
          }
        }
      }
    }
  }' 2>&1
