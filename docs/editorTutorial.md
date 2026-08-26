<img src="../public/masteryls-logo-horizontal.png" width="300" />

# Editor Tutorial

This tutorial explains the full authoring and course-operations workflow in MasteryLS, from course creation to editing, interactions, settings, analytics, gradebook, and observe mode.

## Quick Start Checklist

If you are new to MasteryLS editing, use this checklist as a first-run path through the core workflow. It is intentionally hands-on: you will create/edit content, validate rendering, confirm settings, and verify operational views (metrics, activity, gradebook, observe mode) in one pass.

- [ ] Create a course (`New course`) or open an existing editor-assigned course.
- [ ] Open a topic and switch `View -> Edit` in the classroom toolbar.
- [ ] Make a small markdown change (heading or paragraph) and verify changed-line markers.
- [ ] Insert one interaction template from the editor toolbar (for example, multiple-choice).
- [ ] Switch back to View mode and confirm the interaction renders/behaves correctly.
- [ ] If needed, add a file or paste an image and verify the markdown reference.
- [ ] Open course `Settings`, confirm metadata, and save changes.
- [ ] If using Canvas, run `Link course` and verify external references.
- [ ] Open `Metrics` and `Activity` once to verify progress/analytics visibility.
- [ ] Open `MasteryView`, expand a learner row, and test `Observe` / `Exit observe`.

## 1) Course Creation and Getting to Edit Mode

> [!NOTE]
>
> You must be a MasteryLS editor in order to create courses

### Create a course

Use the user menu (`New course`) to create a course. You can:

- Generate starter structure with AI, or
- Create from a template repository.

After creation, the course is added to catalog and you are set as an editor for that course.

Once you have MasteryLS fully deployed you can now log into your installation of MasteryLS using the **root email** you provided to the MasteryLS CLI for installation. This user has full root access to your installation.

After logging in, you will see the root user's dashboard. Click on the user menu and select **New Course**.

![Create Course](createCourseNav.png)

Enter the information about the course. Don't generate the course from your description on your first course. You can experiment with that later.

You need to provide your GitHub account name, repo, and personal access token (PAT) for the location where you want to create the course repository. Make sure that the PAT you provide has **Administration** and **Contents** read/write rights.

To create your token access:

1. Open GitHub with your user account where you want to create your backing course repository
1. Acess the settings to create the token: `Settings`>`Developer settings`>`Personal access tokens`
1. Generate a new fine-grained personal access token with **Administration** and **Contents** read/write rights

Here is what the GitHub settings screen looks like after creating your token.
<img width="600" src="tokenRights.png" />

You can then provide your token to create the course.

![Provide course properties](courseParams.png)

Congratulations! You have successfully installed MasteryLS and created your first course.

![View your course](firstCourse.png)

### AI course generation

When you choose AI generation during course creation, MasteryLS asks the model to produce a starter course structure (modules + topics + topic descriptions). This is designed to accelerate initial planning, not replace instructional review.

Recommended workflow:

1. Provide a specific course title and description.
2. Review module sequence for a clear learning progression.
3. Refine generated topic titles/descriptions before drafting content.

Best practices:

- Be explicit about audience level and scope in the description.
- Keep capstone/project expectations clear in the prompt.
- Treat generated structure as a **draft blueprint**. You will need to enhance, add, remove, and curate the list of generated topics.

### Link an existing course to Canvas

If you want to use Canvas as the gradebook for the course then use `Link course` from the user menu to connect MasteryLS content to a Canvas course. This supports:

- Linking pages/quizzes/assignments
- Selecting schedule file for due-date syncing
- Restricting topic subset to link
- Repair/re-link/unlink workflows

<img src="linkToCanvas.png" width="600" />

### Enable editing mode

1. Open a course topic.
2. In classroom toolbar, use the `Edit/View` slider to switch to edit.
3. The center pane switches to markdown editor.

<img src="editMode.png" width="600" />

Notes:

- Edit controls are shown only for course editors/root.
- In observe mode, editing and submission actions are read-only.

## 2) Managing Topics and Modules

In `Topics` sidebar (edit mode):

- Add, rename, and delete modules.
- Add, rename, and delete topics.
- Drag-and-drop topics to reorder.
- Generate all stubbed topics with AI (`state: stub` + description).
- Create/delete schedule topic and schedule files.

<img src="editingContents.png" width="200" />

### AI topic generation

AI topic generation turns stub topics into first-draft lesson markdown. It uses topic descriptions (and module/course context) to generate prose and structure quickly.

<img src="generateTopic.png" width="200" />

Recommended workflow:

1. Write high-quality topic descriptions first (objective + constraints + expected depth).
2. Generate one topic, inspect quality, then tune descriptions.
3. Generate remaining topics in batches.
4. Perform an editorial pass for correctness, style, and consistency.

Pre-publish checks:

- Validate technical correctness of examples.
- Remove duplicate/redundant sections.
- Confirm links, code blocks, and interactions behave correctly in View mode.
- Ensure generated interactions have valid UUID IDs and intended settings.

Published learner behavior:

- Unpublished topics are filtered from learner-facing TOC.
- Due date labels can appear on topics when schedule due-items map to topic links/titles.

## 3) Using the Editor and Toolbar

The editor supports standard behaviors: selection editing, multi-cursor, undo/redo, search/replace, keyboard shortcuts, and line-level precision editing.

- Draft section headings first (`##`, `###`), then fill content.
- Insert interactions from templates, then tune JSON options.
- Frequently switch to View mode to validate rendering and UX.
- Use changed-line markers before commit.
- **Do not copy interactions**. The generated ID must be unique for each interaction. Use the toolbar button to first create the masteryls code fence and then copy the body of the interaction if desired.

### Tool categories

<img src="editorToolbar.png" width="600" />

#### Editor toggle group

- `Word Wrap`: Toggle long-line wrapping.
- `Line Numbers`: Toggle gutter numbers.
- `Changed Lines`: Toggle changed-line markers against committed content.

#### Format group

- **Bold**: wrap selection in `**...**`
- **Italic**: wrap selection in `*...*`
- **Inline Code**: wrap selection in `` `...` ``
- **Heading 2**: prefix line with `## `
- **Heading 3**: prefix line with `### `

#### Content group

- **Table**: inserts markdown table template.
- **Bullet List**: prefixes list item with `- `.
- **Link**: opens topic-link selector and inserts internal topic link markdown.
- **Image**: inserts image markdown placeholder.

#### Quiz/Interaction template group

- **Multiple Choice**: inserts a single-answer graded question (`multiple-choice`) where one option is correct.
- **Multiple Select**: inserts a multi-answer graded question (`multiple-select`) where multiple options can be correct.
- **Essay**: inserts a free-response graded prompt (`essay`) for longer written learner answers.
- **Teaching**: inserts an AI teaching/conversation interaction (`teaching`) where learner responses are evaluated from the teaching dialogue.
- **File Submission**: inserts a file upload submission interaction (`file-submission`) for deliverables like documents, code archives, or media.
- **URL Submission**: inserts a URL-based submission interaction (`url-submission`) that can validate links and optionally grade via criteria.
- **Web Page**: inserts an embeddable HTML interaction (`web-page`) using inline HTML or an external topic file.
- **AI Web Page**: inserts a generation/edit/submit web-page workflow (`ai-web-page`) with optional AI prompting and rubric grading.

Each template inserts a `masteryls` interaction fence with starter JSON/body.

#### AI group

- **AI generated quiz**: creates a quiz fence and normalizes interaction IDs.
- **AI generated section**: adds topic section markdown.
- **AI prompt response**: inserts AI-generated prose/content.
- **AI modify selected markdown**: rewrites only selected range.
- **AI topic review**: spelling/grammar/content review.
- **AI generated image**: generates image asset and inserts markdown.

## 4) Managing Files and Pasting Images

### Files

- Add topic files and remove files from editor file tools.
- Insert file links/media references into markdown.

### Pasted images

<img src="pastedImage.png" width="600" />

- Paste image directly into editor.
- MasteryLS creates topic asset files and inserts markdown references.
- Duplicate names get unique suffixes automatically.
- Image resize flow can be used before insertion.

## 5) View Commits and Apply History

<img src="commitHistory.png" width="500" />

In edit mode commit/history tools:

- View topic commit history.
- Open diffs for prior commits.
- Apply selected revision/diff back into current editor.

Use this to recover from mistakes, compare revisions, and audit changes.

## 6) Create and Manage Schedules

<img src="schedule.png" width="700" />

A course has at most one schedule, but that schedule can hold several **schedule files** - for example one per term, section, or meeting pattern (MW vs. TTh). Each schedule file is its own markdown document with a session table, and only one of them is ever the "default."

### Creating the schedule topic

- A course starts with no schedule. In edit mode, if none exists yet, a **+ Create schedule** link appears at the bottom of the Topics list (below **+ Add New Module**).
- Creating it adds a pinned **📅 Schedule** entry above the module list in the Topics sidebar (learners see this too) and creates a first schedule file titled "Schedule" at `schedule/schedule.md`, seeded with an empty session table.
- The whole schedule (all files) can be removed with the **X** next to **📅 Schedule** in the sidebar (edit mode only) - this deletes every schedule file's underlying markdown from the repository and confirms before doing so.

### The schedule editor

Open **📅 Schedule** and toggle edit mode to reach the schedule editor. Its toolbar has:

- **File dropdown** - switches between schedule files; the last option, **+ New schedule...**, opens the create dialog (below).
- **Discard / Commit** - like the regular topic editor, changes to the form (title, links, weeks, special days, dates covered) are local until you click Commit. An asterisk next to "Editor" means there are unsaved changes.
- **Default** - marks the currently selected file as the default (see below); disabled when it's already the default.
- **Delete** - deletes the currently selected file; disabled for the default file (a schedule always needs a default, and it can't be removed this way).
- **Dates covered / Start / End** - optional informational start and end dates for the file (e.g. the term it covers). These are purely descriptive metadata, not used for auto-selecting a schedule, and are saved together with the rest of the form when you click Commit.

Below the toolbar is a split view: an editable form on the left (**Title**, **External links**, **Weeks** with sessions you can add/remove/drag-reorder and link to due items/topics covered/slides by picking existing course topics or typing a custom entry, and **Special days**) and a live rendered preview on the right.

Note the **Title** field edits the markdown document's own `# heading` (what learners see as the page title when that file is open) - it's a different thing from the file's name shown in the dropdown, which is fixed once the file is created (see below).

### Creating additional schedule files

Use **+ New schedule...** in the dropdown to open the create dialog:

- Enter a **title** for the new file.
- Choose **Create from**: either a blank schedule, or copy the weeks/links/special days from an existing schedule file (its content, not just the currently open one).
- When copying, an optional **First session date** shifts every session's date by the same offset needed to move the source's first dated session to that date - useful for reusing a Fall schedule's structure for a new Spring one.

The new file's path is generated from its title (lower-cased, non-alphanumeric characters collapsed to dashes, always placed under `schedule/`) - e.g. "Fall 2026 MW Schedule" becomes `schedule/fall-2026-mw-schedule.md`. Creation fails if a file with that same generated path already exists.

Schedule files cannot be renamed after creation - the dropdown label and file path are fixed at creation time; only the in-document **Title** field can be edited afterward, and editing it does not change the dropdown label.

### Setting the default schedule

Select a file and click **Default**. This:

- Marks that file as the default (clearing the flag from every other file).
- Immediately switches your own current selection to it.
- Cannot be undone by deleting the file - the default file is protected from deletion until another file is made default instead.

The default file is what a learner sees when they have no stored preference (see below), and is also what supplies the schedule topic's own title/breadcrumb.

### How a learner selects a schedule

On the learner-facing schedule page, a dropdown above the content lists all published schedule files. Picking one:

- Immediately swaps in that file's content.
- Persists the choice in that learner's per-course UI settings (stored in the browser), so the same file is shown again on later visits.

If nothing is stored yet, or the stored choice no longer matches an existing file, the view falls back to the default file (or the first file if none is marked default). Selection is purely a manual, remembered preference - there is no date-based or calendar-aware auto-selection of the "current" schedule.

### Deleting a schedule file

With a non-default file selected, click **Delete** in the editor toolbar and confirm. This removes that file's markdown from the repository and switches your selection to the default file. The default file itself can't be deleted this way, and since a schedule always needs at least one file, that also means the last remaining file can't be deleted - delete the whole schedule instead (see above) if you no longer need it.

### Due dates and Canvas

Each schedule file's session table (`Due` column) drives the due-date badges shown next to topics in the Topics sidebar, based on whichever schedule file the current viewer has selected. Schedule content itself is not exported to Canvas, but the due dates it encodes are informational context editors can use when planning a Canvas link.

## 7) Interactions: Format, Parameters, and Examples

All interactions use a fenced `masteryls` block:

````
```masteryls
{"id":"<uuid>", "title":"Interaction title", "type":"multiple-choice"}
Body/instructions...
```
````

Additional examples:

- Full interaction examples: [example-topic.md](example-topic.md)
- AI web page authoring examples: [example-topic.md#ai-web-page-authoring-notes](example-topic.md#ai-web-page-authoring-notes)

### Core JSON parameters (common)

- `id` (string): unique interaction identifier. Use UUID format.
- `title` (string): label shown above interaction.
- `type` (string): interaction type selector.

### 7.1 Multiple choice

What it does: Presents a single-answer objective question and awards score based on the selected option versus the defined correct option.

<img src="mcInteraction.png" width="400" />

````
```masteryls
{"id":"39280", "title":"Multiple choice", "type":"multiple-choice", "syncGrade":false, "autoGrade":false }
Simple **multiple choice** question

- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
```
````

Parameters:

- `type: "multiple-choice"`
- Exactly one intended correct choice marked with `[x]`.
- `syncGrade` (bool): enables manual "Submit to Gradebook" button after submission feedback.
- `autoGrade` (bool): controls posted-grade vs comment-only behavior in linked gradebook.

### 7.2 Multiple select

<img src="mcInteraction.png" width="400" />

What it does: Presents a multi-answer objective question where learners can choose multiple options; scoring accounts for both correct and incorrect selections.

````
```masteryls
{"id":"39281", "title":"Multiple select", "type":"multiple-select", "syncGrade":false, "autoGrade":false }
A **multiple select** question can have multiple answers.

- [ ] Wrong
- [x] Correct
- [x] Also correct
```
````

Parameters:

- `type: "multiple-select"`
- Multiple `[x]` answers allowed.
- `syncGrade` (bool): enables manual "Submit to Gradebook" button after submission feedback.
- `autoGrade` (bool): controls posted-grade vs comment-only behavior in linked gradebook.

### 7.3 Essay

<img src="essayInteraction.png" width="400" />

What it does: Collects a free-form written response for qualitative evaluation and feedback.

````
```masteryls
{"id":"b1de730b-9331-4e2f-8c7b-b8ff66a51a03", "title":"Your thoughts?", "type":"essay", "gradingCriteria":"- Answers both parts of the prompt\n- Uses evidence from the lesson\n- Explains reasoning clearly" }
Simple **essay** question
```
````

Parameters:

- `type: "essay"`
- `gradingCriteria` (string, optional): Additional grading criteria used by AI when scoring and generating feedback. The additional grading criteria is applied together with the essay prompt and surrounding content. This gives you the opportunity to add criteria that is not specifically displayed to the learner.
- `syncGrade` (bool): enables the manual "Submit to Gradebook" button after grading feedback.
- `autoGrade` (bool): controls posted-grade vs comment-only behavior in the linked gradebook.
- Body is prompt/context.

### 7.4 Survey

<img src="surveyInteraction.png" width="40" />

What it does: Collects non-graded learner preference/feedback responses as either single-select or multi-select choices.

````
```masteryls
{"id":"40824056-92f3-48e6-8f68-f0f63d67071f", "title":"Multiple select survey", "type":"survey",  "multipleSelect": "true" }
What would you have as a pet?

- [ ] Cat
- [ ] Dog
```
````

Parameters:

- `type: "survey"`
- `multipleSelect`: `"true"` for multi-select behavior; omitted/false behaves as single-select survey.

### 7.5 Likert

<img src="likertInteraction.png" width="400" />

What it does: Collects scaled sentiment across multiple statements and supports aggregated results reporting.

````
```masteryls
{"id":"9f6b1470-6384-45f8-a13a-045b9278f6a2", "title":"Lesson Reflection", "type":"likert", "showResults":"always"}
Rate each statement on the same scale.

Scale: Strongly disagree | Disagree | Neutral | Agree | Strongly agree

| qid | item |
|-----|------|
| prep | I came prepared for class. |
| engage | I stayed engaged throughout the lesson. |
```
````

Parameters:

- `type: "likert"`
- `showResults`: `always` or `editor`
- `required`: optional (`false` allows partial responses)
- `Scale:` line defines ordered labels
- table columns: question id + question text (`qid/id` and `item/statement/question` aliases supported)

### 7.6 File submission

<img src="fileInteraction.png" width="400" />

What it does: Collects one or more uploaded files as learner deliverables for project evidence and optional gradebook workflows.

````
```masteryls
{"id":"39283", "title":"File submission", "type":"file-submission", "syncGrade":false, "autoGrade":false }
Simple **submission** by file
```
````

Parameters:

- `type: "file-submission"`
- `gradingCriteria` (string, optional): rubric used by AI to score the uploaded file(s) and generate feedback. Applied together with the prompt and surrounding content; lets you add criteria not shown to the learner.
- `syncGrade` (bool): enables manual “Submit to Gradebook” after grading feedback.
- `autoGrade` (bool): controls posted-grade vs comment-only behavior in linked gradebook.

### 7.7 URL submission

<img src="urlInteraction.png" width="400" />

What it does: Collects a learner URL submission, optionally validates/rewrites the URL, optionally grades with criteria, and can sync results to gradebook.

````
```masteryls
{"id":"39287", "title":"URL submission (AI criteria + URL transform)", "type":"url-submission", "validateUrl":true, "syncGrade":false, "autoGrade":false, "gradingCriteria":"- Include a section named HTML Deliverable\n- At least two completed checklist items are explained clearly", "urlPrompt":"Convert the user provided URL to create a URL that is the path to the raw GitHub content for the README.md file." }
Submit your repository URL.
```
````

Parameters:

- `type: "url-submission"`
- `validateUrl` (bool): validates URL format/reachability.
- `gradingCriteria` (string): rubric for AI grading.
- `urlPrompt` (string): transformation prompt for target URL extraction.
- `syncGrade` (bool): enable manual gradebook submission.
- `autoGrade` (bool): include posted score when syncing.

### 7.8 Teaching

<img src="teachingInteraction.png" width="400" />

What it does: Runs an AI-assisted teaching dialogue where learner messages are evaluated and submitted as an instructional interaction outcome.

````
```masteryls
{"id":"b1de730b-9331-4e2f-8c7b-b8ff66a51a03", "title":"Teaching", "type":"teaching" }
Help me understand the **Socratic method**.
```
````

Parameters:

- `type: "teaching"`
- `syncGrade` (bool): enables the manual "Submit to Gradebook" button after grading feedback.
- `autoGrade` (bool): controls posted-grade vs comment-only behavior in the linked gradebook.
- Body is teaching objective/context.

### 7.9 Prompt

<img src="promptInteraction.png" width="400" />

What it does: Captures and evaluates learner-authored prompts as a prompt-engineering style interaction.

````
```masteryls
{"id":"b1de730b-9331-4e2f-8c7b-b8ff66a51a03", "title":"Prompt", "type":"prompt" }
Ask the learner to craft a prompt.
```
````

Parameters:

- `type: "prompt"`
- `syncGrade` (bool): enables the manual "Submit to Gradebook" button after grading feedback.
- `autoGrade` (bool): controls posted-grade vs comment-only behavior in the linked gradebook.
- Body defines task/prompt constraints.

### 7.10 Web page

<img src="simpleWebPageInteraction.png" width="400" />

What it does: Renders embedded HTML content (inline or file-based) inside the lesson so learners can view or interact with a page artifact.

````
```masteryls
{"id":"b1de730b-9331-4e2f-8c7b-b8ff66a51a03", "title":"Web Page", "type":"web-page", "file":"instruction/topic1/starter-page.html", "height":"100px"}
This body text is optional when using `file`.
```
````

Parameters:

- `type: "web-page"`
- `file`: HTML path resolved from topic path.
- `height`: initial frame height (number px or CSS unit string).
- Inline HTML body may be used; if both inline HTML and `file` exist, inline HTML takes precedence.

You can use the Web Page interaction to create interactive demos in your content. The following shows an interaction that demonstrates Hick's Law.

<img src="hicksLawInteraction.png" width="600" />

### 7.11 AI web page

<img src="aiWebPageInteraction.png" width="400" />

What it does: Provides an AI-assisted workflow to generate/edit HTML, then submit for rubric-based evaluation.

#### Reference to topic file

````
```masteryls
{"id":"b1de730b-9331-4e2f-8c7b-b8ff66a51a03", "title":"AI Web Page", "type":"ai-web-page", "allowAiPrompt":false, "file":"instruction/topic1/starter-page.html"}
Revise the starter HTML manually, then submit.
```
````

#### Reference to embedded HTML

````
```masteryls
{"id":"b1de730b-9331-4e2f-8c7b-b8ff66a51a03", "title":"AI Web Page", "type":"ai-web-page", "allowAiPrompt":false}
Revise the starter HTML manually, then submit.

~~~html
<h1>hello</h1>
~~~
```
````

Parameters:

- `type: "ai-web-page"`
- `allowAiPrompt` (bool): show/hide prompt generation UI.
- `gradingCriteria` (string): rubric for submit-time grading.
- `file`: optional starter HTML file.
- `height`: optional frame height.
- `syncGrade` (bool): enables the manual "Submit to Gradebook" button after grading feedback.
- `autoGrade` (bool): controls posted-grade vs comment-only behavior in the linked gradebook.

### 7.12 GitHub submission

What it does: Collects a public GitHub repository URL from the learner and grades the **contents of the repository** against your criteria. On submit, MasteryLS reads the repository's files and an AI evaluates them, returning a score (0–100) and actionable markdown feedback that references real file paths (highlighting what the application code does well and where it falls short). This differs from URL submission (7.7): a URL submission validates/transforms a single link, whereas a GitHub submission fetches and evaluates the repository itself.

The learner input is validated against the `https://github.com/owner/repo` form before submission is enabled.

> [!NOTE]
>
> There is no toolbar template button for GitHub submission. Author it by inserting a `masteryls` fence manually and giving it a unique `id` (UUID).

````
```masteryls
{"id":"6b1d1b1e-3d9a-4c2a-9d3e-2f2a7c9a1b44", "title":"Submit your project repository", "type":"github-submission", "syncGrade":false, "autoGrade":false, "gradingCriteria":"- README documents how to build and run\n- Application code is organized into clear modules\n- Includes automated tests that cover core behavior" }
Submit the URL of your GitHub repository.
```
````

Parameters:

- `type: "github-submission"`
- `gradingCriteria` (string, required): rubric the repository's files are graded against by AI. Application code files are weighted over markdown files; large or binary files are skipped. If omitted, a submission scores 0 with "No grading criteria configured".
- `syncGrade` (bool): enables the manual "Submit to Gradebook" button after grading feedback.
- `autoGrade` (bool): controls posted-grade vs comment-only behavior in the linked gradebook.
- Body is the prompt/instructions shown to the learner.

Notes:

- The repository must be publicly accessible for MasteryLS to read its files.
- Grading is grounded strictly in the submitted repository's files; feedback cites real paths from the repo.

## 8) Course Settings (Detailed, including Repair tools)

Open: sidebar `Settings`.

<img src="settings.png" width="300" />

### Information section

- **Name**: short course handle.
- **Title**: display title in UI.
- **Description**: course summary.
- **State**: `published` or `unpublished`.
- **Delete Protected**: blocks destructive deletion.
- **GitHub account/repository**: source-of-truth repo location.
- **GitHub token** (editor): used for repository operations.
- **External references**: current linked external IDs (e.g., Canvas).

### Repair tools

1. **Reindex search**
   - Rebuilds topic search index from current course markdown.
   - Use after large content edits if search appears stale/incomplete.

2. **Unpin content**
   - Clears pinned/forced UI content state across topics.
   - Use if pinned items are stuck or inconsistent.

### People management

- **Manage editors**:
  - Add/remove course editors.
  - At least one editor must remain.
- **Manage learners**:
  - Enroll/remove learners from course enrollment.
  - Changes affect learner course access and related reporting.

### Save and delete behavior

- `Save changes` persists all modified settings and people assignments.
- `Delete course` is restricted (root+editor) and disabled when delete-protected.
- Deletion is destructive (course, repo linkage context, and related records).

## 9) Metrics

Open from user menu `Metrics`.

<img src="metrics.png" width="600" />

Metrics supports:

- Course filter (`All Courses` or specific course)
- Date range filters + quick presets
- Editor user filter (search by name/email)
- Aggregate activity counters and trend visualizations
- Session/time/activity-type analytics for operational insight

Use it to identify engagement drop-offs, outlier activity, and timing patterns.

## 10) Activity (Progress View)

<img src="activity.png" width="600" />

Open from user menu `Activity`.

Features:

- Filter by event type, course, date window.
- Paginated server-side progress records.
- Grouped consecutive events for readability.
- Duration summaries and timestamp sorting.
- Direct navigation back to related course/topic.

Use it for user-level audit trails and behavior debugging.

## 11) Mastery View

Open from user menu or classroom toolbar.

<img src="masteryView.png" width="600" />

Features:

- Course-level learner summary table.
- Search/pagination.
- Expand learner rows for detailed topic interaction coverage.
- Sort detail columns.
- For sync-enabled submissions:
  - manual `Submit to Gradebook`
  - `autoGrade` behavior respected.

## 12) Observe Mode (Root/Editor as Learner)

Start from Mastery View:

<img src="observeMode.png" width="600" />

1. Click `Observe` on learner row.
2. App routes to course as that learner.
3. Banner shows observed learner and read-only state.
4. Use `Exit observe` in banner to leave mode.

<img src="observing.png" width="600" />

Behavior:

- Read-only course interactions/submissions.
- Grade sync disabled while observing.
- Notes are visible as read-only in discussion.
- Observe session persists across refresh until exited.

## 13) How Content Is Stored in GitHub

MasteryLS course content is GitHub-backed:

- Course structure and metadata are stored in course files (including topic paths and schedule files).
- Topic markdown is the primary authored content.
- Interaction definitions live directly inside topic markdown as `masteryls` fences.
- Added assets (images/files) are stored in repo and referenced by relative markdown paths.
- Editor commits update files in GitHub and commit history is visible from the editor.

<img src="gitHubRepo.png" width="600" />

Practical implications:

- Git history is your long-term content audit.
- File paths in topic metadata matter for rendering and linking.
- Keep interaction IDs stable once learners start submitting against them.

## 14) How Data Is Stored in Supabase

Supabase stores operational data and app state, including:

- **catalog**: course catalog entries and settings.
- **user/role**: users, permissions, editor/root rights.
- **enrollment**: learner-course enrollment and progress summary.
- **progress**: event/activity records (`instructionView`, `quizSubmit`, `note`, `exam`, etc.).
- **topic search index**: searchable topic content index data.
- **edge function workflows**: secure Canvas sync, URL validation, gradebook overview aggregation.

<img src="supabaseDb.png" width="600" />

Storage split model:

- **GitHub** = canonical course content/files.
- **Supabase** = users, permissions, enrollments, analytics, submissions, sync metadata.
