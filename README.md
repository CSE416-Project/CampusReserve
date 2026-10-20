[![CI](https://github.com/CSE416-Project/CampusReserve/actions/workflows/ci.yml/badge.svg)](https://github.com/CSE416-Project/CampusReserve/actions/workflows/ci.yml)

# Introduction

This project is for CSE 416 at Stony Brook University. It will be an expansion of 25Live that provides a more user-friendly way to book and approve rooms for student organizations as well as fostering communication between organizations through additional features.

This project is being developed by Sarah Julian, Sarah Zhang, Kelly Fung, and Susan Qu.

## Getting Started

CampusReserve has two parts: a Python backend in `server/` and a
React frontend in `frontend/`. The project is in early setup — the
sections below cover what's runnable now.

### Prerequisites

- Python 3.12+
- Node.js 20+

### Clone the repository

```bash
git clone https://github.com/CSE416-Project/CampusReserve.git
cd CampusReserve
```

### Backend (`server/`)

```bash
cd server
python -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Run the checks:

```bash
ruff check .     # lint
pytest           # tests
```

### Frontend (`frontend/`)

```bash
cd frontend
npm install
npm run dev      # start the dev server
npm run build    # production build (what CI checks)
```
