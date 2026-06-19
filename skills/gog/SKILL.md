---
name: gog
description: "Google Workspace CLI (gog) for Gmail, Calendar, Drive, Contacts, Sheets, Docs, Chat, Classroom, Maps, YouTube, Meet, Tasks, Forms, Photos, Admin, People, Groups, Sites, Slides, Keep, Analytics, AppScript, Zoom, and more. Full reference: gogcli.sh"
homepage: https://gogcli.sh
metadata:
  {
    "openclaw":
      {
        "emoji": "🎮",
        "requires": { "bins": ["gog"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "steipete/tap/gogcli",
              "bins": ["gog"],
              "label": "Install gog (brew)",
            },
          ],
      },
  }
---

# gog

Use `gog` for Google Workspace operations. Requires OAuth setup.

> **⚠️ This skill documents a subset of gog CLI.** gog evolves rapidly (679+ generated command pages).
> Always run `gog --help` or `gog <command> --help` for the authoritative, up-to-date command surface.
> The full command reference is at <https://gogcli.sh>.

## Setup (once)

- `gog auth credentials /path/to/client_secret.json`
- `gog auth add you@gmail.com --services gmail,calendar,drive,contacts,docs,sheets`
- `gog auth list`

When adding auth, you can request any subset of gog-supported services:
`gmail, calendar, drive, contacts, docs, sheets, chat, classroom, maps, youtube, meet, tasks, forms, photos, admin, people, groups, sites, slides, keep, analytics, appscript, zoom, searchconsole`

## Available Services

| Service        | Command                  | Notes                                                              |
| -------------- | ------------------------ | ------------------------------------------------------------------ |
| Gmail          | `gog gmail`              | Search, send, drafts, messages, labels, filters, threads           |
| Calendar       | `gog calendar`           | Events, calendars, colors, subscribe, move, out-of-office          |
| Drive          | `gog drive`              | Search, download, upload, ls, raw API access                       |
| Contacts       | `gog contacts`           | List and manage contacts                                           |
| Sheets         | `gog sheets`             | Get, update, append, clear, metadata                               |
| Docs           | `gog docs`               | Export, cat, copy                                                  |
| Chat           | `gog chat`               | Spaces, messages, threads, direct messages                         |
| Classroom      | `gog classroom`          | Courses, roster, coursework, materials, submissions, announcements |
| Maps           | `gog maps`               | Places search and details                                          |
| YouTube        | `gog youtube`            | Search, activities, videos, playlists, comments, channels          |
| Meet           | `gog meet`               | Conference records, spaces                                         |
| Tasks          | `gog tasks`              | Task lists and task CRUD                                           |
| Forms          | `gog forms`              | Form and response management                                       |
| Photos         | `gog photos`             | Photos Library and Picker APIs                                     |
| Admin          | `gog admin`              | Workspace Admin Directory API (domain-wide delegation)             |
| People         | `gog people`             | Directory people, contacts, profiles                               |
| Groups         | `gog groups`             | Cloud Identity Groups (Workspace only)                             |
| Sites          | `gog sites`              | Google Sites (Drive-backed)                                        |
| Slides         | `gog slides`             | Google Slides                                                      |
| Keep           | `gog keep`               | Google Keep notes (Workspace only)                                 |
| Analytics      | `gog analytics`          | Google Analytics                                                   |
| AppScript      | `gog appscript`          | Google Apps Script                                                 |
| Zoom           | `gog zoom`               | Zoom meeting integration, OAuth setup                              |
| Search Console | `gog searchconsole`      | Google Search Console                                              |
| MCP Server     | `gog mcp`                | Typed, allowlisted MCP server over stdio (read-only by default)    |
| Backup         | `gog backup`             | Encrypted Google account backups                                   |
| Batch          | `gog batch`              | Persisted Google Docs request batches                              |
| Auth/Config    | `gog auth`, `gog config` | Credential and configuration management                            |

## Common Commands (Core Services)

### Gmail

- Search: `gog gmail search 'newer_than:7d' --max 10`
- Messages search (per email, ignores threading): `gog gmail messages search "in:inbox from:ryanair.com" --max 20 --account you@example.com`
- Send (plain): `gog gmail send --to a@b.com --subject "Hi" --body "Hello"`
- Send (multi-line): `gog gmail send --to a@b.com --subject "Hi" --body-file ./message.txt`
- Send (stdin): `gog gmail send --to a@b.com --subject "Hi" --body-file -`
- Send (HTML): `gog gmail send --to a@b.com --subject "Hi" --body-html "<p>Hello</p>"`
- Draft: `gog gmail drafts create --to a@b.com --subject "Hi" --body-file ./message.txt`
- Send draft: `gog gmail drafts send <draftId>`
- Reply: `gog gmail send --to a@b.com --subject "Re: Hi" --body "Reply" --reply-to-message-id <msgId>`
- Filters export: `gog gmail filters export`
- Auto-forward: `gog gmail autoforward`
- Send-as aliases: `gog gmail sendas`
- Delegates: `gog gmail delegates`

### Calendar

- List events: `gog calendar events <calendarId> --from <iso> --to <iso>`
- Create event: `gog calendar create <calendarId> --summary "Title" --from <iso> --to <iso>`
- Create with color: `gog calendar create <calendarId> --summary "Title" --from <iso> --to <iso> --event-color 7`
- Update event: `gog calendar update <calendarId> <eventId> --summary "New Title" --event-color 4`
- Show colors: `gog calendar colors`
- Create calendar: `gog calendar create-calendar --summary "Team Calendar"`
- Delete calendar: `gog calendar delete-calendar <calendarId>`
- Subscribe: `gog calendar subscribe <calendarId>`
- Unsubscribe: `gog calendar unsubscribe <calendarId>`
- Move event: `gog calendar move <calendarId> <eventId> <destCalendarId>`
- Focus time: `gog calendar focus-time`
- Out of office: `gog calendar out-of-office`
- Working location: `gog calendar working-location`
- Propose time: `gog calendar propose-time`
- Team calendars: `gog calendar team`

### Drive

- Search: `gog drive search "query" --max 10`
- Download: `gog drive download <fileId> --out /path/to/file`
- Upload: `gog drive upload /path/to/file`
- List: `gog drive ls`
- Raw API: `gog drive raw <method> <path> [--body <json>]`

### Contacts

- List: `gog contacts list --max 20`

### Sheets

- Get: `gog sheets get <sheetId> "Tab!A1:D10" --json`
- Update: `gog sheets update <sheetId> "Tab!A1:B2" --values-json '[["A","B"],["1","2"]]' --input USER_ENTERED`
- Append: `gog sheets append <sheetId> "Tab!A:C" --values-json '[["x","y","z"]]' --insert INSERT_ROWS`
- Clear: `gog sheets clear <sheetId> "Tab!A2:Z"`
- Metadata: `gog sheets metadata <sheetId> --json`

### Docs

- Export: `gog docs export <docId> --format txt --out /tmp/doc.txt`
- Cat: `gog docs cat <docId>`

### Chat

- List spaces: `gog chat spaces --max 20`
- List messages: `gog chat messages <spaceId> --max 20`
- Create message: `gog chat messages create <spaceId> --body "Hello"`
- Direct messages: `gog chat direct <userId> --body "Hello"`

### Classroom

- List courses: `gog classroom courses --max 20`
- Roster: `gog classroom roster <courseId>`
- Coursework: `gog classroom coursework <courseId>`
- Materials: `gog classroom materials <courseId>`
- Submissions: `gog classroom submissions <courseId> <courseWorkId>`
- Announcements: `gog classroom announcements <courseId>`
- Topics: `gog classroom topics <courseId>`
- Invitations: `gog classroom invitations (create|accept|delete)`
- Guardians: `gog classroom guardians`
- Profiles: `gog classroom profiles`

### Maps

- Places search: `gog maps places "coffee shops near me" --max 10`
- Place details: `gog maps place-details <placeId>`

### YouTube

- Search: `gog youtube search "keyword" --max 10`
- Channel data: `gog youtube channels <channelId>`
- Videos: `gog youtube videos <videoId>`
- Playlists: `gog youtube playlists <channelId>`
- Comments: `gog youtube comments <videoId>`

### Meet

- Conference records: `gog meet conference-records`
- Spaces: `gog meet spaces`

### Tasks

- List task lists: `gog tasks tasklists`
- List tasks: `gog tasks tasks <tasklistId>`

### Zoom

- Auth setup: `gog zoom auth setup`
- Meeting management: `gog zoom meetings`

## Calendar Colors

- Use `gog calendar colors` to see all available event colors (IDs 1-11)
- Add colors to events with `--event-color <id>` flag
- Event color IDs (from `gog calendar colors` output):
  - 1: #a4bdfc
  - 2: #7ae7bf
  - 3: #dbadff
  - 4: #ff887c
  - 5: #fbd75b
  - 6: #ffb878
  - 7: #46d6db
  - 8: #e1e1e1
  - 9: #5484ed
  - 10: #51b749
  - 11: #dc2127

## Email Formatting

- Prefer plain text. Use `--body-file` for multi-paragraph messages (or `--body-file -` for stdin).
- Same `--body-file` pattern works for drafts and replies.
- `--body` does not unescape `\n`. If you need inline newlines, use a heredoc or `$'Line 1\n\nLine 2'`.
- Use `--body-html` only when you need rich formatting.
- HTML tags: `<p>` for paragraphs, `<br>` for line breaks, `<strong>` for bold, `<em>` for italic, `<a href="url">` for links, `<ul>`/`<li>` for lists.
- Example (plain text via stdin):

  ```bash
  gog gmail send --to recipient@example.com \
    --subject "Meeting Follow-up" \
    --body-file - <<'EOF'
  Hi Name,

  Thanks for meeting today. Next steps:
  - Item one
  - Item two

  Best regards,
  Your Name
  EOF
  ```

- Example (HTML list):
  ```bash
  gog gmail send --to recipient@example.com \
    --subject "Meeting Follow-up" \
    --body-html "<p>Hi Name,</p><p>Thanks for meeting today. Here are the next steps:</p><ul><li>Item one</li><li>Item two</li></ul><p>Best regards,<br>Your Name</p>"
  ```

## Getting Help

gog's command surface evolves rapidly and the full reference lives at <https://gogcli.sh>. When the skill does not document a command you need:

```bash
gog --help                    # Top-level command list
gog <command> --help          # Per-command flags and subcommands
gog schema                    # Machine-readable JSON schema of all commands/flags
```

## Notes

- Set `GOG_ACCOUNT=you@gmail.com` to avoid repeating `--account`.
- For scripting, prefer `--json` plus `--no-input`.
- Sheets values can be passed via `--values-json` (recommended) or as inline rows.
- Docs supports export/cat/copy. In-place edits require a Docs API client (not in gog).
- Confirm before sending mail or creating events.
- `gog gmail search` returns one row per thread; use `gog gmail messages search` when you need every individual email returned separately.
- Full rendered docs: <https://gogcli.sh>
- Generated command reference: <https://github.com/openclaw/gogcli/blob/main/docs/commands/README.md>
- gog CLI source: <https://github.com/openclaw/gogcli>
