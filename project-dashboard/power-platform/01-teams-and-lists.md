# Step 1: Teams team and SharePoint Lists

**Time:** about 45 minutes. **You need:** Teams and a web browser. No IT and no special licence.

When you finish this step you will have a new Teams team. Behind it sit five SharePoint Lists that hold every job, key date, task, scope change and update. The Power App (step 2) and the Teams messages (step 3) both read and write these lists.

```
Jobs ──┬── KeyDates   (FAT, delivery, commissioning…; amber/red warnings)
       ├── Tasks      (assigned to a person; Teams messages + reminders)
       ├── ScopeLog   (what changed, old → new, reviewed?)
       └── Updates    (quick diary notes)
```

The other four lists link to a job through a **JobID** number, which is that job's ID in the Jobs list.

---

## A. Create the Teams team

1. In Teams, click **Teams** in the left rail.
2. Click **+** at the top of your teams list (it may be labelled **Join or create a team**), then **Create team**.
3. Choose **From scratch**, then **Private**. If you aren't offered these choices, skip this step.
4. Name it **Project Board** and click **Create**.
5. Add everyone who will use the board as **members**. You can add more people later, and anyone in the team can edit.

## B. Open the team's SharePoint site

1. In the new team, open the **General** channel and click the **Files** tab.
2. Click **…** (or the **Open in SharePoint** button), then **Open in SharePoint**. A browser tab opens on the team's SharePoint site.
3. Click the site name at the top left to go to the site home page. **Bookmark it.** You'll come back here for every list.

## C. How to create a list and add columns

You'll repeat this pattern five times:

1. On the site home, click **+ New**, then **List**, then **Blank list**.
2. Type the list name **exactly** as shown below, with no spaces. Click **Create**.
3. **Rename the Title column.** Click the **Title** column header, then **Column settings → Edit**, change the *Name*, and click **Save**.
4. **Add each column.** Click **+ Add column**, pick the **type**, click **Next**, type the **name** exactly as shown, set the default if one is listed, and click **Save**.
   - Defaults and "number of decimal places" are under **More options** at the bottom of the panel.

> **Why exact names with no spaces?** The Power App and the flows refer to columns by name. `GenQty` always works, while `Gen Qty` becomes `Gen_x0020_Qty` behind the scenes and the formulas break. If you mistype a name, delete the column and create it again. Renaming a column doesn't change its hidden name.

---

## D. The five lists

### 1. `Jobs`

| Column name | Type | Settings |
|---|---|---|
| Title → rename to **Job name** | (existing) | |
| `JobNo` | Single line of text | |
| `Client` | Single line of text | |
| `Site` | Single line of text | |
| `PM` | Person | |
| `Phase` | Choice | Choices, one per line: **Engineering**, **Manufacture / FAT**, **Site installation**, **Commissioning**, **Handover**. Default: Engineering |
| `GenQty` | Number | Decimal places: 0 |
| `GenKVA` | Number | Decimal places: 0 |
| `TankL` | Number | Decimal places: 0. Sub-base tank size in litres |
| `BESSkWh` | Number | Decimal places: 0 |
| `PVkWp` | Number | Decimal places: 0 |
| `ScopeNotes` | Multiple lines of text | |
| `OnHold` | Yes/No | Default: No |
| `Archived` | Yes/No | Default: No |

### 2. `KeyDates`

| Column name | Type | Settings |
|---|---|---|
| Title → rename to **Key date** | (existing) | e.g. FAT, Delivery to site |
| `JobID` | Number | Decimal places: 0. Require that this column contains information: **Yes** |
| `DueDate` | Date and time | Include time: **No** |
| `AmberDays` | Number | Default: **7**. Turns amber this many days before |
| `RedDays` | Number | Default: **3**. Turns red this many days before |
| `Done` | Yes/No | Default: No |
| `AlertSent` | Single line of text | Leave empty. The flow uses it to avoid sending the same alert twice |

### 3. `Tasks`

| Column name | Type | Settings |
|---|---|---|
| Title → rename to **Task** | (existing) | |
| `JobID` | Number | Decimal places: 0. Require: **Yes** |
| `AssignedTo` | Person | |
| `DueDate` | Date and time | Include time: **No** |
| `Status` | Choice | Choices: **To do**, **In progress**, **Done**. Default: To do |
| `RemindDays` | Number | Default: **2**. Teams reminder this many days before due |
| `NotifiedTo` | Single line of text | Leave empty. Used by the flow |
| `LastReminder` | Date and time | Include time: No. Leave empty. Used by the flow |

### 4. `ScopeLog`

| Column name | Type | Settings |
|---|---|---|
| Title → rename to **What changed** | (existing) | e.g. Generator size, or a free-text note |
| `JobID` | Number | Decimal places: 0. Require: **Yes** |
| `OldValue` | Single line of text | |
| `NewValue` | Single line of text | |
| `Reviewed` | Yes/No | Default: No |
| `ReviewedBy` | Single line of text | |

### 5. `Updates`

| Column name | Type | Settings |
|---|---|---|
| Title → rename to **Update** | (existing) | Short note, up to 255 characters |
| `JobID` | Number | Decimal places: 0. Require: **Yes** |

SharePoint already records who added each row and when, so updates are signed automatically.

---

## E. Test it with one real job

1. Open **Jobs** and click **+ Add new item**. Fill in one real job and click **Save**.
2. Show the ID column: click **+ Add column**, then **Show/hide columns**, tick **ID**, and click **Apply**. Note your job's ID. The first job will be **1**.
3. Open **KeyDates** and add one row: Key date = *FAT*, JobID = *1*, DueDate = something about five days away. Check that AmberDays shows **7** and RedDays shows **3** on their own.
4. Open **Tasks** and add one row assigned to **yourself**. Check that Status shows **To do** and RemindDays shows **2**.

## F. Send me this before step 2

- [ ] A screenshot of each list's column headers. Use **+ Add column → Show/hide columns** to make sure all of them are visible.
- [ ] The site address from your browser bar, e.g. `https://yourcompany.sharepoint.com/sites/ProjectBoard`. Send just this, and nothing that contains a password or code.
- [ ] Anything that didn't match these steps. Microsoft moves buttons around, so tell me what you see and I'll adjust.

Once I've checked those, step 2 builds the Power App board on top of these lists.
