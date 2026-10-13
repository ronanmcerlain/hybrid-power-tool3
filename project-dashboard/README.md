# Project Pinboard

A one-page "smart pin board" for running several jobs at once. Each job is a tile showing its gensets, sub-base fuel tank, BESS and PV, plus its next key date and open tasks. Tiles change colour as dates get close, a popup lists anything critical, and scope changes are flagged until someone reviews them.

It is a single file, `index.html`, with no install, no server and no database.

## What it does

| Need | How the board handles it |
|---|---|
| Overview at a glance | Up to 10 tiles per board page (5 × 2 on a wide screen). The most urgent jobs sort to the top left. The header counts what is critical, due soon, scope-changed and on hold, and each count works as a filter. |
| Critical date warnings | Each job has key dates (FAT, delivery, commissioning, handover and so on), and each task has a due date. The tile pin and border go **amber** when something is due within 14 days, **red-orange** within 7 days and **pulsing red** once it is overdue. A popup lists every critical or overdue item when the board opens, and again each new day. Both thresholds can be changed in Settings. |
| Details and tasks | Click a tile to open its job card. You can edit details, scope and key dates, add tasks, post quick updates and see scope history. Every field saves as soon as you leave it. There is no Save button. |
| Assign a task and email the person | Type the task, pick the person, set a due date and press **Add task**. The person gets an email (see [Email options](#email-options)). The envelope button on a task sends a reminder. |
| Task status | Click the status pill to cycle **To do → In progress → Done**. |
| Scope change flag | Changing the generator count or size, the fuel tank, the BESS, the PV or the scope notes logs the change from the old value to the new one, then puts a purple **Scope change** ribbon on the tile until someone presses **Mark reviewed**. You can also log a free-text scope change. |
| Outstanding work | The **Tasks** view lists every open task across all jobs, grouped by due date or by person. |
| Wall screen | The monitor button switches to wall mode: full screen, no controls, and boards rotate every 30 seconds. Press Esc to leave. |

## Setting it up for the team

The page keeps all the data in **one shared `.json` file**. Everyone opens the same `index.html`, which reads and writes that file. Changes made by other people appear within about 15 seconds. If two people edit at the same moment, the board merges the changes record by record and keeps both.

**Use Microsoft Edge or Google Chrome.** They can write to a shared file. Firefox and Safari can view the board and keep a copy in the browser, but cannot save to the shared file.

### Option A: network drive (simplest)

1. Copy `index.html` to a shared folder, for example `\\fileserver\Projects\Pinboard\`.
2. Open it in Edge by double-clicking it. You can pin it as a favourite or a desktop shortcut.
3. Open **Settings**, then **Create shared file…**, and save `project-board-data.json` in the same folder.
4. Everyone else opens the same `index.html`, goes to **Settings**, then **Open existing file…**, and picks that `.json` file once.

After a restart, Edge asks once per session to reconnect. A yellow banner with a **Reconnect** button appears for this.

### Option B: SharePoint or Teams

SharePoint Online downloads `.html` files instead of displaying them, so use a synced folder:

1. Put `index.html` in a SharePoint document library, or in the Files tab of a Teams channel.
2. Each person clicks **Sync**, or **Add shortcut to My files**, so the library appears in File Explorer through OneDrive.
3. Open `index.html` from the synced folder in Edge, then follow steps 3 and 4 of Option A, using the synced folder.

OneDrive keeps everyone's copy of the `.json` file in step. SharePoint version history also gives you a free backup of the board data.

### Before you go live

- Open **Settings** and fill in the **Team** list with names and work email addresses.
- Set **Your name**. It is stored on your computer and is used to sign updates and emails.
- Press **Clear examples and start my board**, then pin your real jobs with **+ New project**.

## Email options

**1. Outlook draft (default, nothing to set up).** When a task is assigned, an email to that person opens in Outlook with the job, task and due date already filled in. You press Send.

**2. Fully automatic, using Power Automate.** Emails go out with no clicks. You need a Power Automate licence that includes the premium *HTTP request* trigger.

1. In Power Automate, create an **Instant cloud flow** with the trigger **When an HTTP request is received**.
2. Paste this as the request body JSON schema:
   ```json
   { "type": "object", "properties": {
       "to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"},
       "jobNo": {"type": "string"}, "project": {"type": "string"}, "task": {"type": "string"},
       "due": {"type": "string"}, "assignedBy": {"type": "string"} } }
   ```
3. Add the action **Office 365 Outlook → Send an email (V2)**. Set To = `to`, Subject = `subject` and Body = `body`.
4. Save the flow, then copy the **HTTP POST URL** from the trigger.
5. On the board, open **Settings**, then **Task emails**, and choose **Send automatically**. Paste the URL there.

If the flow ever fails, the board falls back to an Outlook draft so the person still gets told.

## Backups

**Settings → Download a backup** saves the whole board as a `.json` file. **Import from backup** merges a backup into the current board.

## Customising

All of the following are near the top of the `<script>` block in `index.html`:

- `PHASES`: the list of project phases.
- `SCOPE_FIELDS`: the scope values shown on each tile and watched for changes. Add a field here (for example `{ key: 'mvKv', label: 'MV voltage', unit: 'kV' }`) and it appears on the job card and in the scope log.
- `PAGE_SIZE`: the number of tiles per board page.
