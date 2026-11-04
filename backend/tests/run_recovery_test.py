import os
import sys
import time
import subprocess
import urllib.request

def run_recovery():
    env = dict(os.environ)
    env["PYTHONPATH"] = "C:\\FashoinIQ\\ai-service"

    print("1. Spawning FastAPI microservice on port 8000...")
    proc = subprocess.Popen(
        ["python", "-m", "uvicorn", "app.main:app", "--port", "8000", "--host", "127.0.0.1"],
        cwd="ai-service",
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        # Wait for FastAPI to become healthy
        ready = False
        for i in range(30):
            time.sleep(1)
            try:
                with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2) as r:
                    if r.status == 200:
                        ready = True
                        print(f"  FastAPI reached healthy state in ~{i+1}s.")
                        break
            except Exception:
                pass

        if not ready:
            print("ERROR: FastAPI did not become ready in 30 seconds.")
            sys.exit(1)

        print("\n2. Executing Express verification script (verify_recovery.js)...")
        res = subprocess.run(
            ["node", "backend/tests/verify_recovery.js"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        print(res.stdout)
        if res.stderr:
            print("STDERR:\n", res.stderr)

        if res.returncode != 0:
            sys.exit(res.returncode)

    finally:
        print("3. Terminating FastAPI background process...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("FastAPI background process safely stopped.\n")

if __name__ == "__main__":
    run_recovery()
