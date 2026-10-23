-- Google Identity Services accounts link to members by Google subject ID.
ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique
  ON users(google_sub)
  WHERE google_sub IS NOT NULL;
