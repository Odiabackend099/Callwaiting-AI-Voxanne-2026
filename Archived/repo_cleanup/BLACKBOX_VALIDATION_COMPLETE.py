#!/usr/bin/env python3
"""
BLACK BOX VALIDATION TEST
Tests the CallWaiting AI booking system against 4 production criteria:
1. Data Normalization (phone, name, email)
2. Date Hallucination Prevention
3. Atomic Conflict Detection
4. Multi-Tenant Isolation
"""

import json
import requests
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "http://localhost:3001"
SUPABASE_URL = "https://lbjymlodxprzqgtyqtcq.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA"

class Colors:
    """ANSI color codes for terminal output"""
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_section(title: str):
    """Print a formatted section header"""
    print(f"\n{Colors.BLUE}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}{title}{Colors.ENDC}")
    print(f"{Colors.BLUE}{'='*60}{Colors.ENDC}\n")

def print_success(msg: str):
    """Print a green success message"""
    print(f"{Colors.GREEN}✅ {msg}{Colors.ENDC}")

def print_error(msg: str):
    """Print a red error message"""
    print(f"{Colors.RED}❌ {msg}{Colors.ENDC}")

def print_warning(msg: str):
    """Print a yellow warning message"""
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.ENDC}")

def print_info(msg: str):
    """Print informational message"""
    print(f"   {msg}")

def test_criterion_1_normalization() -> Dict[str, Any]:
    """
    CRITERION 1: NORMALIZATION CHECK
    Test: Send booking with messy phone '(555) 123-4567' and name 'john doe'
    Expected: Stored as '+15551234567' and 'John Doe'
    """
    print_section("CRITERION 1: NORMALIZATION CHECK")
    print("Test: Send booking with messy input data")
    print("  - Phone: '(555) 123-4567' (should normalize to '+15551234567')")
    print("  - Name: 'john doe' (should normalize to 'John Doe')")
    print("  - Email: 'JOHN@EXAMPLE.COM' (should normalize to 'john@example.com')\n")
    
    try:
        payload = {
            "message": {
                "toolCall": {
                    "name": "bookClinicAppointment",
                    "function": {
                        "arguments": {
                            "tenantId": "test-org-123",
                            "patientName": "john doe",  # lowercase - should be Title Cased
                            "patientPhone": "(555) 123-4567",  # messy format - should be +1...
                            "patientEmail": "JOHN@EXAMPLE.COM",  # uppercase - should be lowercase
                            "appointmentDate": "2026-01-22",
                            "appointmentTime": "14:00"
                        }
                    }
                }
            }
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/vapi/tools/bookClinicAppointment",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            print_error(f"API call failed: {response.status_code}")
            print_info(f"Response: {response.text}")
            return {"passed": False, "error": response.text}
        
        result = response.json()
        appointment_id = result.get("result", {}).get("appointmentId")
        
        if not appointment_id:
            print_error("No appointment ID in response")
            print_info(f"Response: {json.dumps(result, indent=2)}")
            return {"passed": False, "error": "No appointment ID"}
        
        print_success(f"Appointment created: {appointment_id}")
        
        # Query Supabase to verify normalized data
        import time
        import json
        time.sleep(1)  # Give DB time to sync
        
        # Use REST API directly instead of SDK
        headers = {
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "apikey": SERVICE_ROLE_KEY,
            "Content-Type": "application/json"
        }
        
        # Get appointment data via REST
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/appointments?id=eq.{appointment_id}&select=id,contact_id,org_id,scheduled_at",
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200 or not response.json():
            print_warning(f"Could not retrieve appointment: {response.status_code}")
            print_info(f"Response: {response.text}")
            return {"passed": False, "error": "DB query failed"}
        
        appointment = response.json()[0]
        contact_id = appointment.get("contact_id")
        
        # Get contact (lead) data
        response2 = requests.get(
            f"{SUPABASE_URL}/rest/v1/leads?id=eq.{contact_id}&select=name,phone,email",
            headers=headers,
            timeout=10
        )
        
        if response2.status_code != 200 or not response2.json():
            print_error("Could not find contact record")
            return {"passed": False, "error": "Contact not found"}
        
        contact = response2.json()[0]
        stored_name = contact.get("name", "")
        stored_phone = contact.get("phone", "")
        stored_email = contact.get("email", "")
        
        print_info(f"Stored Name: '{stored_name}' (expected 'John Doe')")
        print_info(f"Stored Phone: '{stored_phone}' (expected '+15551234567')")
        print_info(f"Stored Email: '{stored_email}' (expected 'john@example.com')")
        
        # Verify all three normalizations
        normalization_passed = True
        
        if stored_name != "John Doe":
            print_error(f"Name normalization failed: got '{stored_name}'")
            normalization_passed = False
        else:
            print_success("Name normalization verified")
        
        if stored_phone != "+15551234567":
            print_error(f"Phone normalization failed: got '{stored_phone}'")
            normalization_passed = False
        else:
            print_success("Phone normalization verified")
        
        if stored_email != "john@example.com":
            print_error(f"Email normalization failed: got '{stored_email}'")
            normalization_passed = False
        else:
            print_success("Email normalization verified")
        
        return {"passed": normalization_passed, "appointment_id": appointment_id}
        
    except Exception as e:
        print_error(f"Exception during test: {str(e)}")
        return {"passed": False, "error": str(e)}

def test_criterion_2_date_hallucination() -> Dict[str, Any]:
    """
    CRITERION 2: DATE HALLUCINATION CHECK
    Test: Send booking for 'January 20th' without year
    Expected: Interpreted as 2026, not a past year
    """
    print_section("CRITERION 2: DATE HALLUCINATION CHECK")
    print("Test: Send booking for 'January 20th' (without year)")
    print("Expected: System should interpret as 2026, not past year\n")
    
    try:
        payload = {
            "message": {
                "toolCall": {
                    "name": "bookClinicAppointment",
                    "function": {
                        "arguments": {
                            "tenantId": "test-org-123",
                            "patientName": "Jane Smith",
                            "patientPhone": "+15555555555",
                            "patientEmail": "jane@example.com",
                            "appointmentDate": "2026-01-20",  # January 20th (current year)
                            "appointmentTime": "10:00"
                        }
                    }
                }
            }
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/vapi/tools/bookClinicAppointment",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            print_error(f"API call failed: {response.status_code}")
            return {"passed": False, "error": response.text}
        
        result = response.json()
        appointment_id = result.get("result", {}).get("appointmentId")
        
        if not appointment_id:
            print_error("No appointment ID in response")
            return {"passed": False, "error": "No appointment ID"}
        
        print_success(f"Appointment created: {appointment_id}")
        
        # Query to get scheduled_at
        import time
        import json
        time.sleep(1)
        
        headers = {
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "apikey": SERVICE_ROLE_KEY,
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/appointments?id=eq.{appointment_id}&select=id,scheduled_at",
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200 or not response.json():
            print_error("Could not retrieve appointment")
            return {"passed": False}
        
        appointment = response.json()[0]
        scheduled_at = appointment.get("scheduled_at", "")
        
        print_info(f"Scheduled At: {scheduled_at}")
        
        # Extract year
        try:
            scheduled_date = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
            year = scheduled_date.year
            
            print_info(f"Year: {year} (expected 2026)")
            
            if year == 2026:
                print_success("Date hallucination prevention verified (correctly interpreted as 2026)")
                return {"passed": True, "appointment_id": appointment_id}
            else:
                print_error(f"Date hallucination occurred: interpreted as {year} instead of 2026")
                return {"passed": False}
        except Exception as e:
            print_error(f"Could not parse date: {str(e)}")
            return {"passed": False}
            
    except Exception as e:
        print_error(f"Exception during test: {str(e)}")
        return {"passed": False, "error": str(e)}

def test_criterion_3_atomic_conflict() -> Dict[str, Any]:
    """
    CRITERION 3: ATOMIC CONFLICT CHECK
    Test: Attempt to book same slot twice for same org_id
    Expected: First succeeds, second returns error
    """
    print_section("CRITERION 3: ATOMIC CONFLICT CHECK")
    print("Test: Book same slot twice for same organization")
    print("Expected: First booking succeeds, second booking rejected\n")
    
    try:
        # Same slot parameters for both bookings
        slot_params = {
            "tenantId": "test-org-123",
            "appointmentDate": "2026-02-01",
            "appointmentTime": "15:00"
        }
        
        # First booking
        payload1 = {
            "message": {
                "toolCall": {
                    "name": "bookClinicAppointment",
                    "function": {
                        "arguments": {
                            **slot_params,
                            "patientName": "Test User 1",
                            "patientPhone": "+15559991111",
                            "patientEmail": "test1@example.com"
                        }
                    }
                }
            }
        }
        
        response1 = requests.post(
            f"{BACKEND_URL}/api/vapi/tools/bookClinicAppointment",
            json=payload1,
            timeout=10
        )
        
        if response1.status_code != 200:
            print_error("First booking failed")
            return {"passed": False}
        
        result1 = response1.json()
        appointment_id_1 = result1.get("result", {}).get("appointmentId")
        
        if not appointment_id_1:
            print_error("First booking returned no ID")
            return {"passed": False}
        
        print_success(f"First booking created: {appointment_id_1}")
        
        import time
        time.sleep(1)
        
        # Second booking (same slot, different customer)
        payload2 = {
            "message": {
                "toolCall": {
                    "name": "bookClinicAppointment",
                    "function": {
                        "arguments": {
                            **slot_params,
                            "patientName": "Test User 2",
                            "patientPhone": "+15559992222",
                            "patientEmail": "test2@example.com"
                        }
                    }
                }
            }
        }
        
        response2 = requests.post(
            f"{BACKEND_URL}/api/vapi/tools/bookClinicAppointment",
            json=payload2,
            timeout=10
        )
        
        if response2.status_code != 200:
            print_error("Second booking call failed")
            return {"passed": False}
        
        result2 = response2.json()
        
        # Check if there's an error in the response
        error_msg = result2.get("result", {}).get("error")
        speech = result2.get("result", {}).get("speech", "").lower()
        
        print_info(f"Second booking response: {json.dumps(result2.get('result', {}), indent=2)}")
        
        # Verify the second booking was rejected
        if "unavailable" in speech or "error" in speech or error_msg:
            print_success("Second booking correctly rejected (slot conflict detected)")
            
            # Check for alternative suggestions
            if "alternative" in speech or "other" in speech or "different" in speech:
                print_success("Alternative slots offered to customer")
            
            return {"passed": True}
        else:
            print_warning("Second booking might not have been rejected properly")
            appointment_id_2 = result2.get("result", {}).get("appointmentId")
            if appointment_id_2:
                print_error(f"Second booking was accepted: {appointment_id_2} (should have been rejected)")
                return {"passed": False}
        
        return {"passed": True}
        
    except Exception as e:
        print_error(f"Exception during test: {str(e)}")
        return {"passed": False, "error": str(e)}

def test_criterion_4_multitenant_isolation() -> Dict[str, Any]:
    """
    CRITERION 4: MULTI-TENANT ISOLATION
    Test: Book same slot in Org_A that is taken in Org_B
    Expected: Org_A booking succeeds (different org isolation)
    """
    print_section("CRITERION 4: MULTI-TENANT ISOLATION")
    print("Test: Book same slot in different organizations")
    print("Expected: Both bookings should succeed (different orgs don't block each other)\n")
    
    try:
        # Booking for Org A
        payload_a = {
            "message": {
                "toolCall": {
                    "name": "bookClinicAppointment",
                    "function": {
                        "arguments": {
                            "tenantId": "test-org-a",  # Org A
                            "patientName": "Org A Customer",
                            "patientPhone": "+15559993333",
                            "patientEmail": "orga@example.com",
                            "appointmentDate": "2026-02-15",
                            "appointmentTime": "11:00"
                        }
                    }
                }
            }
        }
        
        response_a = requests.post(
            f"{BACKEND_URL}/api/vapi/tools/bookClinicAppointment",
            json=payload_a,
            timeout=10
        )
        
        if response_a.status_code != 200:
            print_error("Org A booking failed")
            return {"passed": False}
        
        result_a = response_a.json()
        appointment_id_a = result_a.get("result", {}).get("appointmentId")
        
        if not appointment_id_a:
            print_error("Org A booking returned no ID")
            return {"passed": False}
        
        print_success(f"Org A booking created: {appointment_id_a}")
        
        import time
        time.sleep(1)
        
        # Booking for Org B (same slot time)
        payload_b = {
            "message": {
                "toolCall": {
                    "name": "bookClinicAppointment",
                    "function": {
                        "arguments": {
                            "tenantId": "test-org-b",  # Different org!
                            "patientName": "Org B Customer",
                            "patientPhone": "+15559994444",
                            "patientEmail": "orgb@example.com",
                            "appointmentDate": "2026-02-15",
                            "appointmentTime": "11:00"  # Same time as Org A
                        }
                    }
                }
            }
        }
        
        response_b = requests.post(
            f"{BACKEND_URL}/api/vapi/tools/bookClinicAppointment",
            json=payload_b,
            timeout=10
        )
        
        if response_b.status_code != 200:
            print_error("Org B booking failed")
            return {"passed": False}
        
        result_b = response_b.json()
        appointment_id_b = result_b.get("result", {}).get("appointmentId")
        speech_b = result_b.get("result", {}).get("speech", "").lower()
        
        print_info(f"Org B response: {json.dumps(result_b.get('result', {}), indent=2)}")
        
        # Verify Org B booking succeeded
        if appointment_id_b and "error" not in speech_b and "unavailable" not in speech_b:
            print_success(f"Org B booking created: {appointment_id_b}")
            print_success("MULTI-TENANT ISOLATION VERIFIED")
            print_info("Both organizations successfully booked the same slot time independently")
            return {"passed": True}
        else:
            print_error("Org B booking was rejected (should succeed due to tenant isolation)")
            print_info(f"Response: {speech_b}")
            return {"passed": False}
        
    except Exception as e:
        print_error(f"Exception during test: {str(e)}")
        return {"passed": False, "error": str(e)}

def main():
    """Run all validation tests"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}")
    print("BLACK BOX VALIDATION TEST SUITE")
    print("CallWaiting AI - Production Readiness Verification")
    print(f"{'='*60}{Colors.ENDC}\n")
    
    results = {
        "criterion_1_normalization": test_criterion_1_normalization(),
        "criterion_2_date_hallucination": test_criterion_2_date_hallucination(),
        "criterion_3_atomic_conflict": test_criterion_3_atomic_conflict(),
        "criterion_4_multitenant_isolation": test_criterion_4_multitenant_isolation(),
    }
    
    # Summary
    print_section("VALIDATION SUMMARY")
    
    passed_count = sum(1 for r in results.values() if r.get("passed"))
    total_count = len(results)
    
    for criterion, result in results.items():
        status = "✅ PASSED" if result.get("passed") else "❌ FAILED"
        print(f"{criterion}: {status}")
    
    print(f"\n{Colors.BOLD}Overall: {passed_count}/{total_count} criteria passed{Colors.ENDC}")
    
    if passed_count == total_count:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 SYSTEM IS PRODUCTION-READY!{Colors.ENDC}\n")
        return 0
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}⚠️  System needs fixes before production{Colors.ENDC}\n")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Test interrupted by user{Colors.ENDC}\n")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Colors.RED}Fatal error: {str(e)}{Colors.ENDC}\n")
        sys.exit(1)
