-- +goose Up
ALTER TABLE org_credentials 
ADD COLUMN last_verified_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE org_credentials 
DROP COLUMN last_verified_at;
