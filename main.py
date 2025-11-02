from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

app = FastAPI()

# Mount static files directory to serve CSS, JS, and other static files
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/")
async def read_root():
    """Serve index.html at the root path"""
    html_file = Path("index.html")
    return FileResponse(html_file)

@app.get("/styles.css")
async def get_styles():
    """Serve styles.css"""
    css_file = Path("styles.css")
    return FileResponse(css_file, media_type="text/css")

@app.get("/script.js")
async def get_script():
    """Serve script.js"""
    js_file = Path("script.js")
    return FileResponse(js_file, media_type="application/javascript")

@app.get("/materials.json")
async def get_materials():
    """Serve materials.json"""
    json_file = Path("materials.json")
    return FileResponse(json_file, media_type="application/json")

