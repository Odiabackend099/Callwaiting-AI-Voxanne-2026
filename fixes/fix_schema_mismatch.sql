-- 1. Force PostgREST schema cache reload
NOTIFY pgrst,
'reload schema';
-- 2. Create the RPC function with params matching backend/src/routes/contacts.ts
-- Needs: p_org_id, p_limit, p_offset, p_lead_status, p_search
-- Returns: contacts cols + total_count
CREATE OR REPLACE FUNCTION get_contacts_paged(
        p_org_id UUID,
        p_limit INT DEFAULT 20,
        p_offset INT DEFAULT 0,
        p_lead_status TEXT DEFAULT NULL,
        p_search TEXT DEFAULT NULL
    ) RETURNS TABLE (
        id UUID,
        name TEXT,
        phone TEXT,
        email TEXT,
        last_contacted_at TIMESTAMPTZ,
        booking_source TEXT,
        notes TEXT,
        total_count BIGINT
    ) LANGUAGE plpgsql STABLE AS $$ BEGIN RETURN QUERY WITH filtered_contacts AS (
        SELECT c.id,
            c.name,
            c.phone,
            c.email,
            c.last_contacted_at,
            c.booking_source,
            c.notes
        FROM contacts c
        WHERE c.org_id = p_org_id
            AND (
                p_lead_status IS NULL
                OR c.lead_status = p_lead_status
            )
            AND (
                p_search IS NULL
                OR c.name ILIKE '%' || p_search || '%'
                OR c.phone ILIKE '%' || p_search || '%'
                OR c.email ILIKE '%' || p_search || '%'
            )
    )
SELECT f.id,
    f.name,
    f.phone,
    f.email,
    f.last_contacted_at,
    f.booking_source,
    f.notes,
    (
        SELECT COUNT(*)
        FROM filtered_contacts
    )::BIGINT as total_count
FROM filtered_contacts f
ORDER BY f.last_contacted_at DESC NULLS LAST
LIMIT p_limit OFFSET p_offset;
END;
$$;
-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION get_contacts_paged(UUID, INT, INT, TEXT, TEXT) TO authenticated;