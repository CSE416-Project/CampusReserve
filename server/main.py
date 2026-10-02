from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, rooms, requests

app = FastAPI(title="CampusReserve")

# ADDED: without this, the browser blocks any request the React frontend
# (Vite, localhost:5173) tries to make to this API (localhost:8000) -- a
# browser security rule, not a bug in either side. curl/the /docs page
# still work fine without it, since those aren't cross-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(requests.router)
