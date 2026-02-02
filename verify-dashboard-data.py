#!/usr/bin/env python3
"""
Dashboard Data Verification Script

Comprehensive check of all dashboard data quality using direct PostgreSQL connection
"""

import psycopg2
from datetime import datetime, timedelta
import json
import sys

# Database connection string
DATABASE_URL = "postgresql://postgres:Eguale%402021%3F@db.lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres"

results = []

def log_result(check, status, message, details=None):
    """Log a verification result"""
    results.append({
        'check': check,
        'status': status,
        'message': message,
        'details': details
    })
    emoji = '✅' if status == 'PASS' else '❌' if status == 'FAIL' else '⚠️ '
    print(f"{emoji} {status}: {check} - {message}")
    if details:
        print(f"   Details: {json.dumps(details, indent=2)}")

def check_database_connectivity(conn):
    """Check if database connection works"""
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        log_result('Database Connectivity', 'PASS', 'Successfully connected to Supabase')
        cursor.close()
    except Exception as e:
        log_result('Database Connectivity', 'FAIL', f'Cannot connect to database: {str(e)}')

def check_caller_names(conn):
    """Check caller name enrichment"""
    try:
        cursor = conn.cursor()
        seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()

        cursor.execute("""
            SELECT
                COUNT(*) as total_calls,
                COUNT(CASE WHEN caller_name IS NOT NULL AND caller_name != 'Unknown Caller' THEN 1 END) as calls_with_names,
                COUNT(CASE WHEN caller_name = 'Unknown Caller' OR caller_name IS NULL THEN 1 END) as unknown_callers
            FROM calls
            WHERE created_at > %s
        """, (seven_days_ago,))

        result = cursor.fetchone()
        total_calls = result[0]
        calls_with_names = result[1]
        unknown_callers = result[2]

        details = {
            'total_calls': total_calls,
            'calls_with_names': calls_with_names,
            'unknown_callers': unknown_callers
        }

        if total_calls == 0:
            log_result('Caller Names', 'WARN', 'No calls in the last 7 days', details)
        elif calls_with_names == 0:
            log_result('Caller Names', 'FAIL', 'ALL calls are "Unknown Caller" - enrichment broken', details)
        elif calls_with_names / total_calls < 0.5:
            log_result('Caller Names', 'WARN', f'Low enrichment rate: {round(calls_with_names / total_calls * 100)}%', details)
        else:
            log_result('Caller Names', 'PASS', f'{calls_with_names}/{total_calls} calls have enriched names', details)

        cursor.close()
    except Exception as e:
        log_result('Caller Names', 'FAIL', f'Database query failed: {str(e)}')

def check_contact_names(conn):
    """Check contact name enrichment"""
    try:
        cursor = conn.cursor()
        seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()

        cursor.execute("""
            SELECT
                COUNT(*) as total_contacts,
                COUNT(CASE WHEN name IS NOT NULL AND name != 'Unknown Caller' THEN 1 END) as contacts_with_names
            FROM contacts
            WHERE created_at > %s
        """, (seven_days_ago,))

        result = cursor.fetchone()
        total_contacts = result[0]
        contacts_with_names = result[1]

        details = {
            'total_contacts': total_contacts,
            'contacts_with_names': contacts_with_names
        }

        if total_contacts == 0:
            log_result('Contact Names', 'WARN', 'No contacts in the last 7 days', details)
        elif contacts_with_names == 0:
            log_result('Contact Names', 'FAIL', 'ALL contacts have no names', details)
        else:
            log_result('Contact Names', 'PASS', f'{contacts_with_names}/{total_contacts} contacts have names', details)

        cursor.close()
    except Exception as e:
        log_result('Contact Names', 'FAIL', f'Database query failed: {str(e)}')

def check_sentiment_data(conn):
    """Check sentiment analysis data"""
    try:
        cursor = conn.cursor()
        seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()

        cursor.execute("""
            SELECT
                COUNT(*) as total_calls,
                COUNT(sentiment_label) as calls_with_sentiment_label,
                COUNT(sentiment_score) as calls_with_sentiment_score,
                AVG(sentiment_score) as avg_sentiment_score
            FROM calls
            WHERE created_at > %s
        """, (seven_days_ago,))

        result = cursor.fetchone()
        total_calls = result[0]
        calls_with_sentiment_label = result[1]
        calls_with_sentiment_score = result[2]
        avg_sentiment_score = result[3] or 0

        details = {
            'total_calls': total_calls,
            'calls_with_sentiment_label': calls_with_sentiment_label,
            'calls_with_sentiment_score': calls_with_sentiment_score,
            'avg_sentiment_score': f'{avg_sentiment_score:.2f}'
        }

        if total_calls == 0:
            log_result('Sentiment Data', 'WARN', 'No calls in the last 7 days', details)
        elif avg_sentiment_score == 0 and total_calls > 0:
            log_result('Sentiment Data', 'FAIL', 'Average sentiment is 0% - sentiment analysis BROKEN', details)
        elif calls_with_sentiment_score == 0:
            log_result('Sentiment Data', 'FAIL', 'No calls have sentiment scores', details)
        else:
            log_result('Sentiment Data', 'PASS', f'Avg sentiment: {avg_sentiment_score * 100:.1f}%, {calls_with_sentiment_score}/{total_calls} calls scored', details)

        cursor.close()
    except Exception as e:
        log_result('Sentiment Data', 'FAIL', f'Database query failed: {str(e)}')

def check_hot_lead_alerts(conn):
    """Check hot lead alerts"""
    try:
        cursor = conn.cursor()
        seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()

        cursor.execute("""
            SELECT
                COUNT(*) as total_alerts,
                COUNT(CASE WHEN lead_score >= 60 THEN 1 END) as alerts_above_threshold
            FROM hot_lead_alerts
            WHERE created_at > %s
        """, (seven_days_ago,))

        result = cursor.fetchone()
        total_alerts = result[0]
        alerts_above_threshold = result[1]

        details = {
            'total_alerts': total_alerts,
            'alerts_above_threshold': alerts_above_threshold
        }

        if total_alerts == 0:
            log_result('Hot Lead Alerts', 'WARN', 'No hot lead alerts in the last 7 days', details)
        else:
            log_result('Hot Lead Alerts', 'PASS', f'{total_alerts} alerts found ({alerts_above_threshold} above threshold)', details)

        cursor.close()
    except Exception as e:
        log_result('Hot Lead Alerts', 'FAIL', f'Database query failed: {str(e)}')

def check_phone_numbers(conn):
    """Check phone number formatting"""
    try:
        cursor = conn.cursor()
        seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()

        cursor.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN phone_number LIKE '+%%' THEN 1 END) as e164_format
            FROM calls
            WHERE created_at > %s
        """, (seven_days_ago,))

        result = cursor.fetchone()
        total = result[0]
        e164_format = result[1]

        details = {
            'total': total,
            'e164_format': e164_format
        }

        if total == 0:
            log_result('Phone Numbers', 'WARN', 'No calls in the last 7 days', details)
        elif e164_format != total:
            log_result('Phone Numbers', 'FAIL', f'{total - e164_format}/{total} phone numbers NOT in E.164 format', details)
        else:
            log_result('Phone Numbers', 'PASS', f'All {total} phone numbers in E.164 format', details)

        cursor.close()
    except Exception as e:
        log_result('Phone Numbers', 'FAIL', f'Database query failed: {str(e)}')

def check_sample_data(conn):
    """Check sample recent calls"""
    try:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                id,
                caller_name,
                phone_number,
                sentiment_label,
                sentiment_score,
                call_direction,
                status,
                created_at
            FROM calls
            ORDER BY created_at DESC
            LIMIT 5
        """)

        rows = cursor.fetchall()

        if not rows:
            log_result('Sample Data', 'WARN', 'No calls found in database', {})
        else:
            sample_data = []
            for row in rows:
                sample_data.append({
                    'id': row[0],
                    'caller_name': row[1],
                    'phone_number': row[2],
                    'sentiment_label': row[3],
                    'sentiment_score': row[4],
                    'call_direction': row[5],
                    'status': row[6],
                    'created_at': str(row[7])
                })
            log_result('Sample Data', 'PASS', f'Retrieved {len(sample_data)} recent calls', sample_data)

        cursor.close()
    except Exception as e:
        log_result('Sample Data', 'FAIL', f'Database query failed: {str(e)}')

def check_total_call_volume(conn):
    """Check total call volume"""
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM calls")
        count = cursor.fetchone()[0]
        log_result('Total Call Volume', 'PASS', f'Total calls in database: {count}', {'count': count})
        cursor.close()
    except Exception as e:
        log_result('Total Call Volume', 'FAIL', f'Cannot count calls: {str(e)}')

def check_recent_call_activity(conn):
    """Check recent call activity"""
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT created_at FROM calls ORDER BY created_at DESC LIMIT 1")
        result = cursor.fetchone()

        if not result:
            log_result('Recent Call Activity', 'WARN', 'No calls found in database', {})
        else:
            latest_call = result[0]
            hours_since_last_call = (datetime.now() - latest_call).total_seconds() / 3600

            details = {'latest_call': str(latest_call)}

            if hours_since_last_call > 24:
                log_result('Recent Call Activity', 'WARN', f'Last call was {round(hours_since_last_call)} hours ago', details)
            else:
                log_result('Recent Call Activity', 'PASS', f'Last call was {round(hours_since_last_call)} hours ago', details)

        cursor.close()
    except Exception as e:
        log_result('Recent Call Activity', 'FAIL', f'Cannot query recent calls: {str(e)}')

def main():
    """Main execution"""
    print('=' * 40)
    print('DASHBOARD DATA VERIFICATION')
    print('=' * 40)
    print()
    print('Starting comprehensive verification...')
    print()

    try:
        # Connect to database
        conn = psycopg2.connect(DATABASE_URL)

        # Run all checks
        check_database_connectivity(conn)
        check_total_call_volume(conn)
        check_recent_call_activity(conn)
        check_caller_names(conn)
        check_contact_names(conn)
        check_sentiment_data(conn)
        check_hot_lead_alerts(conn)
        check_phone_numbers(conn)
        check_sample_data(conn)

        # Close connection
        conn.close()

    except Exception as e:
        print(f"❌ FATAL ERROR: Failed to connect to database: {str(e)}")
        sys.exit(1)

    # Summary
    print()
    print('=' * 40)
    print('VERIFICATION SUMMARY')
    print('=' * 40)
    print()

    passed = len([r for r in results if r['status'] == 'PASS'])
    failed = len([r for r in results if r['status'] == 'FAIL'])
    warnings = len([r for r in results if r['status'] == 'WARN'])

    print(f"✅ Passed: {passed}/{len(results)} checks")
    print(f"❌ Failed: {failed}/{len(results)} checks")
    print(f"⚠️  Warnings: {warnings}/{len(results)} checks")
    print()

    if failed > 0:
        print('CRITICAL ISSUES:')
        for r in results:
            if r['status'] == 'FAIL':
                print(f"  ❌ {r['check']}: {r['message']}")
        print()

    if warnings > 0:
        print('WARNINGS:')
        for r in results:
            if r['status'] == 'WARN':
                print(f"  ⚠️  {r['check']}: {r['message']}")
        print()

    # Sample data display
    sample_result = next((r for r in results if r['check'] == 'Sample Data'), None)
    if sample_result and sample_result['details'] and isinstance(sample_result['details'], list):
        print('\nSAMPLE DATA (5 most recent calls):')
        print('=' * 40)
        for idx, call in enumerate(sample_result['details'], 1):
            print(f"\nCall {idx}:")
            print(f"  ID: {call.get('id', 'N/A')}")
            print(f"  Caller: {call.get('caller_name', 'N/A')}")
            print(f"  Phone: {call.get('phone_number', 'N/A')}")
            print(f"  Sentiment: {call.get('sentiment_label', 'N/A')} ({call.get('sentiment_score', 0)})")
            print(f"  Direction: {call.get('call_direction', 'N/A')}")
            print(f"  Status: {call.get('status', 'N/A')}")
            print(f"  Created: {call.get('created_at', 'N/A')}")

    print()
    print('=' * 40)
    print('VERIFICATION COMPLETE')
    print('=' * 40)
    print()

    # Exit with appropriate code
    sys.exit(1 if failed > 0 else 0)

if __name__ == '__main__':
    main()
