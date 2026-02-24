# MasteryLS Application Class Diagram

## 1) Learning And Discussion Flow
```mermaid
classDiagram
direction LR

class Index {
  +loadApp()
}

class App {
  +createAppRouter(user)
  -userState
  -learningSessionState
  -uiSettingsState
}

class AppBar
class DashboardView
class ClassroomView
class MetricsView
class ProgressView
class CourseCreationView
class CourseExportView
class CourseExportForm
class Instruction
class InteractionInstruction
class useCourseOperations
class useProgressTracking
class useMarkdownLocation

class MarkdownInstruction {
  -noteMessages
  -aiMessages
  -discussionContext
  +onMakeHeadingActive()
}

class DiscussionPanel {
  +handleUserNoteInput()
  +handleAIQueryInput()
  +clearConversation()
}

class MessageBox
class Markdown
class usePersistentAIMessages {
  +clearStoredAIMessages()
}
class aiContentGenerator

Index --> App : boots
App --> AppBar : renders
App --> DashboardView : routes
App --> ClassroomView : routes
App --> MetricsView : routes
App --> ProgressView : routes
App --> CourseCreationView : routes
App --> CourseExportView : routes

ClassroomView --> Instruction : uses
Instruction --> InteractionInstruction : for topic type
InteractionInstruction --> MarkdownInstruction : renders content
MarkdownInstruction --> DiscussionPanel : composes
DiscussionPanel --> MessageBox : renders
MessageBox --> Markdown : renders
MarkdownInstruction --> useMarkdownLocation : uses
DiscussionPanel --> usePersistentAIMessages : uses

App --> useCourseOperations : creates
Instruction --> useProgressTracking : uses
CourseExportView --> CourseExportForm : composes
DiscussionPanel --> aiContentGenerator : AI responses
```

## 2) Authoring And Editor Flow
```mermaid
classDiagram
direction LR

class ClassroomView
class Editor
class MarkdownEditor
class MonacoMarkdownEditor
class EditorFiles
class EditorCommits
class Instruction
class EmbeddedInstruction
class useLatest
class useCourseOperations

ClassroomView --> Editor : uses (edit mode)
Editor --> MarkdownEditor : main markdown edit
Editor --> EditorFiles : file attachment links
Editor --> EditorCommits : commit history panel
Editor --> Instruction : preview mode
Editor --> EmbeddedInstruction : embedded/video topics
MarkdownEditor --> MonacoMarkdownEditor : editor engine
Editor --> useLatest : dirty/content refs
Editor --> useCourseOperations : getTopic/updateTopic
MarkdownEditor --> useCourseOperations : commit callback
EditorFiles --> useCourseOperations : upload/delete files
EditorCommits --> useCourseOperations : load topic commits
```

## 3) Data, Domain, And External Integration Flow
```mermaid
classDiagram
direction LR

class App {
  +createAppRouter(user)
}

class useCourseOperations {
  +getCourse(courseId)
  +getTopic(topic)
  +updateTopic(...)
  +addProgress(...)
  +getProgress(...)
  +exportToCanvas(...)
}

class Service {
  -supabase
  -catalog
  +currentUser()
  +courseCatalog()
  +getProgress(...)
  +addProgress(...)
  +makeGitHubApiRequest(...)
  +makeCanvasApiRequest(...)
  +makeGeminiApiRequest(...)
}

class Course {
  +modules
  +allTopics
  +topicFromId(id)
  +topicFromPath(path)
  +defaultTopic()
  +adjacentTopic(path, direction)
}

class User {
  +id
  +name
  +email
  +roles
}

class CatalogEntry {
  +id
  +name
  +title
  +gitHub
  +settings
}

class Enrollment {
  +id
  +learnerId
  +catalogId
  +progress
}

class LearningSession {
  +course
  +topic
  +enrollment
}

class MarkdownStatic
class ReactDOMServer
class Supabase
class GitHubAPI
class CanvasEdgeFunction
class GeminiEdgeFunction

App --> useCourseOperations : creates
useCourseOperations --> Service : delegates
useCourseOperations --> Course : manipulates
useCourseOperations --> LearningSession : reads/writes
useCourseOperations --> MarkdownStatic : static HTML export
useCourseOperations --> ReactDOMServer : renderToStaticMarkup

Service --> User : loads
Service --> CatalogEntry : loads/saves
Service --> Enrollment : loads/saves

LearningSession --> Course
LearningSession --> Enrollment
CatalogEntry "1" --> "*" Enrollment : enrollments
User "1" --> "*" Enrollment : learner

Service --> Supabase : auth/db
Service --> GitHubAPI : content/versioning
Service --> CanvasEdgeFunction : LMS integration
Service --> GeminiEdgeFunction : AI generation
```
