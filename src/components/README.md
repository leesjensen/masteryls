# Contents Component Decomposition

The `Contents` component has been refactored into smaller, more focused subcomponents for better maintainability and reusability.

## Component Structure

### Main Component
- **`Contents.jsx`** - Main container component that orchestrates the course content display

### Subcomponents
- **`TopicItem.jsx`** - Renders individual topic items with edit controls
- **`TopicForm.jsx`** - Form for adding new topics with title and type selection
- **`ModuleSection.jsx`** - Renders a module section with its topics and controls

### Custom Hooks
- **`useModuleState.jsx`** - Manages module expand/collapse state and persistence
- **`useTopicOperations.jsx`** - Handles all topic CRUD operations (add, remove, etc.)

## Benefits of This Decomposition

1. **Single Responsibility**: Each component has a focused purpose
2. **Reusability**: Components can be reused in other parts of the application
3. **Testability**: Smaller components are easier to unit test
4. **Maintainability**: Changes to specific functionality are isolated
5. **Readability**: Code is more organized and easier to understand

## Component Responsibilities

### TopicItem
- Display topic icon, title, and status
- Handle topic selection
- Show editor controls (add/remove buttons)
- Manage hover states

### TopicForm
- Handle form input for new topics
- Validate topic title
- Support keyboard navigation (Enter/Escape)
- Topic type selection

### ModuleSection
- Render module header with expand/collapse
- Manage topic list display
- Coordinate between TopicItem and TopicForm
- Handle "Add topic" button

### useModuleState Hook
- Track which modules are expanded
- Persist state to enrollment settings
- Auto-expand modules containing current topic

### useTopicOperations Hook
- Generate topic IDs and paths
- Create topic content templates
- Handle GitHub operations for topic creation
- Manage topic removal and course structure updates
- Form state management

## Usage

The main `Contents` component now simply coordinates between these smaller pieces:

```jsx
<Contents 
  service={service}
  changeTopic={changeTopic}
  currentTopic={currentTopic}
  course={course}
  enrollment={enrollment}
  editorVisible={editorVisible}
  navigateToAdjacentTopic={navigateToAdjacentTopic}
  user={user}
  setCourse={setCourse}
/>
```

All the complex logic is now encapsulated in the custom hooks and subcomponents, making the main component much cleaner and easier to understand.
