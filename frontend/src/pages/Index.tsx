import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, GripVertical, Loader2, Tag, Filter, AlertCircle, Calendar as CalendarIcon, Clock, ArrowUpDown, MessageSquare, Send, X, LogOut, User as UserIcon } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";

export interface Comment {
  id: string;
  text: string;
  created_at: string;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  category: string;
  priority: string;
  due_date?: string;
  comments: Comment[];
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
  const { token, logout, user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [newPriority, setNewPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"custom" | "priority">("custom");
  const [isAdding, setIsAdding] = useState(false);
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (token) fetchTodos();
  }, [token]);

  const fetchTodos = async () => {
    try {
      const response = await fetch(`${API_URL}/api/todos`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
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
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
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
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
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
      const response = await fetch(`${API_URL}/api/todos/${id}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
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

  const handleAddComment = async () => {
    if (!activeTodoId || !commentText.trim() || isAddingComment) return;
    setIsAddingComment(true);
    try {
      const response = await fetch(`${API_URL}/api/todos/${activeTodoId}/comments`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (response.ok) {
        const newComment = await response.json();
        setTodos(todos.map(t => t.id === activeTodoId ? { ...t, comments: [...t.comments, newComment] } : t));
        setCommentText("");
      }
    } catch (error) {
      toast({ title: "Error adding comment", variant: "destructive" });
    } finally {
      setIsAddingComment(false);
    }
  };

  const deleteComment = async (todoId: string, commentId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/todos/${todoId}/comments/${commentId}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        setTodos(todos.map(t => t.id === todoId ? { ...t, comments: t.comments.filter(c => c.id !== commentId) } : t));
      }
    } catch (error) {
      toast({ title: "Error deleting comment", variant: "destructive" });
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
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updatedItems.map((item, index) => ({ id: item.id, order: index }))),
      });
    } catch (error) {
      fetchTodos();
    }
  };

  const processedTodos = useMemo(() => {
    let result = [...todos];
    if (filterCategory !== "All") {
      result = result.filter(t => t.category === filterCategory);
    }
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
        <div className="flex items-center gap-2 mr-2 bg-card/80 backdrop-blur px-3 py-1 rounded-full border border-border/50 shadow-sm">
          <UserIcon className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={logout}>
            <LogOut className="h-3 w-3" />
          </Button>
        </div>
        <ModeToggle />
      </div>
      
      <Card className="w-full max-w-2xl shadow-xl border-border/50 relative z-10 bg-card/95 backdrop-blur-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 pb-7">
          <CardTitle className="text-3xl font-black tracking-tight">Tasks</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Cats</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
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
                <Input placeholder="What needs to be done?" value={newTodo} onChange={(e) => setNewTodo(e.target.value)} className="flex-1 h-11" disabled={isAdding} />
                <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={isAdding}>
                  {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="w-full h-10"><div className="flex items-center gap-2"><Tag className="h-4 w-4" /><SelectValue /></div></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger className="w-full h-10"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /><SelectValue /></div></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-10 justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "MMM d") : <span>Due Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus /></PopoverContent>
                </Popover>
              </div>
            </div>
          </form>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="todos">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {processedTodos.map((todo, index) => (
                    <Draggable key={todo.id} draggableId={todo.id} index={index} isDragDisabled={sortBy !== "custom"}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "flex items-center justify-between p-4 border rounded-xl bg-card transition-all group",
                            snapshot.isDragging ? "shadow-2xl ring-2 ring-primary scale-[1.02] z-50" : "hover:border-primary/30"
                          )}
                          style={provided.draggableProps.style}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div {...provided.dragHandleProps} className={cn("text-muted-foreground/30 hover:text-primary transition-colors cursor-grab active:cursor-grabbing", sortBy !== "custom" && "opacity-0 pointer-events-none")}>
                              <GripVertical className="h-5 w-5" />
                            </div>
                            <Checkbox checked={todo.completed} onCheckedChange={() => toggleTodo(todo.id, todo.completed)} className="h-5 w-5" />
                            <div className="flex flex-col min-w-0">
                              <span className={cn("text-sm font-semibold truncate transition-all", todo.completed ? "line-through text-muted-foreground opacity-60" : "text-foreground")}>
                                {todo.title}
                              </span>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-muted-foreground" /><span className="text-[10px] uppercase font-bold text-muted-foreground">{todo.category}</span></div>
                                <Badge variant="outline" className={cn("text-[8px] h-4 px-1 font-black border", PRIORITY_COLORS[todo.priority])}>{todo.priority}</Badge>
                                {todo.due_date && <div className={cn("flex items-center gap-1.5", isOverdue(todo.due_date) && !todo.completed ? "text-destructive" : "text-muted-foreground")}><Clock className="h-3 w-3" /><span className="text-[10px] font-bold">{getDueDateLabel(todo.due_date)}</span></div>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Dialog onOpenChange={(open) => { if (open) setActiveTodoId(todo.id); else setActiveTodoId(null); }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary shrink-0 h-9 w-9 relative">
                                  <MessageSquare className="h-4 w-4" />
                                  {todo.comments.length > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-background">{todo.comments.length}</span>}
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader><DialogTitle>Comments: {todo.title}</DialogTitle></DialogHeader>
                                <ScrollArea className="h-[300px] pr-4 mt-4">
                                  <div className="space-y-4">
                                    {todo.comments.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No comments yet</p> : todo.comments.map(comment => (
                                      <div key={comment.id} className="bg-muted p-3 rounded-lg relative group">
                                        <p className="text-sm pr-6">{comment.text}</p>
                                        <p className="text-[10px] text-muted-foreground mt-2">{format(new Date(comment.created_at), "MMM d, h:mm a")}</p>
                                        <Button variant="ghost" size="icon" onClick={() => deleteComment(todo.id, comment.id)} className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"><X className="h-3 w-3" /></Button>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                                <div className="flex gap-2 mt-4 pt-4 border-t">
                                  <Input placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} />
                                  <Button size="icon" onClick={handleAddComment} disabled={!commentText.trim() || isAddingComment}>{isAddingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button variant="ghost" size="icon" onClick={() => deleteTodo(todo.id)} disabled={todo.isDeleting} className="text-muted-foreground hover:text-destructive shrink-0 h-9 w-9">
                              {todo.isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
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
