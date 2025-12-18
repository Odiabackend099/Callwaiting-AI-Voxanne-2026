"""
TestSprite Corrected Tests - Master Test Runner
Runs all 10 corrected tests with proper routes and payloads
"""

import os
import sys
import subprocess
from pathlib import Path

# Test files
TESTS = [
    "TC001_webhook_handling.py",
    "TC002_outbound_calls.py",
    "TC003_call_logs.py",
    "TC004_list_assistants.py",
    "TC005_create_assistant.py",
    "TC006_upload_kb.py",
    "TC007_query_kb.py",
    "TC008_vapi_setup.py",
    "TC009_inbound_config.py",
    "TC010_founder_console_settings.py",
]

def print_header():
    print("\n" + "="*60)
    print("🧪 TestSprite Corrected Tests - Master Runner")
    print("="*60)
    print()

def check_environment():
    """Check if required environment variables are set"""
    print("📋 Checking environment variables...")
    
    required = ["BASE_URL"]
    optional = ["TEST_JWT_TOKEN", "VAPI_API_KEY"]
    
    for var in required:
        if not os.getenv(var):
            print(f"⚠️  Missing required: {var}")
            print(f"   Set: export {var}='value'")
    
    for var in optional:
        if not os.getenv(var):
            print(f"⚠️  Missing optional: {var}")
    
    print()

def run_tests():
    """Run all tests"""
    print("🚀 Running tests...\n")
    
    passed = 0
    failed = 0
    errors = 0
    
    test_dir = Path(__file__).parent
    
    for test_file in TESTS:
        test_path = test_dir / test_file
        
        if not test_path.exists():
            print(f"❌ {test_file} - FILE NOT FOUND")
            errors += 1
            continue
        
        try:
            result = subprocess.run(
                [sys.executable, str(test_path)],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout + result.stderr
            
            if "PASSED" in output:
                print(f"✅ {test_file}")
                passed += 1
            elif "FAILED" in output:
                print(f"❌ {test_file}")
                failed += 1
            else:
                print(f"⚠️  {test_file} - UNKNOWN STATUS")
                errors += 1
                
        except subprocess.TimeoutExpired:
            print(f"⏱️  {test_file} - TIMEOUT")
            errors += 1
        except Exception as e:
            print(f"❌ {test_file} - ERROR: {e}")
            errors += 1
    
    return passed, failed, errors

def print_summary(passed, failed, errors):
    """Print test summary"""
    total = passed + failed + errors
    
    print()
    print("="*60)
    print("📊 Test Summary")
    print("="*60)
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {failed}/{total}")
    print(f"⚠️  Errors: {errors}/{total}")
    print()
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("⚠️  Some tests failed. Check routes and environment variables.")
        return 1

def main():
    print_header()
    check_environment()
    passed, failed, errors = run_tests()
    exit_code = print_summary(passed, failed, errors)
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
