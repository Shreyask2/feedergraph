-- Optional sender info: github_username set server-side from the OAuth session; contact is free text from the visitor.
ALTER TABLE feedback
  ADD COLUMN github_username TEXT,
  ADD COLUMN contact TEXT CHECK (char_length(contact) <= 120);
