import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, GripVertical, Loader2, Tag, Filter, AlertCircle, Calendar as CalendarIcon, Clock, ArrowUpDown } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/config";
import { useToast } from "@/hooks/use-toast";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  category: string;
  priority: string;
  due_date?: string;
  isDeleting?: boolean;
}

const CATEGORIES = ["General", "Work", "Personal", "Shopping", "Urgent"];
const PRIORITIES = ["Low", "Medium", "High"];

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  High: "bg-red-500/10 text-red-500 border-red-500/20",
};

const PRIORITY_VALUE: Record<string, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export default function Index() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [newPriority, setNewPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"custom" | "priority">("custom");
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await fetch(`${API_URL}/api/todos`);
      if (response.ok) {
        const data = await response.json();
        setTodos(data);
      }
    } catch (error) {
      toast({ title: "Error fetching todos", variant: "destructive" });
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim() || isAdding) return;
    
    setIsAdding(true);
    try {
      const response = await fetch(`${API_URL}/api/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: newTodo.trim(),
          category: newCategory,
          priority: newPriority,
          due_date: dueDate ? dueDate.toISOString() : null
        }),
      });
      
      if (response.ok) {
        const todo = await response.json();
        setTodos([todo, ...todos]);
        setNewTodo("");
        setDueDate(undefined);
      }
    } catch (error) {
      toast({ title: "Error adding todo", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const toggleTodo = async (id: string, currentStatus: boolean) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    try {
      const response = await fetch(`${API_URL}/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !currentStatus }),
      });
      if (!response.ok) fetchTodos();
    } catch (error) {
      fetchTodos();
      toast({ title: "Error updating todo", variant: "destructive" });
    }
  };

  const deleteTodo = async (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, isDeleting: true } : t));
    try {
      const response = await fetch(`${API_URL}/api/todos/${id}`, { method: "DELETE" });
      if (response.ok) {
        setTodos(prev => prev.filter((todo) => todo.id !== id));
      } else {
        setTodos(prev => prev.map(t => t.id === id ? { ...t, isDeleting: false } : t));
        toast({ title: "Error deleting todo", variant: "destructive" });
      }
    } catch (error) {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, isDeleting: false } : t));
      toast({ title: "Error deleting todo", variant: "destructive" });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || sortBy !== "custom") return;
    const items = Array.from(todos);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const updatedItems = items.map((item, index) => ({ ...item, order: index }));
    setTodos(updatedItems);
    try {
      await fetch(`${API_URL}/api/todos/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItems.map((item, index) => ({ id: item.id, order: index }))),
      });
    } catch (error) {
      fetchTodos();
    }
  };

  const processedTodos = useMemo(() => {
    let result = [...todos];
    
    // Filter by category
    if (filterCategory !== "All") {
      result = result.filter(t => t.category === filterCategory);
    }
    
    // Sort
    if (sortBy === "priority") {
      result.sort((a, b) => PRIORITY_VALUE[b.priority] - PRIORITY_VALUE[a.priority]);
    } else {
      result.sort((a, b) => a.order - b.order);
    }
    
    return result;
  }, [todos, filterCategory, sortBy]);

  const getDueDateLabel = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return isPast(date) && !isToday(date);
  };

  return (
    <div 
      className="min-h-screen p-4 md:p-8 flex flex-col items-center pt-20 relative bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: 'url("https://media-manager-c.questera.ai/greta-media/00c0a41eb8edb82ed6aa373e1da2fa5eec94e0aa0c1d83da71a4483ec12809b29b5076da63b105370a91c12ee31dd9cd/images/aW1hZ2UvcG5n/a88295cc6e808bf462e3f4ca9497e042.png")' }}
    >
      <div className="absolute inset-0 bg-background/40 pointer-events-none" />
      
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <ModeToggle />
      </div>
      
      <Card className="w-full max-w-2xl shadow-xl border-border/50 relative z-10 bg-card/95 backdrop-blur-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 pb-7">
          <CardTitle className="text-3xl font-black tracking-tight">Tasks</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Cats</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom (Drag)</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTodo} className="space-y-4 mb-8">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  placeholder="What needs to be done?"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  className="flex-1 h-11"
                  disabled={isAdding}
                />
                <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={isAdding}>
                  {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="w-full h-10">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger className="w-full h-10">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-10 justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "MMM d") : <span>Due Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </form>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="todos">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {processedTodos.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl border-muted">
                      <p className="text-muted-foreground font-medium">No tasks found</p>
                    </div>
                  ) : (
                    processedTodos.map((todo, index) => (
                      <Draggable key={todo.id} draggableId={todo.id} index={index} isDragDisabled={sortBy !== "custom"}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center justify-between p-4 border rounded-xl bg-card transition-all group ${
                              snapshot.isDragging ? "shadow-2xl ring-2 ring-primary scale-[1.02] z-50" : "hover:border-primary/30"
                            }`}
                            style={provided.draggableProps.style}
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div {...provided.dragHandleProps} className={cn(
                                "text-muted-foreground/30 hover:text-primary transition-colors cursor-grab active:cursor-grabbing",
                                sortBy !== "custom" && "opacity-0 pointer-events-none"
                              )}>
                                <GripVertical className="h-5 w-5" />
                              </div>
                              <Checkbox
                                checked={todo.completed}
                                onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
                                className="h-5 w-5"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className={`text-sm font-semibold truncate transition-all ${todo.completed ? "line-through text-muted-foreground opacity-60" : "text-foreground"}`}>
                                  {todo.title}
                                </span>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <Tag className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                      {todo.category}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className={cn("text-[8px] h-4 px-1 uppercase font-black border", PRIORITY_COLORS[todo.priority] || PRIORITY_COLORS.Medium)}>
                                    {todo.priority}
                                  </Badge>
                                  {todo.due_date && (
                                    <div className={cn(
                                      "flex items-center gap-1.5",
                                      isOverdue(todo.due_date) && !todo.completed ? "text-destructive" : "text-muted-foreground"
                                    )}>
                                      <Clock className="h-3 w-3" />
                                      <span className="text-[10px] font-bold">
                                        {getDueDateLabel(todo.due_date)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTodo(todo.id)}
                              disabled={todo.isDeleting}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 h-9 w-9"
                            >
                              {todo.isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>
    </div>
  );
}
