# Todoist API Contract

## Authentication
- JWT based authentication
- Endpoints: `/api/signup`, `/api/login`
- Protected routes require `Authorization: Bearer <token>` header

## Backend Routes

### GET `/api/todos` (Protected)
Returns a list of all todos for the authenticated user.

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

### POST `/api/todos` (Protected)
Creates a new todo for the user.

### POST `/api/todos/{id}/comments` (Protected)
Adds a comment to a todo owned by the user.

### DELETE `/api/todos/{todo_id}/comments/{comment_id}` (Protected)

### PUT `/api/todos/reorder` (Protected)

### DELETE `/api/todos/{id}` (Protected)

## Database Schema (MongoDB)
- Collection: `users`
    - Fields: `_id`, `email`, `password` (hashed)
- Collection: `todos`
    - Fields: `_id`, `user_id`, `title`, `completed`, `category`, `priority`, `due_date`, `order`, `comments`
