export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  order?: number;
  isDeleting?: boolean;
}

export const initialMockTodos: Todo[] = [
  { id: "1", title: "Buy groceries", completed: false },
  { id: "2", title: "Walk the dog", completed: true },
  { id: "3", title: "Read a book", completed: false },
];
