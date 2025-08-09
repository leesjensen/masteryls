# Mastery LS

**Mastery LS** takes online learning to the next level by boosting maintainable content creation and focusing on learner mastery.

## Features

1. **Content** that leverages the online experience. This will include instruction video with interactive paths, textual instruction, and self paced learning.
   1. Markdown as the primary content format
   1. GitHub for version control and collaboration
   1. AI content generation for rapid content development
   1. Interactive video with branching paths
   1. Textual instruction with interactive elements
   1. Inline quizzes with support for multiple choice, multiple answer, and free text responses
   1. Self-paced learning modules
   1. Progress tracking and analytics
   1. Mobile-friendly design for learning on the go
   1. Offline access to learning materials
   1. AI-driven feedback for personalized learning
   1. Data privacy and security measures
   1. Scalability to accommodate large user bases
   1. Support for various content formats (videos, PDFs, images, etc.)
1. **Human Interaction** between learning peers and mentors from around the globe in curated cohorts. Peers advance to serve as mentors for other learners.
   1. Peer review and feedback
   1. Mentor review and feedback
   1. Collaboration tools for peer projects
1. **Mastery Projects** that demonstrate authentic learning in creative ways that provide a portfolio of the learner
   1. Tools for mastery projects
1. **System Integration** that provides mastery reports, enrollments, analytics, and automated notification
   1. Download reports
   1. Automated notifications
   1. Metrics dashboard
   1. API access for reporting integrations
   1. API access for enrollments
   1. API access for analytics
   1. API access for notifications
   1. TouchSpeed: Keyboard assisted grading automation
   1. TouchSpeed: Keyboard assisted feedback generation

## Functionality

### Configuration

The configuration is set using an admin API that is only writeable if you are an admin, but is publicly available for reading.

```js
{
   course: {
      title: "Awesome course",
      canvas-id: "234344"
   }
}
```

For the supabase edge functions that handle the GitHub MD requests the GitHub token will be inserted into supabase.

## Development notes

I want to keep this really simple and so I am going to use:

1. Vite
1. Basic React library
1. Supabase for database and authentication

This should make it so that I can host the whole thing as a static website

### Markdown support

There are lots of markdown libraries out there such as `marked`, `react-markdown`, and `remark`. However, none of them directly supported GitHub markdown which is what I want to target. So instead I am going to use the GitHub API for rendering markdown. This involves the following process.

1. Download the target markdown.
1. Render the markdown to HTML using the GitHub API.
1. Adding mermaid support had to be done manual.

### Added Tailwind for style

Followed these basic [instructions](https://tailwindcss.com/docs/installation/using-vite) for using with Vite.
