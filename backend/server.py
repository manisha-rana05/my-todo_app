from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from bson import ObjectId
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configuration
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-for-jwt-signing")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api_router = APIRouter(prefix="/api")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# Helpers
def format_doc(doc: dict) -> dict:
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    if "user_id" in doc:
        doc["user_id"] = str(doc["user_id"])
    return doc

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    return format_doc(user)

# Models
class UserSignup(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class CommentCreate(BaseModel):
    text: str

class TodoCreate(BaseModel):
    title: str
    category: Optional[str] = "General"
    priority: Optional[str] = "Medium"
    due_date: Optional[str] = None

class TodoUpdate(BaseModel):
    completed: Optional[bool] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None

class TodoResponse(BaseModel):
    id: str
    title: str
    completed: bool
    order: int
    category: str
    priority: str
    due_date: Optional[str] = None
    comments: List[Comment] = []

class TodoReorder(BaseModel):
    id: str
    order: int

# Auth Endpoints
@api_router.post("/signup", response_model=UserResponse)
async def signup(user_data: UserSignup):
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    new_user = {
        "email": user_data.email,
        "password": hashed_password.decode('utf-8')
    }
    result = await db.users.insert_one(new_user)
    return {"id": str(result.inserted_id), "email": user_data.email}

@api_router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"email": form_data.username})
    if not user or not bcrypt.checkpw(form_data.password.encode('utf-8'), user["password"].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": str(user["_id"])})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": str(user["_id"]), "email": user["email"]}
    }

# Todo Endpoints
@api_router.get("/todos", response_model=List[TodoResponse])
async def get_todos(current_user: dict = Depends(get_current_user)):
    todos = await db.todos.find({"user_id": ObjectId(current_user["id"])}).sort("order", 1).to_list(1000)
    for t in todos:
        if "order" not in t: t["order"] = 0
        if "category" not in t: t["category"] = "General"
        if "priority" not in t: t["priority"] = "Medium"
        if "comments" not in t: t["comments"] = []
    return [format_doc(todo) for todo in todos]

@api_router.post("/todos", response_model=TodoResponse)
async def create_todo(todo: TodoCreate, current_user: dict = Depends(get_current_user)):
    count = await db.todos.count_documents({"user_id": ObjectId(current_user["id"])})
    new_todo = {
        "user_id": ObjectId(current_user["id"]),
        "title": todo.title,
        "completed": False,
        "order": count,
        "category": todo.category or "General",
        "priority": todo.priority or "Medium",
        "due_date": todo.due_date,
        "comments": []
    }
    result = await db.todos.insert_one(new_todo)
    new_todo["_id"] = result.inserted_id
    return format_doc(new_todo)

@api_router.post("/todos/{todo_id}/comments", response_model=Comment)
async def add_comment(todo_id: str, comment: CommentCreate, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(todo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    new_comment = Comment(text=comment.text).dict()
    result = await db.todos.update_one(
        {"_id": obj_id, "user_id": ObjectId(current_user["id"])},
        {"$push": {"comments": new_comment}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Todo not found")
    return new_comment

@api_router.delete("/todos/{todo_id}/comments/{comment_id}")
async def delete_comment(todo_id: str, comment_id: str, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(todo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    result = await db.todos.update_one(
        {"_id": obj_id, "user_id": ObjectId(current_user["id"])},
        {"$pull": {"comments": {"id": comment_id}}}
    )
    return {"success": True}

@api_router.put("/todos/reorder")
async def reorder_todos(reorders: List[TodoReorder], current_user: dict = Depends(get_current_user)):
    for r in reorders:
        try:
            obj_id = ObjectId(r.id)
            await db.todos.update_one(
                {"_id": obj_id, "user_id": ObjectId(current_user["id"])},
                {"$set": {"order": r.order}}
            )
        except:
            pass
    return {"success": True}

@api_router.patch("/todos/{todo_id}", response_model=TodoResponse)
async def update_todo(todo_id: str, todo_update: TodoUpdate, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(todo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    update_data = {}
    if todo_update.completed is not None:
        update_data["completed"] = todo_update.completed
    if todo_update.category is not None:
        update_data["category"] = todo_update.category
    if todo_update.priority is not None:
        update_data["priority"] = todo_update.priority
    if todo_update.due_date is not None:
        update_data["due_date"] = todo_update.due_date

    result = await db.todos.find_one_and_update(
        {"_id": obj_id, "user_id": ObjectId(current_user["id"])},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Todo not found")
    return format_doc(result)

@api_router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: str, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(todo_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
    result = await db.todos.delete_one({"_id": obj_id, "user_id": ObjectId(current_user["id"])})
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
