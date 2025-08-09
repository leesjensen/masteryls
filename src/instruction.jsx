import React from 'react';
import ReactDOM from 'react-dom/client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function Instruction() {
  const markdown = `# Instruction Title
This is the content of the instruction. It can include **bold text**, *italic text*, and even [links](https://example.com).
- Item 1
- Item 2

## Code Block
\`\`\`javascript
function example() {
  console.log("This is a code block");
}
\`\`\`

## Mermaid Diagram
\`\`\`mermaid
graph TD;
  A[Start] --> B{Is it working?};
  B -- Yes --> C[Great!];
\`\`\`

## Blockquote and Important Note
> This is a blockquote.

> [!IMPORTANT]
>
> This is an important note that should be highlighted.

## Checklist
- [x] Task 1 completed
- [ ] Task 2 not completed
- [ ] Task 3 not completed

## Tables
| Syntax | Description |
|--------|-------------|
| Header | Title       |
| Paragraph | Text     |

## Task Lists
- [x] Feature 1
- [ ] Feature 2
- [ ] Feature 3

## Strikethrough
~~This was mistaken text~~

## Emoji
:smile: :rocket: :tada:

## Images
![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80)

## Mentions
@octocat

## Issue/PR References
#123
octocat/Hello-World#42

## Autolinked URLs
https://github.com

## Inline HTML
<span style="color: red;">This is red text</span>

## Footnotes
Here is a footnote reference.[^1]

[^1]: This is the footnote.

`;

  const [content, setContent] = React.useState(markdown);

  return (
    <div className="instruction">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default Instruction;
