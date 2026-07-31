import sys
import os

# Ensure root, Backend, and AI Models directories are in sys.path
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, 'Backend')
ai_models_dir = os.path.join(root_dir, 'AI Models')

for path in [root_dir, backend_dir, ai_models_dir]:
    if path not in sys.path:
        sys.path.insert(0, path)

from app import app

if __name__ == "__main__":
    app.run()
