from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

def format_doc(doc: dict) -> dict:
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

class TodoCreate(BaseModel):
    title: str

class TodoUpdate(BaseModel):
    completed: bool

class TodoResponse(BaseModel):
    id: str
    title: str
    completed: bool
    order: int

class TodoReorder(BaseModel):
    id: str
    order: int

@api_router.get("/todos", response_model=List[TodoResponse])
async def get_todos():
    todos = await db.todos.find({}).sort("order", 1).to_list(1000)
    # Default order to 0 if not present for older records
    for t in todos:
        if "order" not in t:
            t["order"] = 0
    return [format_doc(todo) for todo in todos]

@api_router.post("/todos", response_model=TodoResponse)
async def create_todo(todo: TodoCreate):
    count = await db.todos.count_documents({})
    new_todo = {
        "title": todo.title,
        "completed": False,
        "order": count
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
        
    result = await db.todos.find_one_and_update(
        {"_id": obj_id},
        {"$set": {"completed": todo_update.completed}},
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
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Todo not found")
    return {"success": True}

from datetime import datetime, timezone

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()