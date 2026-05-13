from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

def format_doc(doc: dict) -> dict:
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

class TodoCreate(BaseModel):
    title: str
    category: Optional[str] = "General"

class TodoUpdate(BaseModel):
    completed: Optional[bool] = None
    category: Optional[str] = None

class TodoResponse(BaseModel):
    id: str
    title: str
    completed: bool
    order: int
    category: str

class TodoReorder(BaseModel):
    id: str
    order: int

@api_router.get("/todos", response_model=List[TodoResponse])
async def get_todos():
    todos = await db.todos.find({}).sort("order", 1).to_list(1000)
    for t in todos:
        if "order" not in t: t["order"] = 0
        if "category" not in t: t["category"] = "General"
    return [format_doc(todo) for todo in todos]

@api_router.post("/todos", response_model=TodoResponse)
async def create_todo(todo: TodoCreate):
    count = await db.todos.count_documents({})
    new_todo = {
        "title": todo.title,
        "completed": False,
        "order": count,
        "category": todo.category or "General"
    }
    result = await db.todos.insert_one(new_todo)
    new_todo["_id"] = result.inserted_id
    return format_doc(new_todo)

@api_router.put("/todos/reorder")
async def reorder_todos(reorders: List[TodoReorder]):
    for r in reorders:
        try:
            obj_id = ObjectId(r.id)
            await db.todos.update_one({"_id": obj_id}, {"$set": {"order": r.order}})
        except:
            pass
    return {"success": True}

@api_router.patch("/todos/{todo_id}", response_model=TodoResponse)
async def update_todo(todo_id: str, todo_update: TodoUpdate):
    try:
        obj_id = ObjectId(todo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    update_data = {}
    if todo_update.completed is not None:
        update_data["completed"] = todo_update.completed
    if todo_update.category is not None:
        update_data["category"] = todo_update.category

    result = await db.todos.find_one_and_update(
        {"_id": obj_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Todo not found")
    return format_doc(result)

@api_router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: str):
    try:
        obj_id = ObjectId(todo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.todos.delete_one({"_id": obj_id})
    return {"success": True}

@api_router.get("/")
async def root():
    return {"message": "Todoist API is running"}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
