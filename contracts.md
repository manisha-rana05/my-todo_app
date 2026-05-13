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
    "order": 0
  }
]
```

### POST `/api/todos`
Creates a new todo.

**Request:**
```json
{
  "title": "string",
  "category": "string (optional)",
  "priority": "string (optional)",
  "due_date": "ISO string (optional)"
}
```

### PATCH `/api/todos/{id}`
Updates a todo's completed status, category, priority, or due date.

**Request:**
```json
{
  "completed": "boolean (optional)",
  "category": "string (optional)",
  "priority": "string (optional)",
  "due_date": "ISO string (optional)"
}
```

### PUT `/api/todos/reorder`
Updates the order of multiple todos.

**Request:**
```json
[
  { "id": "string", "order": 0 }
]
```

### DELETE `/api/todos/{id}`
Deletes a todo.

## Database Schema (MongoDB)
- Collection: `todos`
- Fields: `_id`, `title`, `completed`, `category`, `priority`, `due_date`, `order`
