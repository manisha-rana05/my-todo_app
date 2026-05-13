# Todoist API Contract

## Backend Routes

### GET `/api/todos`
Returns a list of all todos.

**Response (200 OK):**
```json
[
  {
    "id": "string",
    "title": "string",
    "completed": false,
    "category": "string",
    "priority": "string",
    "due_date": "ISO string (optional)",
    "order": 0,
    "comments": [
      {
        "id": "string",
        "text": "string",
        "created_at": "ISO string"
      }
    ]
  }
]
```

### POST `/api/todos`
Creates a new todo.

### POST `/api/todos/{id}/comments`
Adds a comment to a todo.

**Request:**
```json
{
  "text": "string"
}
```

### DELETE `/api/todos/{todo_id}/comments/{comment_id}`
Deletes a comment.

## Database Schema (MongoDB)
- Collection: `todos`
- Fields: `_id`, `title`, `completed`, `category`, `priority`, `due_date`, `order`, `comments`
